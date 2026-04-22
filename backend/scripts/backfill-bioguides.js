#!/usr/bin/env node

/**
 * Backfill `congress_gov_id` (bioguide id) on existing candidate_profiles.
 *
 * Why: the 582 sitting officials in the DB have NULL congress_gov_id, so the
 * committees and votes syncs — which join on bioguide — find zero matches and
 * write zero rows. This script loads the public unitedstates/congress-legislators
 * dataset and fills in bioguide ids by normalized name + state.
 *
 * Idempotent: only updates rows where congress_gov_id is currently NULL.
 *
 * Usage:
 *   node scripts/backfill-bioguides.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

const LEGISLATORS_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function main() {
  console.log('\n=== Bioguide Backfill ===');
  const startedAt = Date.now();

  const legislators = await fetchJson(LEGISLATORS_URL);
  console.log(`  Fetched ${legislators.length} current legislators`);

  let matched = 0;
  let unmatched = 0;
  let skipped = 0;

  for (const leg of legislators) {
    const term = (leg.terms || []).slice(-1)[0];
    const bioguide = leg.id?.bioguide;
    const state = term?.state;
    const first = leg.name?.official_full
      ? leg.name.first
      : leg.name?.first;
    const last = leg.name?.last;
    const displayName = leg.name?.official_full || (first && last ? `${first} ${last}` : null);
    if (!bioguide || !displayName || !state) { skipped++; continue; }

    const result = await db.query(
      `UPDATE candidate_profiles
         SET congress_gov_id = $1, updated_at = NOW()
       WHERE congress_gov_id IS NULL
         AND (fec_state = $2 OR fec_state IS NULL)
         AND normalize_candidate_name(display_name) = normalize_candidate_name($3)
       RETURNING id`,
      [bioguide, state, displayName]
    );

    if (result.rowCount > 0) {
      matched += result.rowCount;
    } else {
      unmatched++;
    }
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`  Matched & backfilled: ${matched}`);
  console.log(`  Unmatched legislators: ${unmatched}`);
  console.log(`  Skipped (missing data): ${skipped}`);
  console.log(`  Duration: ${(elapsedMs / 1000).toFixed(1)}s`);

  await db.pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('backfill-bioguides failed:', err.message);
  try { await db.pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
