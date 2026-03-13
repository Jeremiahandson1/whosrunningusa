#!/usr/bin/env node

/**
 * Sync Bills and Votes from Open States
 * 
 * Usage:
 *   node scripts/sync-open-states-bills.js WI           # Sync Wisconsin bills
 *   node scripts/sync-open-states-bills.js WI 2023      # Sync specific session
 *   node scripts/sync-open-states-bills.js WI --recent  # Sync recent bills only (last 90 days)
 */

require('dotenv').config();
const { Pool } = require('pg');
const OpenStatesClient = require('../services/ingestion/openStatesClient');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const client = new OpenStatesClient();

// Data source ID for Open States
const OPEN_STATES_SOURCE_ID = '00000000-0000-0000-0000-000000000004';

/**
 * Get or create a bill in the database
 */
async function upsertBill(db, billData) {
  // Check if bill exists
  const existing = await db.query(
    `SELECT id FROM bills WHERE external_id = $1 AND source = 'open_states'`,
    [billData.externalId]
  );

  if (existing.rows.length > 0) {
    // Update existing bill
    await db.query(`
      UPDATE bills SET
        bill_number = $2,
        title = $3,
        description = $4,
        state = $5,
        chamber = $6,
        session = $7,
        categories = $8,
        status = $9,
        introduced_date = $10,
        last_action_date = $11,
        source_url = $12,
        updated_at = NOW()
      WHERE id = $1
    `, [
      existing.rows[0].id,
      billData.billNumber,
      billData.title,
      billData.description,
      billData.state,
      billData.chamber,
      billData.session,
      billData.categories,
      billData.status,
      billData.introducedDate,
      billData.lastActionDate,
      billData.sourceUrl
    ]);
    return { id: existing.rows[0].id, created: false };
  } else {
    // Insert new bill
    const result = await db.query(`
      INSERT INTO bills (
        external_id, bill_number, title, description, state, chamber,
        session, categories, status, introduced_date, last_action_date,
        source, source_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      billData.externalId,
      billData.billNumber,
      billData.title,
      billData.description,
      billData.state,
      billData.chamber,
      billData.session,
      billData.categories,
      billData.status,
      billData.introducedDate,
      billData.lastActionDate,
      'open_states',
      billData.sourceUrl
    ]);
    return { id: result.rows[0].id, created: true };
  }
}

/**
 * Get or create a vote event
 */
async function upsertVoteEvent(db, voteData, billId) {
  // Check if vote event exists
  const existing = await db.query(
    `SELECT id FROM vote_events WHERE external_id = $1 AND source = 'open_states'`,
    [voteData.externalId]
  );

  if (existing.rows.length > 0) {
    // Update existing
    await db.query(`
      UPDATE vote_events SET
        motion_text = $2,
        motion_classification = $3,
        chamber = $4,
        vote_date = $5,
        result = $6,
        yes_count = $7,
        no_count = $8,
        abstain_count = $9,
        absent_count = $10,
        source_url = $11
      WHERE id = $1
    `, [
      existing.rows[0].id,
      voteData.motionText,
      voteData.motionClassification,
      voteData.chamber,
      voteData.voteDate,
      voteData.result,
      voteData.yesCount,
      voteData.noCount,
      voteData.abstainCount,
      voteData.absentCount,
      voteData.sourceUrl
    ]);
    return { id: existing.rows[0].id, created: false };
  } else {
    // Insert new
    const result = await db.query(`
      INSERT INTO vote_events (
        bill_id, external_id, motion_text, motion_classification, chamber,
        vote_date, result, yes_count, no_count, abstain_count, absent_count,
        source, source_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      billId,
      voteData.externalId,
      voteData.motionText,
      voteData.motionClassification,
      voteData.chamber,
      voteData.voteDate,
      voteData.result,
      voteData.yesCount,
      voteData.noCount,
      voteData.abstainCount,
      voteData.absentCount,
      'open_states',
      voteData.sourceUrl
    ]);
    return { id: result.rows[0].id, created: true };
  }
}

/**
 * Find candidate by Open States ID
 */
async function findCandidateByOpenStatesId(db, openStatesId) {
  const result = await db.query(
    `SELECT id FROM candidate_profiles WHERE open_states_id = $1`,
    [openStatesId]
  );
  return result.rows[0]?.id || null;
}

/**
 * Find candidate by name and state (fallback)
 */
