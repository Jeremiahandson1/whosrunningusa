#!/usr/bin/env node

/**
 * Compute Gerrymandering Metrics
 *
 * Calculates efficiency gap, seats-votes ratio, and partisan advantage
 * from district-level election results. UPSERTs into gerrymandering_metrics.
 *
 * Usage:
 *   node scripts/compute-gerrymandering.js
 *   node scripts/compute-gerrymandering.js --year=2024
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Parse CLI flags
const args = process.argv.slice(2);
const yearArg = args.find((a) => a.startsWith('--year='));
const filterYear = yearArg ? parseInt(yearArg.split('=')[1], 10) : null;

/**
 * Get distinct state+year combinations from district election results.
 */
async function getStateYears() {
  const params = [];
  let whereClause = '';

  if (filterYear) {
    whereClause = 'WHERE election_year = $1';
    params.push(filterYear);
  }

  const { rows } = await pool.query(
    `SELECT DISTINCT state_fips, state_abbr, election_year
     FROM district_election_results
     ${whereClause}
     ORDER BY election_year DESC, state_fips`,
    params
  );
  return rows;
}

/**
 * Get all district results for a given state and election year.
 */
async function getDistrictResults(stateFips, electionYear) {
  const { rows } = await pool.query(
    `SELECT district_number, dem_votes, rep_votes, other_votes,
            total_votes, winner_party
     FROM district_election_results
     WHERE state_fips = $1 AND election_year = $2
     ORDER BY district_number`,
    [stateFips, electionYear]
  );
  return rows;
}

// State FIPS to name mapping
const STATE_NAMES = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
  '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
  '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
  '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
  '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
  '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
  '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
  '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
  '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
  '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
  '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
  '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
  '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming'
};

/**
 * Compute all gerrymandering metrics for a set of district results.
 */
function computeMetrics(districts) {
  let totalDemVotes = 0;
  let totalRepVotes = 0;
  let demSeats = 0;
  let repSeats = 0;
  let wastedDem = 0;
  let wastedRep = 0;
  let totalVotesAll = 0;

  for (const d of districts) {
    const dv = d.dem_votes || 0;
    const rv = d.rep_votes || 0;
    const districtTotal = dv + rv; // Only two-party votes for efficiency gap

    totalDemVotes += dv;
    totalRepVotes += rv;
    totalVotesAll += districtTotal;

    // Determine winner by votes (not by winner_party, which could factor in other votes)
    const demWon = dv > rv;

    if (demWon) {
      demSeats++;
      const threshold = Math.floor(districtTotal / 2) + 1;
      wastedDem += dv - threshold;
      wastedRep += rv;
    } else {
      repSeats++;
      const threshold = Math.floor(districtTotal / 2) + 1;
      wastedRep += rv - threshold;
      wastedDem += dv;
    }
  }

  const totalDistricts = districts.length;
  const twoPartyVotes = totalDemVotes + totalRepVotes;

  // Vote shares
  const demVoteShare = twoPartyVotes > 0
    ? (totalDemVotes / twoPartyVotes) * 100
    : 0;
  const repVoteShare = twoPartyVotes > 0
    ? (totalRepVotes / twoPartyVotes) * 100
    : 0;

  // Seat shares
  const demSeatShare = totalDistricts > 0
    ? (demSeats / totalDistricts) * 100
    : 0;
  const repSeatShare = totalDistricts > 0
    ? (repSeats / totalDistricts) * 100
    : 0;

  // Seats-votes ratio (for the party with more seats)
  const seatsVotesRatio = demSeatShare > repSeatShare
    ? (demVoteShare > 0 ? demSeatShare / demVoteShare : 0)
    : (repVoteShare > 0 ? repSeatShare / repVoteShare : 0);

  // Efficiency gap: positive = advantage Dem, negative = advantage Rep
  const efficiencyGap = totalVotesAll > 0
    ? (wastedRep - wastedDem) / totalVotesAll
    : 0;

  // Determine advantage party and excess seats
  let advantageParty = null;
  let advantageSeats = 0;

  if (demSeatShare > demVoteShare && repSeatShare <= repVoteShare) {
    advantageParty = 'Democratic';
    // Excess seats = actual seats - proportional seats
    const proportionalDemSeats = (demVoteShare / 100) * totalDistricts;
    advantageSeats = demSeats - proportionalDemSeats;
  } else if (repSeatShare > repVoteShare && demSeatShare <= demVoteShare) {
    advantageParty = 'Republican';
    const proportionalRepSeats = (repVoteShare / 100) * totalDistricts;
    advantageSeats = repSeats - proportionalRepSeats;
  } else {
    // Both or neither — use efficiency gap direction
    if (efficiencyGap > 0.01) {
      advantageParty = 'Democratic';
      const proportionalDemSeats = (demVoteShare / 100) * totalDistricts;
      advantageSeats = demSeats - proportionalDemSeats;
    } else if (efficiencyGap < -0.01) {
      advantageParty = 'Republican';
      const proportionalRepSeats = (repVoteShare / 100) * totalDistricts;
      advantageSeats = repSeats - proportionalRepSeats;
    }
  }

  return {
    totalDistricts,
    efficiencyGap: parseFloat(efficiencyGap.toFixed(4)),
    seatsVotesRatio: parseFloat(seatsVotesRatio.toFixed(4)),
    demVoteShare: parseFloat(demVoteShare.toFixed(2)),
    demSeatShare: parseFloat(demSeatShare.toFixed(2)),
    repVoteShare: parseFloat(repVoteShare.toFixed(2)),
    repSeatShare: parseFloat(repSeatShare.toFixed(2)),
    wastedDem,
    wastedRep,
    advantageParty,
    advantageSeats: parseFloat(Math.abs(advantageSeats).toFixed(1))
  };
}

