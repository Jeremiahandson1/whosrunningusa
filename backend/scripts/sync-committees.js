#!/usr/bin/env node

/**
 * Committee Memberships Sync
 *
 * Pulls the current 119th-Congress committee list and per-member assignments
 * from the public unitedstates/congress-legislators dataset and writes them
 * to legislative_committees + committee_memberships.
 *
 * Source: https://theunitedstates.io/congress-legislators/ (CC0)
 * No API key required.
 *
 * Matches members to candidate_profiles by congress_gov_id (bioguide id).
 *
 * Usage:
 *   node scripts/sync-committees.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

const COMMITTEES_URL = 'https://unitedstates.github.io/congress-legislators/committees-current.json';
const MEMBERSHIP_URL = 'https://unitedstates.github.io/congress-legislators/committee-membership-current.json';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function upsertCommittee(c, parentId = null) {
  const chamberMap = { house: 'House', senate: 'Senate', joint: 'Joint' };
  const chamber = chamberMap[c.type] || null;
  const committeeType = c.type || null;
  const thomasId = c.thomas_id || null;
  const result = await db.query(
    `INSERT INTO legislative_committees (name, short_name, chamber, committee_type, parent_committee_id,
       jurisdiction_level, congress_id, is_active)
     VALUES ($1, $2, $3, $4, $5, 'federal', $6, TRUE)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [c.name, c.short_name || null, chamber, committeeType, parentId, thomasId]
  );
  if (result.rows[0]) return result.rows[0].id;
  // Already exists — look it up by congress_id or name
  const existing = await db.query(
    `SELECT id FROM legislative_committees
     WHERE ($1::text IS NOT NULL AND congress_id = $1) OR name = $2
     LIMIT 1`,
    [thomasId, c.name]
  );
  return existing.rows[0]?.id || null;
}

async function main() {
  console.log('\n=== Committee Memberships Sync ===');
  const startedAt = Date.now();

  const [committees, membership] = await Promise.all([
    fetchJson(COMMITTEES_URL),
    fetchJson(MEMBERSHIP_URL),
  ]);

  console.log(`  Fetched ${committees.length} parent committees`);

  // 1) Upsert committees (parents first, then subcommittees)
  const thomasToId = new Map();
  let committeeCount = 0;
  for (const c of committees) {
    const id = await upsertCommittee(c);
    if (id && c.thomas_id) thomasToId.set(c.thomas_id, id);
    if (id) committeeCount++;
    for (const sub of c.subcommittees || []) {
      // Subcommittee thomas_id is prefixed by the parent's thomas_id in the membership file
      sub.thomas_id = c.thomas_id + (sub.thomas_id || '');
      const subId = await upsertCommittee(sub, id);
      if (subId && sub.thomas_id) thomasToId.set(sub.thomas_id, subId);
      if (subId) committeeCount++;
    }
  }
  console.log(`  Upserted ${committeeCount} committees`);

  // 2) Upsert memberships — membership is keyed by thomas_id -> [ {bioguide, name, rank, title}, ... ]
  let memberships = 0;
  let unmatched = 0;
  for (const [thomasId, members] of Object.entries(membership)) {
    const committeeId = thomasToId.get(thomasId);
    if (!committeeId) {
      // Not found — might be a subcommittee we didn't register, skip
      continue;
    }
    for (const m of members) {
      if (!m.bioguide) { unmatched++; continue; }
      // Find the candidate by bioguide (stored in congress_gov_id or verification_external_id)
      const cand = await db.query(
        `SELECT id FROM candidate_profiles
         WHERE congress_gov_id = $1
            OR (verification_source = 'congress_gov' AND verification_external_id = $1)
         LIMIT 1`,
        [m.bioguide]
      );
      if (cand.rows.length === 0) { unmatched++; continue; }
      const candidateId = cand.rows[0].id;

      // The table's UNIQUE(candidate_id, committee_id, start_date) treats
      // NULL start_date as distinct across rows, so ON CONFLICT didn't fire
      // on re-runs and we ended up with duplicate memberships. Match-then-
      // upsert manually so repeated syncs stay idempotent.
      const role = m.title || null;
      const isChair = (m.title || '').toLowerCase() === 'chair';
      const isRanking = (m.title || '').toLowerCase().includes('ranking');
      const existing = await db.query(
        `SELECT id FROM committee_memberships
          WHERE candidate_id = $1 AND committee_id = $2 AND start_date IS NULL
          LIMIT 1`,
        [candidateId, committeeId]
      );
      if (existing.rows.length > 0) {
        await db.query(
          `UPDATE committee_memberships
              SET role = $2, is_chair = $3, is_ranking_member = $4, is_current = TRUE
            WHERE id = $1`,
          [existing.rows[0].id, role, isChair, isRanking]
        );
      } else {
        await db.query(
          `INSERT INTO committee_memberships
            (candidate_id, committee_id, role, is_chair, is_ranking_member, is_current, source)
           VALUES ($1, $2, $3, $4, $5, TRUE, 'congress-legislators')`,
          [candidateId, committeeId, role, isChair, isRanking]
        );
      }
      memberships++;
    }
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`  Upserted ${memberships} committee memberships (${unmatched} members not matched to profiles)`);
  console.log(`  Duration: ${(elapsedMs / 1000).toFixed(1)}s`);

  await db.pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('sync-committees failed:', err.message);
  try { await db.pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
