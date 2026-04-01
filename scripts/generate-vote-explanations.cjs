#!/usr/bin/env node

/**
 * Generate Plain Language Vote Explanations
 *
 * Uses Claude to generate 8th-grade reading level explanations for every
 * vote event and bill in the database. Explanations cover what the bill does,
 * what the vote means, and who it affects.
 *
 * Usage:
 *   node scripts/generate-vote-explanations.js
 *   node scripts/generate-vote-explanations.js --dry-run
 *   node scripts/generate-vote-explanations.js --bill-id <uuid>
 *   node scripts/generate-vote-explanations.js --limit=50
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
  const args = { dryRun: false, billId: null, limit: 100 };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--bill-id=')) args.billId = arg.split('=')[1];
    else if (arg.startsWith('--limit=')) args.limit = parseInt(arg.split('=')[1], 10);
  }
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000;

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

  const where = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

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
  // Get vote events that don't have a bill (procedural votes, etc.)
  const { rows } = await pool.query(
    `SELECT ve.id as vote_event_id, ve.motion_text, ve.vote_date, ve.result,
            ve.yes_count, ve.no_count, ve.abstain_count, ve.chamber, ve.question
     FROM vote_events ve
     WHERE ve.bill_id IS NULL
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
// Claude explanation generator
// ---------------------------------------------------------------------------

async function generateExplanation(item) {
  const hasBill = !!item.bill_number;
  const context = hasBill
    ? `Bill: ${item.bill_number} — ${item.title}\nDescription: ${item.description || item.summary || 'No description available'}\nCategories: ${(item.categories || []).join(', ') || 'N/A'}\nChamber: ${item.chamber || 'N/A'}`
    : `Vote: ${item.motion_text || item.question || 'Procedural vote'}\nChamber: ${item.chamber || 'N/A'}`;

  const voteContext = item.vote_date
    ? `\nVote date: ${item.vote_date}\nResult: ${item.result || 'N/A'}\nYes: ${item.yes_count || 0}, No: ${item.no_count || 0}, Abstain: ${item.abstain_count || 0}`
    : '';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
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

  console.log('=== Plain Language Vote Explanation Generator ===');
  console.log(`Dry run: ${args.dryRun}`);
  console.log(`Limit: ${args.limit}`);
  if (args.billId) console.log(`Bill ID: ${args.billId}`);
  console.log('');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is required');
    process.exit(1);
  }

  // Fetch items needing explanations
  const billItems = await getBillsNeedingExplanations(args);
  const voteOnlyItems = await getVoteEventsNeedingExplanations(args);
  const allItems = [...billItems, ...voteOnlyItems];

  console.log(`Found ${billItems.length} bills and ${voteOnlyItems.length} standalone votes needing explanations.`);
  console.log(`Total to process: ${allItems.length}\n`);

  if (allItems.length === 0) {
    console.log('Nothing to process. All votes have explanations.');
    return;
  }

  let generated = 0;
  let errors = 0;

  for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
    const batch = allItems.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allItems.length / BATCH_SIZE);

    console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} items)`);

    for (const item of batch) {
      const label = item.bill_number || item.motion_text?.slice(0, 60) || item.vote_event_id;
      try {
        console.log(`  Processing: ${label}`);

        const explanation = await generateExplanation(item);

        if (args.dryRun) {
          console.log(`    [dry-run] Title: ${explanation.plain_language_title}`);
          console.log(`    [dry-run] Summary: ${explanation.plain_language_summary?.slice(0, 100)}...`);
          generated++;
          continue;
        }

        await pool.query(
          `INSERT INTO vote_explanations
             (vote_event_id, bill_id, plain_language_title, plain_language_summary,
              what_it_means, who_it_affects, reading_level, generated_by)
           VALUES ($1, $2, $3, $4, $5, $6, 8.0, 'ai')
           ON CONFLICT DO NOTHING`,
          [
            item.vote_event_id || null,
            item.bill_id || null,
            explanation.plain_language_title,
            explanation.plain_language_summary,
            explanation.what_it_means || null,
            explanation.who_it_affects || null,
          ]
        );

        generated++;
        console.log(`    Done: "${explanation.plain_language_title}"`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          console.warn(`    Skipped — invalid JSON from Claude for: ${label}`);
        } else {
          console.error(`    Error: ${err.message}`);
        }
        errors++;
      }
    }

    if (i + BATCH_SIZE < allItems.length) {
      console.log(`  Waiting ${BATCH_DELAY_MS}ms...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Explanations generated: ${generated}`);
  console.log(`Errors: ${errors}`);
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
