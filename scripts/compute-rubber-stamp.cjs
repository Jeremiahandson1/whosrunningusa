#!/usr/bin/env node

/**
 * Compute rubber stamp scores from voting records.
 *
 * Uses the actual voting_records schema: candidate_id, bill_id, vote, vote_date
 * Party loyalty is determined by comparing each politician's vote against
 * the majority vote of same-party members on the same bill+date.
 *
 * Usage:
 *   node scripts/compute-rubber-stamp.cjs
 *   node scripts/compute-rubber-stamp.cjs --cycle=2026
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function parseArgs() {
  const args = { cycle: new Date().getFullYear() };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--cycle=')) {
      args.cycle = parseInt(arg.split('=')[1], 10);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const cycleYear = args.cycle;

  console.log(`Computing rubber stamp scores for cycle ${cycleYear}...`);

  // Previously this looped politicians × roll-calls in JS, running one
  // party-tally query per vote — tens of thousands of round-trips that
  // exceeded the 30-min step timeout. The whole computation can run in a
  // single statement with CTEs:
  //   1. party_majorities — most-voted position per (vote_event, party)
  //   2. politician_votes — each politician's vote with their party's majority
  //   3. politician_counts — totals + party-line / cross / independent breakdown
  //   4. donor_counts — aligned/opposed counts per politician
  // Then INSERT…SELECT into rubber_stamp_scores with UPSERT.
  const result = await pool.query(`
    WITH party_tallies AS (
      SELECT vr.vote_event_id, cp.party_affiliation, vr.vote, COUNT(*) AS cnt
      FROM voting_records vr
      JOIN vote_events ve ON ve.id = vr.vote_event_id
      JOIN candidate_profiles cp ON cp.id = vr.candidate_id
      WHERE EXTRACT(YEAR FROM ve.vote_date) = $1
        AND vr.vote IN ('yes', 'no')
        AND cp.party_affiliation IS NOT NULL
      GROUP BY vr.vote_event_id, cp.party_affiliation, vr.vote
    ),
    party_majorities AS (
      SELECT DISTINCT ON (vote_event_id, party_affiliation)
        vote_event_id, party_affiliation, vote AS majority_vote
      FROM party_tallies
      ORDER BY vote_event_id, party_affiliation, cnt DESC
    ),
    politician_votes AS (
      SELECT
        vr.candidate_id,
        vr.vote_event_id,
        vr.vote,
        pm.majority_vote
      FROM voting_records vr
      JOIN vote_events ve ON ve.id = vr.vote_event_id
      JOIN candidate_profiles cp ON cp.id = vr.candidate_id
      LEFT JOIN party_majorities pm
        ON pm.vote_event_id = vr.vote_event_id
       AND pm.party_affiliation = cp.party_affiliation
      WHERE EXTRACT(YEAR FROM ve.vote_date) = $1
        AND vr.vote IN ('yes', 'no')
    ),
    politician_counts AS (
      SELECT
        candidate_id,
        COUNT(*) AS total_votes,
        COUNT(*) FILTER (WHERE majority_vote IS NOT NULL AND vote = majority_vote) AS party_line_votes,
        COUNT(*) FILTER (WHERE majority_vote IS NOT NULL AND vote <> majority_vote) AS cross_party_votes
      FROM politician_votes
      GROUP BY candidate_id
    ),
    donor_counts AS (
      SELECT
        politician_id,
        COUNT(*) AS donor_total,
        COUNT(*) FILTER (WHERE correlation_type = 'aligned') AS donor_aligned,
        COUNT(*) FILTER (WHERE correlation_type = 'contradicted') AS donor_opposed
      FROM donor_vote_connections
      GROUP BY politician_id
    )
    INSERT INTO rubber_stamp_scores (
      politician_id, cycle_year, party_loyalty_pct, donor_alignment_pct,
      total_votes, party_line_votes, cross_party_votes,
      donor_aligned_votes, donor_opposed_votes, independent_votes,
      last_computed_at, updated_at
    )
    SELECT
      pc.candidate_id,
      $1,
      CASE WHEN pc.total_votes > 0
        THEN ROUND(pc.party_line_votes::numeric / pc.total_votes * 10000) / 100
        ELSE NULL END,
      CASE WHEN COALESCE(dc.donor_total, 0) > 0
        THEN ROUND(COALESCE(dc.donor_aligned, 0)::numeric / dc.donor_total * 10000) / 100
        ELSE NULL END,
      pc.total_votes,
      pc.party_line_votes,
      pc.cross_party_votes,
      COALESCE(dc.donor_aligned, 0),
      COALESCE(dc.donor_opposed, 0),
      pc.total_votes - pc.party_line_votes - pc.cross_party_votes
    FROM politician_counts pc
    LEFT JOIN donor_counts dc ON dc.politician_id = pc.candidate_id
    ON CONFLICT (politician_id, cycle_year) DO UPDATE SET
      party_loyalty_pct = EXCLUDED.party_loyalty_pct,
      donor_alignment_pct = EXCLUDED.donor_alignment_pct,
      total_votes = EXCLUDED.total_votes,
      party_line_votes = EXCLUDED.party_line_votes,
      cross_party_votes = EXCLUDED.cross_party_votes,
      donor_aligned_votes = EXCLUDED.donor_aligned_votes,
      donor_opposed_votes = EXCLUDED.donor_opposed_votes,
      independent_votes = EXCLUDED.independent_votes,
      last_computed_at = NOW(),
      updated_at = NOW()
  `, [cycleYear]);

  console.log(`\n=== Summary ===`);
  console.log(`Cycle year:          ${cycleYear}`);
  console.log(`Politicians scored:  ${result.rowCount}`);
  console.log('Done.');
}

main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
