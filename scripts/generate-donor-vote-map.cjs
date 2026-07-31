#!/usr/bin/env node

/**
 * Generate Donor-Vote Connection Map
 *
 * Uses Claude to analyze the relationship between a politician's donor
 * industries and their specific votes. Determines whether votes align with,
 * contradict, or are neutral to donor interests.
 *
 * Usage:
 *   node scripts/generate-donor-vote-map.js
 *   node scripts/generate-donor-vote-map.js --dry-run
 *   node scripts/generate-donor-vote-map.js --politician-id <uuid>
 *   node scripts/generate-donor-vote-map.js --limit=20
 *
 * Required env vars:
 *   DATABASE_URL
 *   ANTHROPIC_API_KEY
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
let Anthropic; try { Anthropic = require('@anthropic-ai/sdk'); } catch(_) { console.log('Skipping: @anthropic-ai/sdk not installed'); process.exit(0); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
if (!process.env.ANTHROPIC_API_KEY) { console.log("Skipping: ANTHROPIC_API_KEY not set"); process.exit(0); }
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseArgs() {
  const args = { dryRun: false, politicianId: null, limit: 30 };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--politician-id=')) args.politicianId = arg.split('=')[1];
    else if (arg.startsWith('--limit=')) args.limit = parseInt(arg.split('=')[1], 10);
  }
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const BATCH_DELAY_MS = 2000;

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getPoliticiansWithDonorsAndVotes(args) {
  const conditions = [`cp.fec_office_type IN ('H', 'S')`];
  const params = [];
  let paramIndex = 1;

  if (args.politicianId) {
    conditions.push(`cp.id = $${paramIndex}`);
    params.push(args.politicianId);
    paramIndex++;
  }

  // Only politicians with both donor data and voting records
  const { rows } = await pool.query(
    `SELECT cp.id, cp.display_name, cp.party_affiliation, cp.fec_office_type, cp.fec_state
     FROM candidate_profiles cp
     WHERE ${conditions.join(' AND ')}
       AND EXISTS (SELECT 1 FROM politician_donor_industries pdi WHERE pdi.politician_id = cp.id)
       AND EXISTS (SELECT 1 FROM voting_records vr WHERE vr.candidate_id = cp.id)
       AND NOT EXISTS (
         SELECT 1 FROM donor_vote_connections dvc WHERE dvc.politician_id = cp.id
       )
     ORDER BY cp.display_name
     LIMIT $${paramIndex}`,
    [...params, args.limit]
  );

  return rows;
}

async function getDonorIndustries(politicianId) {
  const { rows } = await pool.query(
    `SELECT id, industry_name, total_amount, donor_count, cycle_year
     FROM politician_donor_industries
     WHERE politician_id = $1
     ORDER BY total_amount DESC
     LIMIT 10`,
    [politicianId]
  );
  return rows;
}

async function getVotingRecordWithBills(politicianId) {
  const { rows } = await pool.query(
    `SELECT vr.vote, ve.id as vote_event_id, ve.vote_date, ve.result, ve.motion_text,
            b.id as bill_id, COALESCE(b.title, ve.motion_text) as bill_title,
            b.bill_number, b.categories, b.description
     FROM voting_records vr
     JOIN vote_events ve ON vr.vote_event_id = ve.id
     LEFT JOIN bills b ON ve.bill_id = b.id
     WHERE vr.candidate_id = $1
       AND COALESCE(b.title, ve.motion_text) IS NOT NULL
     ORDER BY ve.vote_date DESC
     LIMIT 30`,
    [politicianId]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Claude analysis
// ---------------------------------------------------------------------------

async function analyzeConnections(politician, donors, votes) {
  const payload = {
    politician: {
      name: politician.display_name,
      party: politician.party_affiliation,
      chamber: politician.fec_office_type === 'H' ? 'House' : 'Senate',
      state: politician.fec_state,
    },
    top_donors: donors.map(d => ({
      industry: d.industry_name,
      total_amount: Number(d.total_amount),
      donor_count: d.donor_count,
    })),
    votes: votes.map(v => ({
      bill_number: v.bill_number,
      bill_title: v.bill_title,
      vote: v.vote,
      vote_date: v.vote_date,
      result: v.result,
      categories: v.categories,
      description: v.description,
    })),
  };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a nonpartisan campaign finance analyst. Analyze connections between campaign donors and votes. For each connection, determine if the vote aligned with, contradicted, or was neutral to the donor's likely interest. Use plain language. Return JSON only.`,
    messages: [
      {
        role: 'user',
        content: `Analyze the connections between this politician's donor industries and their specific votes. For each meaningful connection, return a JSON array of objects with:
- industry_name: the donor industry
- bill_number: the bill voted on
- vote_cast: how they voted (yes/no)
- correlation_type: "aligned" (vote favors donor), "contradicted" (vote against donor interest), or "neutral"
- description: 1-2 sentences in plain English explaining the connection (8th grade reading level)
- confidence_score: 0.0 to 1.0 how confident you are this is a real connection

Only include connections where there's a plausible relationship between the donor industry and the bill. If no connections exist, return [].

${JSON.stringify(payload)}`
      }
    ]
  });

  const text = response.content[0].text.trim();
  let jsonStr = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  return JSON.parse(jsonStr);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  console.log('=== Donor-Vote Connection Map Generator ===');
  console.log(`Dry run: ${args.dryRun}`);
  console.log(`Limit: ${args.limit}`);
  if (args.politicianId) console.log(`Politician: ${args.politicianId}`);
  console.log('');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is required');
    process.exit(1);
  }

  const politicians = await getPoliticiansWithDonorsAndVotes(args);
  console.log(`Found ${politicians.length} politicians to process.\n`);

  if (politicians.length === 0) {
    console.log('Nothing to process.');
    return;
  }

  let totalConnections = 0;
  let totalProcessed = 0;
  let totalErrors = 0;

  for (const politician of politicians) {
    try {
      console.log(`Processing: ${politician.display_name}`);

      const donors = await getDonorIndustries(politician.id);
      const votes = await getVotingRecordWithBills(politician.id);

      console.log(`  Donors: ${donors.length}, Votes: ${votes.length}`);

      if (donors.length === 0 || votes.length === 0) {
        console.log('  Skipped — insufficient data');
        continue;
      }

      const connections = await analyzeConnections(politician, donors, votes);

      if (!Array.isArray(connections)) {
        console.log('  Skipped — non-array response');
        totalErrors++;
        continue;
      }

      console.log(`  Found ${connections.length} connections`);

      for (const conn of connections) {
        // Look up donor_industry_id
        const donorMatch = donors.find(d =>
          d.industry_name.toLowerCase() === conn.industry_name?.toLowerCase()
        );

        // Look up vote_event_id and bill_id by bill_number
        const voteMatch = votes.find(v =>
          v.bill_number === conn.bill_number
        );

        if (args.dryRun) {
          console.log(`    [dry-run] ${conn.industry_name} → ${conn.bill_number}: ${conn.correlation_type} (${conn.confidence_score})`);
          totalConnections++;
          continue;
        }

        await pool.query(
          `INSERT INTO donor_vote_connections
             (politician_id, donor_industry_id, industry_name, donation_total,
              vote_event_id, bill_id, vote_cast, correlation_type,
              description, ai_analysis, confidence_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            politician.id,
            donorMatch?.id || null,
            conn.industry_name,
            donorMatch ? Number(donorMatch.total_amount) : null,
            voteMatch?.vote_event_id || null,
            voteMatch?.bill_id || null,
            conn.vote_cast || null,
            conn.correlation_type,
            conn.description || null,
            null,
            conn.confidence_score || null,
          ]
        );

        totalConnections++;
      }

      totalProcessed++;

      // Rate limit between politicians
      await sleep(BATCH_DELAY_MS);
    } catch (err) {
      if (err instanceof SyntaxError) {
        console.warn(`  Skipped — invalid JSON from Claude`);
      } else {
        console.error(`  Error: ${err.message}`);
      }
      totalErrors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Politicians processed: ${totalProcessed}`);
  console.log(`Connections mapped: ${totalConnections}`);
  console.log(`Errors: ${totalErrors}`);
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
