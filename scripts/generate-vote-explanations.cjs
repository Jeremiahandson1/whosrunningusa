#!/usr/bin/env node

/**
 * Generate Plain Language Vote Explanations
 *
 * Uses Claude to generate 8th-grade reading level explanations for every
 * vote event and bill in the database. Explanations cover what the bill does,
 * what the vote means, and who it affects.
 *
 * Cost controls: requests go through the Message Batches API (50% of
 * synchronous pricing) on claude-haiku-4-5 — this is a simple summarization
 * task. A batch that doesn't finish within the poll budget is collected by
 * the next run via ai_batch_jobs.
 *
 * Usage:
 *   node scripts/generate-vote-explanations.cjs
 *   node scripts/generate-vote-explanations.cjs --dry-run
 *   node scripts/generate-vote-explanations.cjs --bill-id=<uuid>
 *   node scripts/generate-vote-explanations.cjs --limit=50 --poll-minutes=5
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

const MODEL = 'claude-haiku-4-5';
const JOB_TYPE = 'explanations';

function parseArgs() {
  const args = { dryRun: false, billId: null, limit: 100, pollMs: parsePollMs(process.argv) };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--bill-id=')) args.billId = arg.split('=')[1];
    else if (arg.startsWith('--limit=')) args.limit = parseInt(arg.split('=')[1], 10);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Fetch bills/votes that need explanations
// ---------------------------------------------------------------------------

async function getBillsNeedingExplanations(args) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (args.billId) {
    conditions.push(`b.id = $${paramIndex}`);
    params.push(args.billId);
    paramIndex++;
  }

  const { rows } = await pool.query(
    `SELECT b.id as bill_id, b.title, b.bill_number, b.description, b.summary,
            b.categories, b.chamber, b.session,
            ve.id as vote_event_id, ve.motion_text, ve.vote_date, ve.result,
            ve.yes_count, ve.no_count, ve.abstain_count
     FROM bills b
     LEFT JOIN vote_events ve ON ve.bill_id = b.id
     WHERE NOT EXISTS (
       SELECT 1 FROM vote_explanations ex
       WHERE (ex.bill_id = b.id) OR (ex.vote_event_id = ve.id AND ve.id IS NOT NULL)
     )
     ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}
     ORDER BY ve.vote_date DESC NULLS LAST
     LIMIT $${paramIndex}`,
    [...params, args.limit]
  );

  return rows;
}

async function getVoteEventsNeedingExplanations(args) {
  // Bill-less vote events — but only ones whose motion text names a bill or
  // has some substance. Bare "On Passage" / "On Agreeing to the Amendment"
  // rows have nothing to explain and produce "details not available" filler.
  const { rows } = await pool.query(
    `SELECT ve.id as vote_event_id, ve.motion_text, ve.vote_date, ve.result,
            ve.yes_count, ve.no_count, ve.abstain_count, ve.chamber
     FROM vote_events ve
     WHERE ve.bill_id IS NULL
       AND ve.motion_text ~* '\\m(H|S)\\.?\\s?(J|CON)?\\.?\\s?(R|RES)|\\mH\\s?R\\s?\\d|nomination'
       AND NOT EXISTS (
         SELECT 1 FROM vote_explanations ex WHERE ex.vote_event_id = ve.id
       )
     ORDER BY ve.vote_date DESC
     LIMIT $1`,
    [args.limit]
  );

  return rows;
}

// ---------------------------------------------------------------------------
// Batch request construction / result handling
// ---------------------------------------------------------------------------

function buildRequest(item) {
  const hasBill = !!item.bill_number;
  const context = hasBill
    ? `Bill: ${item.bill_number} — ${item.title}\nDescription: ${item.description || item.summary || 'No description available'}\nCategories: ${(item.categories || []).join(', ') || 'N/A'}\nChamber: ${item.chamber || 'N/A'}`
    : `Vote: ${item.motion_text || 'Procedural vote'}\nChamber: ${item.chamber || 'N/A'}`;

  const voteContext = item.vote_date
    ? `\nVote date: ${item.vote_date}\nResult: ${item.result || 'N/A'}\nYes: ${item.yes_count || 0}, No: ${item.no_count || 0}, Abstain: ${item.abstain_count || 0}`
    : '';

  // custom_id max is 64 chars, so only one uuid fits; the collect side
  // re-derives bill_id for ve_ items from vote_events.
  const customId = item.vote_event_id ? `ve_${item.vote_event_id}` : `b_${item.bill_id}`;

  return {
    custom_id: customId,
    params: {
      model: MODEL,
      max_tokens: 1024,
      system: `You are a civic educator who explains government actions in plain English at an 8th-grade reading level. No jargon. No partisan language. Short sentences. Be specific about who this affects and how. Return JSON only.`,
      messages: [
        {
          role: 'user',
          content: `Explain this ${hasBill ? 'bill and vote' : 'vote'} in plain English. Return a JSON object with these fields:
- plain_language_title: A clear, simple title (under 100 characters)
- plain_language_summary: 2-3 sentences explaining what this is about in simple terms
- what_it_means: 1-2 sentences on what the practical impact is
- who_it_affects: 1-2 sentences on which Americans are affected

${context}${voteContext}`
        }
      ]
    }
  };
}

async function handleResult(customId, text) {
  const explanation = extractJson(text);
  let voteEventId = null;
  let billId = null;

  if (customId.startsWith('ve_')) {
    voteEventId = customId.slice(3);
    const { rows } = await pool.query(`SELECT bill_id FROM vote_events WHERE id = $1`, [voteEventId]);
    billId = rows[0]?.bill_id || null;
  } else if (customId.startsWith('b_')) {
    billId = customId.slice(2);
  } else {
    throw new Error(`Unrecognized custom_id: ${customId}`);
  }

  await pool.query(
    `INSERT INTO vote_explanations
       (vote_event_id, bill_id, plain_language_title, plain_language_summary,
        what_it_means, who_it_affects, reading_level, generated_by)
     VALUES ($1, $2, $3, $4, $5, $6, 8.0, 'ai')
     ON CONFLICT DO NOTHING`,
    [
      voteEventId,
      billId,
      explanation.plain_language_title,
      explanation.plain_language_summary,
      explanation.what_it_means || null,
      explanation.who_it_affects || null,
    ]
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  console.log('=== Plain Language Vote Explanation Generator ===');
  console.log(`Model: ${MODEL} (batched)`);
  console.log(`Dry run: ${args.dryRun}`);
  console.log(`Limit: ${args.limit}`);
  if (args.billId) console.log(`Bill ID: ${args.billId}`);
  console.log('');

  // 1. Collect batches submitted by earlier runs
  let collectedOk = 0;
  if (!args.dryRun) {
    const collected = await collectPending({ pool, anthropic, jobType: JOB_TYPE, onResult: handleResult });
    collectedOk = collected.ok;
    if (collected.ok || collected.failed) {
      console.log(`Collected from earlier batches: ${collected.ok} ok, ${collected.failed} failed\n`);
    }
  }

  // 2. Fetch items still needing explanations (collect above may have shrunk this)
  const billItems = await getBillsNeedingExplanations(args);
  const voteOnlyItems = await getVoteEventsNeedingExplanations(args);
  const allItems = [...billItems, ...voteOnlyItems].slice(0, args.limit);

  console.log(`Found ${billItems.length} bills and ${voteOnlyItems.length} standalone votes needing explanations.`);
  console.log(`Submitting: ${allItems.length}\n`);

  if (allItems.length === 0) {
    console.log('Nothing to submit.');
    console.log(`\n=== Summary ===\nCollected: ${collectedOk}\nSubmitted: 0`);
    return;
  }

  // Dedupe by custom_id (a bill with several unexplained votes yields one row per vote)
  const seen = new Set();
  const requests = [];
  for (const item of allItems) {
    const req = buildRequest(item);
    if (seen.has(req.custom_id)) continue;
    seen.add(req.custom_id);
    requests.push(req);
  }

  if (args.dryRun) {
    for (const req of requests.slice(0, 10)) {
      console.log(`  [dry-run] Would submit: ${req.custom_id}`);
    }
    if (requests.length > 10) console.log(`  [dry-run] ...and ${requests.length - 10} more`);
    console.log(`\n=== Summary ===\n[dry-run] Would submit ${requests.length} requests`);
    return;
  }

  // 3. Submit and poll
  const { collected } = await submitAndPoll({
    pool, anthropic, jobType: JOB_TYPE, requests, pollMs: args.pollMs, onResult: handleResult,
  });

  console.log('\n=== Summary ===');
  console.log(`Collected from earlier batches: ${collectedOk}`);
  console.log(`Submitted: ${requests.length}`);
  if (collected) {
    console.log(`Generated this run: ${collected.ok} (${collected.failed} failed)`);
  } else {
    console.log('Batch still processing — next run will collect the results.');
  }
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
