#!/usr/bin/env node

/**
 * Compute rubber stamp scores from voting records.
 *
 * Usage:
 *   node scripts/compute-rubber-stamp.js
 *   node scripts/compute-rubber-stamp.js --cycle=2026
 *
 * Required env vars:
 *   DATABASE_URL — PostgreSQL connection string
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

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

  console.log(`Computing rubber stamp scores for cycle ${cycleYear}...\n`);

  // Get all politicians with voting records in this cycle year
  const { rows: politicians } = await pool.query(`
    SELECT DISTINCT vr.candidate_id, cp.display_name, cp.party_affiliation
    FROM voting_records vr
    JOIN vote_events ve ON ve.id = vr.vote_event_id
    JOIN candidate_profiles cp ON cp.id = vr.candidate_id
    WHERE EXTRACT(YEAR FROM ve.vote_date) = $1
  `, [cycleYear]);

  console.log(`Found ${politicians.length} politicians with voting records in ${cycleYear}.\n`);

  let processed = 0;

  for (const pol of politicians) {
    const party = pol.party_affiliation;
    const candidateId = pol.candidate_id;

    // Get all this politician's votes for the cycle
    const { rows: myVotes } = await pool.query(`
      SELECT vr.vote_event_id, vr.vote
      FROM voting_records vr
      JOIN vote_events ve ON ve.id = vr.vote_event_id
      WHERE vr.candidate_id = $1
        AND EXTRACT(YEAR FROM ve.vote_date) = $2
    `, [candidateId, cycleYear]);

    const totalVotes = myVotes.length;
    if (totalVotes === 0) continue;

    // For party loyalty: for each vote_event, determine the party majority position
    let partyLineVotes = 0;
    let crossPartyVotes = 0;

    if (party) {
      for (const myVote of myVotes) {
        // Count yes/no among same-party members for this vote event (excluding this politician)
        const { rows: partyTally } = await pool.query(`
          SELECT vr.vote, COUNT(*) AS cnt
          FROM voting_records vr
          JOIN candidate_profiles cp ON cp.id = vr.candidate_id
          WHERE vr.vote_event_id = $1
            AND cp.party_affiliation = $2
            AND vr.candidate_id != $3
            AND vr.vote IN ('yes', 'no')
          GROUP BY vr.vote
          ORDER BY cnt DESC
          LIMIT 1
        `, [myVote.vote_event_id, party, candidateId]);

        if (partyTally.length > 0) {
          const majorityPosition = partyTally[0].vote;
          if (myVote.vote === majorityPosition) {
            partyLineVotes++;
          } else if (myVote.vote === 'yes' || myVote.vote === 'no') {
            crossPartyVotes++;
          }
        }
      }
    }

    const partyLoyaltyPct = totalVotes > 0
      ? Math.round((partyLineVotes / totalVotes) * 10000) / 100
      : null;

    // For donor alignment: count donor_vote_connections where correlation_type = 'aligned' vs total
    const { rows: donorStats } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE correlation_type = 'aligned') AS aligned,
        COUNT(*) FILTER (WHERE correlation_type = 'contradicted') AS opposed
      FROM donor_vote_connections
      WHERE politician_id = $1
    `, [candidateId]);

    const donorTotal = parseInt(donorStats[0].total, 10);
    const donorAligned = parseInt(donorStats[0].aligned, 10);
    const donorOpposed = parseInt(donorStats[0].opposed, 10);

    const donorAlignmentPct = donorTotal > 0
      ? Math.round((donorAligned / donorTotal) * 10000) / 100
      : null;

    const independentVotes = totalVotes - partyLineVotes - crossPartyVotes;

    // UPSERT into rubber_stamp_scores
    await pool.query(`
      INSERT INTO rubber_stamp_scores (
        politician_id, cycle_year, party_loyalty_pct, donor_alignment_pct,
        total_votes, party_line_votes, cross_party_votes,
        donor_aligned_votes, donor_opposed_votes, independent_votes,
        last_computed_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
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
    `, [
      candidateId, cycleYear, partyLoyaltyPct, donorAlignmentPct,
      totalVotes, partyLineVotes, crossPartyVotes,
      donorAligned, donorOpposed, independentVotes
    ]);

    processed++;
    console.log(`  [${processed}/${politicians.length}] ${pol.display_name || candidateId} (${party || 'no party'}) — votes=${totalVotes} partyLine=${partyLineVotes} (${partyLoyaltyPct ?? 'N/A'}%) donorAligned=${donorAligned}/${donorTotal} (${donorAlignmentPct ?? 'N/A'}%)`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Cycle year:          ${cycleYear}`);
  console.log(`Politicians scored:  ${processed}`);
  console.log('Done.');
}

main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