/**
 * UPSERT metrics into gerrymandering_metrics table.
 */
async function upsertMetrics(stateFips, stateAbbr, electionYear, metrics) {
  const stateName = STATE_NAMES[stateFips] || null;

  await pool.query(
    `INSERT INTO gerrymandering_metrics
       (state_fips, state_abbr, state_name, election_year,
        total_districts, efficiency_gap, seats_votes_ratio,
        dem_vote_share, dem_seat_share, rep_vote_share, rep_seat_share,
        wasted_dem_votes, wasted_rep_votes,
        advantage_party, advantage_seats)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (state_fips, election_year) DO UPDATE SET
       state_abbr = EXCLUDED.state_abbr,
       state_name = EXCLUDED.state_name,
       total_districts = EXCLUDED.total_districts,
       efficiency_gap = EXCLUDED.efficiency_gap,
       seats_votes_ratio = EXCLUDED.seats_votes_ratio,
       dem_vote_share = EXCLUDED.dem_vote_share,
       dem_seat_share = EXCLUDED.dem_seat_share,
       rep_vote_share = EXCLUDED.rep_vote_share,
       rep_seat_share = EXCLUDED.rep_seat_share,
       wasted_dem_votes = EXCLUDED.wasted_dem_votes,
       wasted_rep_votes = EXCLUDED.wasted_rep_votes,
       advantage_party = EXCLUDED.advantage_party,
       advantage_seats = EXCLUDED.advantage_seats`,
    [
      stateFips,
      stateAbbr,
      stateName,
      electionYear,
      metrics.totalDistricts,
      metrics.efficiencyGap,
      metrics.seatsVotesRatio,
      metrics.demVoteShare,
      metrics.demSeatShare,
      metrics.repVoteShare,
      metrics.repSeatShare,
      metrics.wastedDem,
      metrics.wastedRep,
      metrics.advantageParty,
      metrics.advantageSeats
    ]
  );
}

async function main() {
  console.log('=== Gerrymandering Metrics Calculator ===');
  if (filterYear) console.log(`Filtering to election year: ${filterYear}`);

  const stateYears = await getStateYears();
  console.log(`Found ${stateYears.length} state-year combination(s) to process.\n`);

  if (stateYears.length === 0) {
    console.log('No district election results found. Exiting.');
    await pool.end();
    process.exit(0);
  }

  let totalProcessed = 0;
  let totalErrors = 0;

  for (const { state_fips, state_abbr, election_year } of stateYears) {
    const stateName = STATE_NAMES[state_fips] || state_abbr || state_fips;

    try {
      const districts = await getDistrictResults(state_fips, election_year);

      if (districts.length === 0) {
        console.log(`${stateName} ${election_year}: No districts — skipped.`);
        continue;
      }

      // Skip at-large states (single district) — efficiency gap is meaningless
      if (districts.length === 1) {
        console.log(`${stateName} ${election_year}: At-large (1 district) — skipped.`);
        continue;
      }

      const metrics = computeMetrics(districts);

      await upsertMetrics(state_fips, state_abbr, election_year, metrics);
      totalProcessed++;

      const egPct = (metrics.efficiencyGap * 100).toFixed(1);
      const egDir = metrics.efficiencyGap >= 0 ? 'D+' : 'R+';
      console.log(
        `${stateName} ${election_year}: ${metrics.totalDistricts} districts | ` +
        `D ${metrics.demVoteShare}% votes / ${metrics.demSeatShare}% seats | ` +
        `R ${metrics.repVoteShare}% votes / ${metrics.repSeatShare}% seats | ` +
        `EG: ${egDir}${Math.abs(egPct)}% | ` +
        `Advantage: ${metrics.advantageParty || 'None'} (+${metrics.advantageSeats} seats)`
      );
    } catch (err) {
      console.error(`${stateName} ${election_year}: Error — ${err.message}`);
      totalErrors++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`States processed: ${totalProcessed}`);
  console.log(`Errors: ${totalErrors}`);

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Fatal error:', err.message);
  await pool.end();
  process.exit(1);
});
