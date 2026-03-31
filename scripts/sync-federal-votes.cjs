#!/usr/bin/env node

/**
 * Sync federal voting data from ProPublica Congress API
 *
 * Usage:
 *   node scripts/sync-federal-votes.js
 *   node scripts/sync-federal-votes.js --congress=119 --limit=5 --dry-run
 *
 * Required env vars:
 *   DATABASE_URL          — PostgreSQL connection string
 *   PROPUBLICA_API_KEY    — ProPublica Congress API key
 *
 * Optional env vars:
 *   OPENSECRETS_API_KEY   — OpenSecrets API key for donor data sync
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = { congress: 119, limit: 20, dryRun: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--congress=')) {
      args.congress = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--limit=')) {
      args.limit = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Topic tag mapping
// ---------------------------------------------------------------------------

const TOPIC_RULES = [
  { pattern: /healthcare|medicare|medicaid|drug/i, tag: 'healthcare' },
  { pattern: /environment|climate|epa|emission/i, tag: 'environment' },
  { pattern: /veteran|va /i, tag: 'veterans' },
  { pattern: /tax|budget|appropriation|debt|deficit/i, tag: 'fiscal' },
  { pattern: /defense|military|armed forces/i, tag: 'defense' },
  { pattern: /fraud|corruption|ethics/i, tag: 'fraud' },
  { pattern: /lobby/i, tag: 'lobbying' },
  { pattern: /gun|firearm|second amendment/i, tag: 'guns' },
  { pattern: /immigration|border/i, tag: 'immigration' },
];

function detectTopics(text) {
  if (!text) return ['other'];
  const matched = TOPIC_RULES
    .filter(r => r.pattern.test(text))
    .map(r => r.tag);
  return matched.length > 0 ? [...new Set(matched)] : ['other'];
}

// ---------------------------------------------------------------------------
// ProPublica helpers
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.propublica.org/congress/v1';

function ppGet(url) {
  return axios.get(url, {
    headers: { 'X-API-Key': process.env.PROPUBLICA_API_KEY },
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

async function findVoteEventByExternalId(externalId) {
  const { rows } = await pool.query(
    'SELECT id FROM vote_events WHERE external_id = $1',
    [externalId]
  );
  return rows[0] || null;
}

async function findOrCreateBill(vote, dryRun) {
  const bill = vote.bill || {};
  if (!bill.bill_id) return null;

  const billNumber = bill.bill_id; // e.g. "hr1234"
  const externalId = bill.bill_uri || bill.bill_id;

  // Check if bill already exists
  const { rows: existing } = await pool.query(
    'SELECT id FROM bills WHERE external_id = $1 OR bill_number = $2 LIMIT 1',
    [externalId, billNumber]
  );

  if (existing.length > 0) return existing[0].id;

  const titleText = bill.title || bill.short_title || bill.bill_id;
  const categories = detectTopics(`${titleText} ${bill.latest_major_action || ''}`);

  if (dryRun) {
    console.log(`  [dry-run] Would create bill: ${billNumber} — ${titleText}`);
    return null;
  }

  const { rows: inserted } = await pool.query(
    `INSERT INTO bills (external_id, bill_number, title, description, chamber, session, categories, source, source_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'propublica', $8)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      externalId,
      billNumber,
      titleText,
      bill.latest_major_action || null,
      vote.chamber ? vote.chamber.toLowerCase() : null,
      vote.congress ? String(vote.congress) : null,
      categories,
      bill.bill_uri || null,
    ]
  );

  // If ON CONFLICT hit, fetch existing
  if (inserted.length === 0) {
    const { rows: refetch } = await pool.query(
      'SELECT id FROM bills WHERE external_id = $1 OR bill_number = $2 LIMIT 1',
      [externalId, billNumber]
    );
    return refetch[0]?.id || null;
  }

  return inserted[0].id;
}

async function createVoteEvent(vote, billId, dryRun) {
  const externalId = vote.vote_uri;
  const motionText = vote.description || vote.question || '';
  const chamber = vote.chamber ? vote.chamber.toLowerCase() : null;
  const voteDate = vote.date;
  const result = vote.result;
  const yesCount = vote.total?.yes ?? 0;
  const noCount = vote.total?.no ?? 0;
  const abstainCount = vote.total?.not_voting ?? 0;
  const sourceUrl = vote.vote_uri || vote.url || null;

  if (dryRun) {
    console.log(`  [dry-run] Would create vote_event: ${externalId} — ${motionText}`);
    return null;
  }

  const { rows } = await pool.query(
    `INSERT INTO vote_events (bill_id, external_id, motion_text, chamber, vote_date, result, yes_count, no_count, abstain_count, source, source_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'propublica', $10)
     RETURNING id`,
    [billId, externalId, motionText, chamber, voteDate, result, yesCount, noCount, abstainCount, sourceUrl]
  );

  return rows[0].id;
}

async function findCandidateByMemberId(memberId) {
  // ProPublica member_id is typically the Bioguide ID which maps to congress_gov_id or govtrack_id
  const { rows } = await pool.query(
    `SELECT id FROM candidate_profiles
     WHERE govtrack_id = $1 OR congress_gov_id = $1
     LIMIT 1`,
    [memberId]
  );
  return rows[0]?.id || null;
}

async function upsertVotingRecord(candidateId, voteEventId, billId, votePosition, memberId, dryRun) {
  if (dryRun) {
    console.log(`    [dry-run] Would record vote: member=${memberId} vote=${votePosition}`);
    return;
  }

  await pool.query(
    `INSERT INTO voting_records (candidate_id, vote_event_id, bill_id, vote, source, external_voter_id)
     VALUES ($1, $2, $3, $4, 'propublica', $5)
     ON CONFLICT (candidate_id, vote_event_id) DO UPDATE SET vote = EXCLUDED.vote`,
    [candidateId, voteEventId, billId, votePosition, memberId]
  );
}

// ---------------------------------------------------------------------------
// Fetch individual vote roll call (to get per-member positions)
// ---------------------------------------------------------------------------

async function fetchVotePositions(voteUri) {
  try {
    const res = await ppGet(voteUri);
    const voteData = res.data?.results?.votes?.vote;
    if (!voteData) return [];
    return voteData.positions || [];
  } catch (err) {
    console.error(`  Error fetching vote positions from ${voteUri}: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main sync: votes
// ---------------------------------------------------------------------------

async function syncVotes({ congress, limit, dryRun }) {
  if (!process.env.PROPUBLICA_API_KEY) {
    console.error('ERROR: PROPUBLICA_API_KEY is not set');
    return { votes: 0, records: 0, bills: 0, error: true };
  }

  let totalVotes = 0;
  let totalRecords = 0;
  let totalBills = 0;

  for (let offset = 0; offset < limit; offset++) {
    const url = `${API_BASE}/${congress}/both/votes/recent.json?offset=${offset * 20}`;
    console.log(`Fetching vote page ${offset + 1}/${limit}: ${url}`);

    let votes;
    try {
      const res = await ppGet(url);
      votes = res.data?.results?.votes;
    } catch (err) {
      if (err.response?.status === 429) {
        console.warn('Rate limited — waiting 5 seconds...');
        await sleep(5000);
        offset--; // retry same page
        continue;
      }
      console.error(`Error fetching votes page ${offset}: ${err.message}`);
      break;
    }

    if (!votes || votes.length === 0) {
      console.log('No more votes to fetch.');
      break;
    }

    for (const vote of votes) {
      const externalId = vote.vote_uri;
      if (!externalId) continue;

      // Skip if already synced
      const existing = await findVoteEventByExternalId(externalId);
      if (existing) {
        continue;
      }

      // Find or create bill
      let billId = null;
      if (vote.bill && vote.bill.bill_id) {
        billId = await findOrCreateBill(vote, dryRun);
        if (billId && !dryRun) totalBills++;
      }

      // Create vote event
      const voteEventId = await createVoteEvent(vote, billId, dryRun);
      totalVotes++;

      if (dryRun || !voteEventId) continue;

      // Fetch per-member positions
      const positions = await fetchVotePositions(externalId);
      for (const pos of positions) {
        const memberId = pos.member_id;
        if (!memberId) continue;

        const candidateId = await findCandidateByMemberId(memberId);
        if (!candidateId) continue;

        const votePosition = (pos.vote_position || '').toLowerCase().replace(/\s+/g, '_');
        // Normalize: "Yes" → "yes", "No" → "no", "Not Voting" → "not_voting"
        await upsertVotingRecord(candidateId, voteEventId, billId, votePosition, memberId, dryRun);
        totalRecords++;
      }

      // Small delay to respect rate limits
      await sleep(1000);
    }

    // Delay between pages
    await sleep(1000);
  }

  return { votes: totalVotes, records: totalRecords, bills: totalBills, error: false };
}

// ---------------------------------------------------------------------------
// Optional: sync donor data from OpenSecrets
// ---------------------------------------------------------------------------

async function syncDonorData({ dryRun }) {
  if (!process.env.OPENSECRETS_API_KEY) {
    console.warn('WARNING: OPENSECRETS_API_KEY not set — skipping donor data sync.');
    return;
  }

  console.log('\n--- Syncing donor data from OpenSecrets ---');

  // Fetch candidates that have a congress_gov_id (federal legislators)
  const { rows: candidates } = await pool.query(
    `SELECT id, congress_gov_id, govtrack_id
     FROM candidate_profiles
     WHERE congress_gov_id IS NOT NULL OR govtrack_id IS NOT NULL`
  );

  console.log(`Found ${candidates.length} federal candidates for donor lookup.`);

  let synced = 0;
  for (const candidate of candidates) {
    const cid = candidate.congress_gov_id || candidate.govtrack_id;
    if (!cid) continue;

    try {
      const url = `https://www.opensecrets.org/api/?method=candContrib&cid=${cid}&cycle=2024&apikey=${process.env.OPENSECRETS_API_KEY}&output=json`;

      if (dryRun) {
        console.log(`  [dry-run] Would fetch donor data for CID=${cid}`);
        synced++;
        continue;
      }

      const res = await axios.get(url);
      const contributors = res.data?.response?.contributors?.contributor;
      if (contributors && Array.isArray(contributors)) {
        // Log summary — actual storage would depend on a donors table
        console.log(`  ${cid}: ${contributors.length} top contributors`);
        synced++;
      }
    } catch (err) {
      console.error(`  Error fetching donors for ${cid}: ${err.message}`);
    }

    await sleep(1000); // Rate limit
  }

  console.log(`Donor sync complete: processed ${synced} candidates.`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  console.log('=== Federal Vote Sync ===');
  console.log(`Congress: ${args.congress}`);
  console.log(`Max pages: ${args.limit}`);
  console.log(`Dry run: ${args.dryRun}`);
  console.log('');

  const result = await syncVotes(args);

  if (result.error) {
    process.exit(1);
  }

  console.log(`\nSynced ${result.votes} votes, ${result.records} voting records, ${result.bills} bills`);

  // Optional donor data sync
  await syncDonorData(args);

  console.log('\nDone.');
}

main()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    pool.end();
    process.exit(1);
  });