async function findCandidateByName(db, name, state) {
  // Try exact match first - join through candidacies/races/offices to get state
  let result = await db.query(
    `SELECT DISTINCT cp.id 
     FROM candidate_profiles cp
     JOIN candidacies c ON cp.id = c.candidate_id
     JOIN races r ON c.race_id = r.id
     JOIN offices o ON r.office_id = o.id
     WHERE LOWER(cp.display_name) = LOWER($1) AND o.state = $2
     LIMIT 1`,
    [name, state]
  );
  
  if (result.rows.length > 0) {
    return result.rows[0].id;
  }

  // Try fuzzy match
  result = await db.query(
    `SELECT DISTINCT cp.id 
     FROM candidate_profiles cp
     JOIN candidacies c ON cp.id = c.candidate_id
     JOIN races r ON c.race_id = r.id
     JOIN offices o ON r.office_id = o.id
     WHERE o.state = $2 AND LOWER(cp.display_name) LIKE LOWER($1)
     LIMIT 1`,
    [`%${name}%`, state]
  );
  
  return result.rows[0]?.id || null;
}

/**
 * Insert individual voting record
 */
async function insertVotingRecord(db, candidateId, voteEventId, billId, vote, voterId, voteDate, billName) {
  try {
    await db.query(`
      INSERT INTO voting_records (
        candidate_id, external_vote_id, bill_id, bill_name, vote, vote_date, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT DO NOTHING
    `, [candidateId, voteEventId, billId, billName, vote, voteDate, 'openstates']);
    return true;
  } catch (err) {
    // Ignore duplicate errors
    if (!err.message.includes('duplicate')) {
      console.error(`Error inserting vote:`, err.message);
    }
    return false;
  }
}

/**
 * Insert bill sponsorship
 */
async function insertSponsorship(db, candidateId, billId, billData, sponsorship) {
  try {
    await db.query(`
      INSERT INTO bill_sponsorships (
        candidate_id, bill_id, sponsorship_type, bill_number, bill_title,
        bill_state, bill_session, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (candidate_id, bill_id, sponsorship_type) DO NOTHING
    `, [
      candidateId,
      billId,
      sponsorship.primary ? 'primary' : 'cosponsor',
      billData.billNumber,
      billData.title,
      billData.state,
      billData.session,
      'open_states'
    ]);
    return true;
  } catch (err) {
    if (!err.message.includes('duplicate')) {
      console.error(`Error inserting sponsorship:`, err.message);
    }
    return false;
  }
}

/**
 * Process a single bill with votes and sponsorships
 */
async function processBill(db, bill, state, stats) {
  const billData = client.transformBill(bill);
  billData.state = state.toUpperCase();

  // Upsert bill
  const billResult = await upsertBill(db, billData);
  const billId = billResult.id;

  if (billResult.created) {
    stats.billsCreated++;
  } else {
    stats.billsUpdated++;
  }

  // Process sponsorships
  for (const sponsorship of billData.sponsorships) {
    if (sponsorship.personId) {
      const candidateId = await findCandidateByOpenStatesId(db, sponsorship.personId);
      if (candidateId) {
        await insertSponsorship(db, candidateId, billId, billData, sponsorship);
        stats.sponsorshipsCreated++;
      }
    }
  }

  // Process vote events
  for (const vote of billData.votes) {
    const voteResult = await upsertVoteEvent(db, vote, billId);
    const voteEventId = voteResult.id;

    if (voteResult.created) {
      stats.voteEventsCreated++;
    }

    // Process individual votes
    for (const individualVote of vote.individualVotes) {
      let candidateId = null;

      // Try to find by Open States ID first
      if (individualVote.voterId) {
        candidateId = await findCandidateByOpenStatesId(db, individualVote.voterId);
      }

      // Fallback to name match
      if (!candidateId && individualVote.voterName) {
        candidateId = await findCandidateByName(db, individualVote.voterName, state.toUpperCase());
      }

      if (candidateId) {
        const success = await insertVotingRecord(
          db, 
          candidateId, 
          vote.externalId,  // Open States vote ID
          billId, 
          individualVote.vote,
          individualVote.voterId,
          vote.voteDate,
          billData.title?.substring(0, 500)
        );
        if (success) {
          stats.votingRecordsCreated++;
        }
      } else {
        stats.unmatchedVoters++;
      }
    }
  }
}

/**
 * Main sync function
 */
