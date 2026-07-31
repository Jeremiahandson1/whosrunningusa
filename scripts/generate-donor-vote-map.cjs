#!/usr/bin/env node

/**
 * Generate Donor-Vote Connection Map
 *
 * Uses Claude to analyze the relationship between a politician's donor
 * industries and their specific votes. Determines whether votes align with,
 * contradict, or are neutral to donor interests.
 *
 * Cost controls: requests go through the Message Batches API (50% of
 * synchronous pricing), and each politician is marked in ai_analysis_state
 * when submitted so a politician whose analysis found zero connections is
 * not re-analyzed every night (re-analysis happens after 30 days, when new
 * votes/donor data will have accumulated).
 *
 * Usage:
 *   node scripts/generate-donor-vote-map.cjs
 *   node scripts/generate-donor-vote-map.cjs --dry-run
 *   node scripts/generate-donor-vote-map.cjs --politician-id=<uuid>
 *   node scripts/generate-donor-vote-map.cjs --limit=20 --poll-minutes=5
 *
 * Required env vars:
 *   DATABASE_URL
 *   ANTHROPIC_API_KEY
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
let Anthropic; try { Anthropic = require('@anthropic-ai/sdk'); } catch(_) { console.log('Skipping: @anthropic-ai/sdk not installed'); process.exit(0); }
const { extractJson, collectPending, submitAndPoll, parsePollMs } = require('./lib/ai-batch.cjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
if (!process.env.ANTHROPIC_API_KEY) { console.log("Skipping: ANTHROPIC_API_KEY not set"); process.exit(0); }
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-5';
const JOB_TYPE = 'donor-map';
const REANALYZE_AFTER = '30 days';

function parseArgs() {
  const args = { dryRun: false, politicianId: null, limit: 30, pollMs: parsePollMs(process.argv) };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--politician-id=')) args.politicianId = arg.split('=')[1];
    else if (arg.startsWith('--limit=')) args.limit = parseInt(arg.split('=')[1], 10);
  }
  return args;
}

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
  } else {
    // Skip anyone analyzed recently — a previous run that found zero
    // connections still counts as analyzed (ai_analysis_state), otherwise
    // the same politicians are re-analyzed (and re-billed) every night.
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM donor_vote_connections dvc WHERE dvc.politician_id = cp.id
    )`);
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM ai_analysis_state s
      WHERE s.politician_id = cp.id AND s.job_type = '${JOB_TYPE}'
        AND s.analyzed_at > NOW() - INTERVAL '${REANALYZE_AFTER}'
    )`);
  }

  // Only politicians with donor data and BILL-LINKED votes — unlinked
  // procedural votes ("On Passage" with no bill) carry no subject matter, so
  // the model correctly returns [] for them and the state marker then blocks
  // re-analysis for 30 days. Don't burn a slot until there's real input.
  const { rows } = await pool.query(
    `SELECT cp.id, cp.display_name, cp.party_affiliation, cp.fec_office_type, cp.fec_state
     FROM candidate_profiles cp
     WHERE ${conditions.join(' AND ')}
       AND EXISTS (SELECT 1 FROM politician_donor_industries pdi WHERE pdi.politician_id = cp.id)
       AND EXISTS (SELECT 1 FROM voting_records vr
                   JOIN vote_events ve ON ve.id = vr.vote_event_id
                   WHERE vr.candidate_id = cp.id AND ve.bill_id IS NOT NULL)
     ORDER BY (SELECT MAX(s.analyzed_at) FROM ai_analysis_state s
               WHERE s.politician_id = cp.id AND s.job_type = '${JOB_TYPE}') ASC NULLS FIRST,
              cp.display_name
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
     JOIN bills b ON ve.bill_id = b.id
     WHERE vr.candidate_id = $1
       AND b.title IS NOT NULL
     ORDER BY ve.vote_date DESC
     LIMIT 30`,
    [politicianId]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Batch request construction / result handling
// ---------------------------------------------------------------------------

function buildRequest(politician, donors, votes) {
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

  return {
    custom_id: politician.id,
    params: {
      model: MODEL,
      // Sonnet 5 thinks by default and max_tokens caps thinking + reply
      // together, so leave headroom or the JSON truncates.
      max_tokens: 8192,
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
    }
  };
}

async function handleResult(politicianId, text) {
  const connections = extractJson(text);
  if (!Array.isArray(connections)) throw new Error('non-array response');
  if (connections.length === 0) return;

  // Re-derive lookup context (batch results can arrive on a later run)
  const [donors, votes] = await Promise.all([
    getDonorIndustries(politicianId),
    getVotingRecordWithBills(politicianId),
  ]);

  for (const conn of connections) {
    const donorMatch = donors.find(d =>
      d.industry_name.toLowerCase() === conn.industry_name?.toLowerCase()
    );
    const voteMatch = votes.find(v => v.bill_number === conn.bill_number);

    await pool.query(
      `INSERT INTO donor_vote_connections
         (politician_id, donor_industry_id, industry_name, donation_total,
          vote_event_id, bill_id, vote_cast, correlation_type,
          description, ai_analysis, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        politicianId,
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
  }
  console.log(`    ${politicianId}: ${connections.length} connection(s)`);
}

async function markAnalyzed(politicianIds) {
  if (politicianIds.length === 0) return;
  await pool.query(
    `INSERT INTO ai_analysis_state (politician_id, job_type, analyzed_at)
     SELECT unnest($1::uuid[]), $2, NOW()
     ON CONFLICT (politician_id, job_type) DO UPDATE SET analyzed_at = NOW()`,
    [politicianIds, JOB_TYPE]
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  console.log('=== Donor-Vote Connection Map Generator ===');
  console.log(`Model: ${MODEL} (batched)`);
  console.log(`Dry run: ${args.dryRun}`);
  console.log(`Limit: ${args.limit}`);
  if (args.politicianId) console.log(`Politician: ${args.politicianId}`);
  console.log('');

  // 1. Collect batches from earlier runs
  let collectedOk = 0;
  if (!args.dryRun) {
    const collected = await collectPending({ pool, anthropic, jobType: JOB_TYPE, onResult: handleResult });
    collectedOk = collected.ok;
    if (collected.ok || collected.failed) {
      console.log(`Collected from earlier batches: ${collected.ok} ok, ${collected.failed} failed\n`);
    }
  }

  // 2. Build this run's requests
  const politicians = await getPoliticiansWithDonorsAndVotes(args);
  console.log(`Found ${politicians.length} politicians to process.\n`);

  if (politicians.length === 0) {
    console.log('Nothing to submit.');
    console.log(`\n=== Summary ===\nCollected: ${collectedOk}\nSubmitted: 0`);
    return;
  }

  const requests = [];
  for (const politician of politicians) {
    const [donors, votes] = await Promise.all([
      getDonorIndustries(politician.id),
      getVotingRecordWithBills(politician.id),
    ]);
    if (donors.length === 0 || votes.length === 0) {
      console.log(`  ${politician.display_name}: skipped — insufficient data`);
      continue;
    }
    console.log(`  ${politician.display_name}: ${donors.length} donors, ${votes.length} votes`);
    requests.push(buildRequest(politician, donors, votes));
  }

  if (args.dryRun) {
    console.log(`\n=== Summary ===\n[dry-run] Would submit ${requests.length} requests`);
    return;
  }

  // 3. Submit, mark analyzed, poll
  const { collected } = await submitAndPoll({
    pool, anthropic, jobType: JOB_TYPE, requests, pollMs: args.pollMs, onResult: handleResult,
  });
  await markAnalyzed(requests.map(r => r.custom_id));

  console.log('\n=== Summary ===');
  console.log(`Collected from earlier batches: ${collectedOk}`);
  console.log(`Submitted: ${requests.length}`);
  if (collected) {
    console.log(`Analyzed this run: ${collected.ok} (${collected.failed} failed)`);
  } else {
    console.log('Batch still processing — next run will collect the results.');
  }
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
