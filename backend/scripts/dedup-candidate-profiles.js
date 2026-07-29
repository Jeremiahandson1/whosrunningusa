#!/usr/bin/env node

/**
 * Nightly candidate-profile deduplication.
 *
 * Migrations 018/019/020 removed duplicates once, but candidate_profiles has
 * no unique constraint, so every nightly ingestion run can recreate them.
 * This script re-applies migration 020's strategy on a schedule, plus the
 * cases 020 could not catch:
 *
 * Tier 1 (auto): same normalize_candidate_name(display_name) + same
 *         fec_state (or both NULL) — case/middle-name/suffix variants.
 * Tier 2 (auto): a NULL-state profile whose normalized name matches profiles
 *         from exactly one state. This is the Congress.gov twin shape: that
 *         sync inserts rows without fec_state, so "Adam Schiff" (fec_state
 *         CA) and "Adam Schiff" (fec_state NULL) never grouped under 020.
 *         Ambiguous names (matches in 2+ states) are skipped and logged.
 * Tier 3 (report-only unless --fuzzy): same state + district + office type,
 *         same first name, overlapping surname tokens — hyphenated-surname
 *         FEC refilings like "Angelina Rosario-Sigala" / "Angelina Sigala".
 *         Off by default because two real people can share a surname token
 *         in one district; review with the admin merge endpoint instead.
 *
 * Merge mechanics:
 *   - Keeper: claimed profile (user_id) first, then most linked data, then
 *     oldest. Groups with 2+ claimed profiles are never auto-merged.
 *   - Every FK referencing candidate_profiles is discovered from pg_catalog
 *     at runtime (60+ tables; a hardcoded list would rot). References are
 *     re-pointed to the keeper; when the keeper already has an equivalent
 *     unique row (scores, candidacies, source links, ...) the duplicate's
 *     row is dropped. One transaction per group.
 *
 * Usage:
 *   node scripts/dedup-candidate-profiles.js --dry-run
 *   node scripts/dedup-candidate-profiles.js
 *   node scripts/dedup-candidate-profiles.js --fuzzy
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');
const { discoverReferencingColumns, mergeProfileInto } = require('../services/profileMerge');

function surnameTokens(normName) {
  // normalize_candidate_name returns "lastname,firstname"
  const last = (normName.split(',')[0] || '');
  return new Set(last.split(/[-\s]+/).filter(Boolean));
}

function firstName(normName) {
  return normName.split(',')[1] || '';
}

function richness(p) {
  return ['open_states_id', 'congress_gov_id', 'twitter_handle',
          'campaign_website', 'fec_candidate_id', 'profile_photo_url']
    .reduce((n, c) => n + (p[c] ? 1 : 0), 0);
}

function pickKeeper(group) {
  return [...group].sort((a, b) =>
    (b.user_id ? 1 : 0) - (a.user_id ? 1 : 0)
    || richness(b) - richness(a)
    || new Date(a.created_at) - new Date(b.created_at)
  )[0];
}

async function mergeGroup(client, refCols, keep, removes) {
  for (const rm of removes) {
    await mergeProfileInto(client, refCols, keep.id, rm.id);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fuzzy = args.includes('--fuzzy');

  console.log(`\n=== Dedup Candidate Profiles ${dryRun ? '(dry run)' : ''} ===`);
  const startedAt = Date.now();

  const profiles = (await db.query(`
    SELECT id, display_name, fec_state, fec_district, fec_office_type,
           user_id, open_states_id, congress_gov_id, twitter_handle,
           campaign_website, fec_candidate_id, profile_photo_url, created_at,
           normalize_candidate_name(display_name) AS norm_name
      FROM candidate_profiles
     WHERE normalize_candidate_name(display_name) IS NOT NULL
       AND LENGTH(normalize_candidate_name(display_name)) > 2
  `)).rows;
  console.log(`  Profiles scanned: ${profiles.length}`);

  // ---- Tier 1: exact normalized name + state -------------------------------
  const byNameState = new Map();
  const byName = new Map();
  for (const p of profiles) {
    const k1 = `${p.norm_name}|${p.fec_state || ''}`;
    if (!byNameState.has(k1)) byNameState.set(k1, []);
    byNameState.get(k1).push(p);
    if (!byName.has(p.norm_name)) byName.set(p.norm_name, []);
    byName.get(p.norm_name).push(p);
  }

  const groups = [...byNameState.values()].filter(g => g.length > 1);

  // ---- Tier 2: NULL-state profile joins its name's only state group --------
  let ambiguousNullState = 0;
  for (const p of profiles.filter(x => !x.fec_state)) {
    const sameName = byName.get(p.norm_name).filter(x => x.fec_state);
    const states = [...new Set(sameName.map(x => x.fec_state))];
    if (states.length === 1) {
      const groupKey = `${p.norm_name}|${states[0]}`;
      const target = byNameState.get(groupKey);
      // The NULL-state profiles for this name form their own tier-1 group
      // (possibly of size 1); fold them into the stated group instead.
      const nullGroup = byNameState.get(`${p.norm_name}|`) || [];
      if (!target.includes(p)) target.push(p);
      if (nullGroup.length > 0 && groups.includes(nullGroup)) {
        groups.splice(groups.indexOf(nullGroup), 1);
      }
      if (!groups.includes(target)) groups.push(target);
    } else if (states.length > 1) {
      ambiguousNullState++;
    }
  }
  if (ambiguousNullState > 0) {
    console.log(`  Skipped ${ambiguousNullState} NULL-state profiles with an ambiguous (multi-state) name`);
  }

  // ---- Tier 3: hyphenated-surname refilings in the same seat ---------------
  const fuzzyPairs = [];
  const bySeat = new Map();
  for (const p of profiles.filter(x => x.fec_state && x.fec_office_type)) {
    const k = `${p.fec_state}|${p.fec_office_type}|${p.fec_district || ''}`;
    if (!bySeat.has(k)) bySeat.set(k, []);
    bySeat.get(k).push(p);
  }
  for (const seatProfiles of bySeat.values()) {
    for (let i = 0; i < seatProfiles.length; i++) {
      for (let j = i + 1; j < seatProfiles.length; j++) {
        const a = seatProfiles[i], b = seatProfiles[j];
        if (a.norm_name === b.norm_name) continue; // tier 1 handles it
        if (!firstName(a.norm_name) || firstName(a.norm_name) !== firstName(b.norm_name)) continue;
        const shared = [...surnameTokens(a.norm_name)].filter(t => surnameTokens(b.norm_name).has(t));
        if (shared.length > 0) fuzzyPairs.push([a, b]);
      }
    }
  }
  if (fuzzyPairs.length > 0) {
    console.log(`  Possible hyphenated-surname duplicates (same seat): ${fuzzyPairs.length}`);
    for (const [a, b] of fuzzyPairs.slice(0, 30)) {
      console.log(`    ? "${a.display_name}" ~ "${b.display_name}" (${a.fec_state}${a.fec_district ? '-' + a.fec_district : ''})`);
    }
    if (fuzzy) {
      for (const [a, b] of fuzzyPairs) {
        const ga = groups.find(g => g.includes(a));
        const gb = groups.find(g => g.includes(b));
        if (ga && ga === gb) continue;
        if (ga && gb) { ga.push(...gb); groups.splice(groups.indexOf(gb), 1); }
        else if (ga) { if (!ga.includes(b)) ga.push(b); }
        else if (gb) { if (!gb.includes(a)) gb.push(a); }
        else groups.push([a, b]);
      }
    } else {
      console.log(`    (report only — rerun with --fuzzy to merge, or use the admin merge endpoint)`);
    }
  }

  // ---- Merge ---------------------------------------------------------------
  const refCols = await discoverReferencingColumns(db);
  console.log(`  Referencing FK columns discovered: ${refCols.length}`);
  console.log(`  Duplicate groups: ${groups.length}`);

  let merged = 0, removed = 0, skippedClaimed = 0, failed = 0;
  const client = await db.pool.connect();
  try {
    for (const group of groups) {
      const claimed = group.filter(p => p.user_id);
      if (claimed.length > 1) {
        skippedClaimed++;
        console.log(`  SKIP (2+ claimed profiles): ${group.map(p => p.display_name).join(' / ')}`);
        continue;
      }
      const keep = pickKeeper(group);
      const removes = group.filter(p => p.id !== keep.id);
      console.log(`  MERGE → "${keep.display_name}" (${keep.fec_state || '—'}) absorbs: ${removes.map(p => `"${p.display_name}"`).join(', ')}`);
      if (dryRun) continue;

      try {
        await client.query('BEGIN');
        await mergeGroup(client, refCols, keep, removes);
        await client.query('COMMIT');
        merged++;
        removed += removes.length;
      } catch (err) {
        await client.query('ROLLBACK');
        failed++;
        console.error(`  FAILED merging "${keep.display_name}": ${err.message}`);
      }
    }
  } finally {
    client.release();
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`\n  Groups merged: ${dryRun ? '0 (dry run)' : merged}`);
  console.log(`  Profiles removed: ${dryRun ? '0 (dry run)' : removed}`);
  console.log(`  Groups skipped (multiple claimed): ${skippedClaimed}`);
  console.log(`  Groups failed: ${failed}`);
  console.log(`  Duration: ${(elapsedMs / 1000).toFixed(1)}s`);

  await db.pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('dedup-candidate-profiles failed:', err.message);
  try { await db.pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
