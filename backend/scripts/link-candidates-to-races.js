#!/usr/bin/env node

/**
 * Link FEC candidates to their 2026 races via the candidacies table.
 *
 * The FEC sync populates candidate_profiles with fec_state/fec_office_type/
 * fec_district, but never inserts candidacies rows — so every pre-seeded race
 * shows only the original incumbent even though the DB holds thousands of
 * FEC challengers who should appear in the same race.
 *
 * Matching logic:
 *   H → offices.office_level='federal' + state=fec_state + district=fec_district
 *   S → offices.office_level='federal' + state=fec_state + name contains "Senate"
 *   P → offices.office_level='federal' + name contains "President" (state-agnostic)
 *
 * Idempotent via the (candidate_id, race_id) UNIQUE constraint.
 *
 * Usage:
 *   node scripts/link-candidates-to-races.js
 *   node scripts/link-candidates-to-races.js --cycle=2026
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

async function main() {
  const args = process.argv.slice(2);
  let cycle = 2026;
  for (const a of args) {
    if (a.startsWith('--cycle=')) cycle = parseInt(a.split('=')[1], 10);
  }

  console.log(`\n=== Link FEC Candidates to ${cycle} Races ===`);
  const startedAt = Date.now();

  // Pull FEC candidates who are actually on this cycle's ballot. A profile
  // keeps its fec_candidate_id forever, so "has an FEC ID" is NOT evidence of
  // running this cycle — e.g. a senator elected in 2024 is not up in 2026.
  // The raw FEC record (candidate_source_links.external_data) carries
  // election_years; require it to contain the cycle being linked.
  const candidates = await db.query(`
    SELECT cp.id, cp.display_name, cp.fec_state, cp.fec_office_type, cp.fec_district
      FROM candidate_profiles cp
     WHERE cp.fec_candidate_id IS NOT NULL
       AND cp.is_active = TRUE
       AND cp.fec_office_type IN ('H', 'S', 'P')
       AND EXISTS (
         SELECT 1
           FROM candidate_source_links csl
           JOIN data_sources ds ON ds.id = csl.data_source_id
          WHERE csl.candidate_id = cp.id
            AND ds.name = 'fec'
            AND csl.external_data->'election_years' @> to_jsonb($1::int)
       )
  `, [cycle]);
  console.log(`  Candidates with an FEC record for the ${cycle} cycle: ${candidates.rows.length}`);

  let linked = 0;
  let alreadyLinked = 0;
  let noMatch = 0;
  const missByType = { H: 0, S: 0, P: 0 };

  for (const c of candidates.rows) {
    // Find the matching race for this cycle
    let race = null;
    const districtNum = c.fec_district ? String(parseInt(c.fec_district, 10)) : null;

    try {
      if (c.fec_office_type === 'H' && c.fec_state && c.fec_district) {
        const r = await db.query(
          `SELECT r.id
             FROM races r
             JOIN offices o ON r.office_id = o.id
             JOIN elections e ON r.election_id = e.id
            WHERE o.office_level = 'federal'
              AND o.state = $1
              AND (o.district = $2 OR o.district = $3 OR r.name ILIKE $4)
              AND EXTRACT(YEAR FROM e.election_date) = $5
            ORDER BY e.election_date DESC
            LIMIT 1`,
          [c.fec_state, c.fec_district, districtNum, `%District ${districtNum}%`, cycle]
        );
        race = r.rows[0];
      } else if (c.fec_office_type === 'S' && c.fec_state) {
        const r = await db.query(
          `SELECT r.id
             FROM races r
             JOIN offices o ON r.office_id = o.id
             JOIN elections e ON r.election_id = e.id
            WHERE o.office_level = 'federal'
              AND o.state = $1
              AND (o.name ILIKE '%Senate%' OR r.name ILIKE '%Senate%')
              AND EXTRACT(YEAR FROM e.election_date) = $2
            ORDER BY e.election_date DESC
            LIMIT 1`,
          [c.fec_state, cycle]
        );
        race = r.rows[0];
      } else if (c.fec_office_type === 'P') {
        const r = await db.query(
          `SELECT r.id
             FROM races r
             JOIN offices o ON r.office_id = o.id
             JOIN elections e ON r.election_id = e.id
            WHERE o.office_level = 'federal'
              AND (o.name ILIKE '%President%' OR r.name ILIKE '%President%')
              AND EXTRACT(YEAR FROM e.election_date) = $1
            ORDER BY e.election_date DESC
            LIMIT 1`,
          [cycle]
        );
        race = r.rows[0];
      }
    } catch (err) {
      console.warn(`  query failed for ${c.display_name}:`, err.message);
      continue;
    }

    if (!race) {
      noMatch++;
      missByType[c.fec_office_type] = (missByType[c.fec_office_type] || 0) + 1;
      continue;
    }

    // Insert candidacy; UNIQUE(candidate_id, race_id) makes this idempotent.
    const inserted = await db.query(
      `INSERT INTO candidacies (candidate_id, race_id, filing_status)
       VALUES ($1, $2, 'filed')
       ON CONFLICT (candidate_id, race_id) DO NOTHING
       RETURNING id`,
      [c.id, race.id]
    );
    if (inserted.rows[0]) linked++;
    else alreadyLinked++;
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`  Linked: ${linked} new`);
  console.log(`  Already linked: ${alreadyLinked}`);
  console.log(`  No matching ${cycle} race:`, missByType);
  console.log(`  Duration: ${(elapsedMs / 1000).toFixed(1)}s`);

  await db.pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('link-candidates-to-races failed:', err.message);
  try { await db.pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