async function syncBillsAndVotes(state, session = null, recentOnly = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Syncing bills and votes for ${state.toUpperCase()}`);
  console.log(`${'='.repeat(60)}\n`);

  const db = await pool.connect();
  
  const stats = {
    billsCreated: 0,
    billsUpdated: 0,
    voteEventsCreated: 0,
    votingRecordsCreated: 0,
    sponsorshipsCreated: 0,
    unmatchedVoters: 0,
    errors: 0
  };

  try {
    let bills;

    if (recentOnly) {
      // Get bills from last 90 days
      const since = new Date();
      since.setDate(since.getDate() - 90);
      bills = await client.getRecentBillsWithVotes(state, since.toISOString().split('T')[0], 200);
    } else if (session) {
      // Get bills for specific session
      bills = await client.getBillsWithVotes(state, session, { max_pages: 50 });
    } else {
      // Get recent bills directly (no session lookup needed)
      console.log(`Fetching recent bills for ${state}...`);
      const since = new Date();
      since.setDate(since.getDate() - 180); // Last 6 months
      bills = await client.getRecentBillsWithVotes(state, since.toISOString().split('T')[0], 300);
    }

    console.log(`\nFetched ${bills.length} bills`);
    console.log(`Processing bills...\n`);

    // Process each bill
    for (let i = 0; i < bills.length; i++) {
      const bill = bills[i];
      
      try {
        await processBill(db, bill, state, stats);
        
        // Progress indicator
        if ((i + 1) % 10 === 0 || i === bills.length - 1) {
          console.log(`  Processed ${i + 1}/${bills.length} bills`);
        }
      } catch (err) {
        console.error(`Error processing bill ${bill.identifier}:`, err.message);
        stats.errors++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Sync Complete for ${state.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Bills created:         ${stats.billsCreated}`);
    console.log(`Bills updated:         ${stats.billsUpdated}`);
    console.log(`Vote events created:   ${stats.voteEventsCreated}`);
    console.log(`Voting records created:${stats.votingRecordsCreated}`);
    console.log(`Sponsorships created:  ${stats.sponsorshipsCreated}`);
    console.log(`Unmatched voters:      ${stats.unmatchedVoters}`);
    console.log(`Errors:                ${stats.errors}`);
    console.log(`${'='.repeat(60)}\n`);

  } finally {
    db.release();
  }

  return stats;
}

/**
 * CLI Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage:
  node sync-open-states-bills.js <STATE>           # Sync current session
  node sync-open-states-bills.js <STATE> <SESSION> # Sync specific session  
  node sync-open-states-bills.js <STATE> --recent  # Sync last 90 days only

Examples:
  node sync-open-states-bills.js WI
  node sync-open-states-bills.js WI 2023
  node sync-open-states-bills.js WI --recent
  node sync-open-states-bills.js CA,TX,NY         # Multiple states
`);
    process.exit(1);
  }

  const recentOnly = args.includes('--recent');
  const states = args[0].split(',').map(s => s.trim().toUpperCase());
  const session = !recentOnly && args[1] ? args[1] : null;

  console.log(`\nOpen States Bills/Votes Sync`);
  console.log(`States: ${states.join(', ')}`);
  console.log(`Session: ${session || (recentOnly ? 'Last 90 days' : 'Current')}`);
  console.log(`API Key: ${process.env.OPEN_STATES_API_KEY ? 'Set' : 'MISSING!'}\n`);

  if (!process.env.OPEN_STATES_API_KEY) {
    console.error('ERROR: OPEN_STATES_API_KEY not set in environment');
    process.exit(1);
  }

  const allStats = {
    billsCreated: 0,
    billsUpdated: 0,
    voteEventsCreated: 0,
    votingRecordsCreated: 0,
    sponsorshipsCreated: 0,
    unmatchedVoters: 0,
    errors: 0
  };

  for (const state of states) {
    try {
      const stats = await syncBillsAndVotes(state, session, recentOnly);
      
      // Accumulate stats
      for (const key of Object.keys(allStats)) {
        allStats[key] += stats[key] || 0;
      }
    } catch (err) {
      console.error(`Error syncing ${state}:`, err.message);
      allStats.errors++;
    }
  }

  if (states.length > 1) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TOTAL ACROSS ALL STATES`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Bills created:         ${allStats.billsCreated}`);
    console.log(`Bills updated:         ${allStats.billsUpdated}`);
    console.log(`Vote events created:   ${allStats.voteEventsCreated}`);
    console.log(`Voting records created:${allStats.votingRecordsCreated}`);
    console.log(`Sponsorships created:  ${allStats.sponsorshipsCreated}`);
    console.log(`Unmatched voters:      ${allStats.unmatchedVoters}`);
    console.log(`Errors:                ${allStats.errors}`);
    console.log(`${'='.repeat(60)}\n`);
  }

  await pool.end();
  console.log('Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});