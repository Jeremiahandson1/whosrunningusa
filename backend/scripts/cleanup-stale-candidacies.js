#!/usr/bin/env node

/**
 * Remove candidacies that FEC data says are wrong.
 *
 * Historically, link-candidates-to-races.js linked every profile with an FEC
 * ID into the current cycle's races — including senators elected in a prior
 * cycle who are not on this ballot (e.g. a senator who won a 6-year term in
 * 2024 was shown with a 2026 "next election"). The link script is now gated
 * on the FEC record's election_years, but rows created before that fix are
 * still in the database. This script deletes them.
 *
 * A candidacy in a FUTURE federal race is deleted when:
 *   - the candidate has at least one FEC source link (we have authoritative
 *     data about them), AND
 *   - none of their FEC records list the race's election year in
 *     election_years.
 * Candidates with no FEC link are never touched (no evidence either way).
 *
 * Default scope is Senate and President races — the seats where "in office"
 * and "on the ballot" diverge. Pass --include-house to sweep House races too
 * (safe once the cycle's filing deadlines have passed, but it will also drop
 * seeded incumbents who have not filed with the FEC).
 *
 * Usage:
 *   node scripts/cleanup-stale-candidacies.js --dry-run
 *   node scripts/cleanup-stale-candidacies.js
 *   node scripts/cleanup-stale-candidacies.js --include-house
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const includeHouse = args.includes('--include-house');

  console.log(`\n=== Cleanup Stale Candidacies ${dryRun ? '(dry run)' : ''} ===`);
  const startedAt = Date.now();

  const scopeClause = includeHouse
    ? ''
    : `AND (o.name ILIKE '%Senate%' OR r.name ILIKE '%Senate%'
           OR o.name ILIKE '%President%' OR r.name ILIKE '%President%')`;

  const stale = await db.query(`
    SELECT c.id AS candidacy_id,
           cp.display_name,
           r.name AS race_name,
           EXTRACT(YEAR FROM e.election_date)::int AS race_year
      FROM candidacies c
      JOIN candidate_profiles cp ON cp.id = c.candidate_id
      JOIN races r ON r.id = c.race_id
      JOIN offices o ON o.id = r.office_id
      JOIN elections e ON e.id = r.election_id
     WHERE o.office_level = 'federal'
       AND e.election_date >= CURRENT_DATE
       ${scopeClause}
       AND EXISTS (
         SELECT 1
           FROM candidate_source_links csl
           JOIN data_sources ds ON ds.id = csl.data_source_id
          WHERE csl.candidate_id = cp.id
            AND ds.name = 'fec'
       )
       AND NOT EXISTS (
         SELECT 1
           FROM candidate_source_links csl
           JOIN data_sources ds ON ds.id = csl.data_source_id
          WHERE csl.candidate_id = cp.id
            AND ds.name = 'fec'
            AND csl.external_data->'election_years' @> to_jsonb(EXTRACT(YEAR FROM e.election_date)::int)
       )
     ORDER BY race_year, cp.display_name
  `);

  console.log(`  Stale candidacies found: ${stale.rows.length}`);
  for (const row of stale.rows.slice(0, 50)) {
    console.log(`    - ${row.display_name} → ${row.race_name} (${row.race_year})`);
  }
  if (stale.rows.length > 50) {
    console.log(`    … and ${stale.rows.length - 50} more`);
  }

  let deleted = 0;
  if (!dryRun && stale.rows.length > 0) {
    const ids = stale.rows.map(r => r.candidacy_id);
    const result = await db.query(
      `DELETE FROM candidacies WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    deleted = result.rowCount;
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`  Deleted: ${dryRun ? '0 (dry run)' : deleted}`);
  console.log(`  Duration: ${(elapsedMs / 1000).toFixed(1)}s`);

  await db.pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('cleanup-stale-candidacies failed:', err.message);
  try { await db.pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
