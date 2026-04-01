#!/usr/bin/env node

/**
 * Scan Conflicts of Interest
 *
 * Cross-references politicians' stock trades with their voting records using
 * Claude AI to identify potential conflicts of interest. Flagged conflicts are
 * stored unpublished for admin review.
 *
 * Usage:
 *   node scripts/scan-conflicts.js
 *   node scripts/scan-conflicts.js --dry-run
 *   node scripts/scan-conflicts.js --politician-id <uuid>
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
let Anthropic; try { Anthropic = require('@anthropic-ai/sdk'); } catch(_) { console.log('Skipping: @anthropic-ai/sdk not installed'); process.exit(0); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
if (!process.env.ANTHROPIC_API_KEY) { console.log("Skipping: ANTHROPIC_API_KEY not set"); process.exit(0); }
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Parse CLI flags
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const politicianIdIdx = args.indexOf('--politician-id');
const singlePoliticianId = politicianIdIdx !== -1 ? args[politicianIdIdx + 1] : null;

const CLAUDE_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get politicians who have both trades and voting records in the last year.
 */
async function getPoliticiansWithTradesAndVotes() {
  const params = [];
  let whereClause = '';

  if (singlePoliticianId) {
    whereClause = 'AND cp.id = $1';
    params.push(singlePoliticianId);
  }

  const { rows } = await pool.query(
    `SELECT DISTINCT cp.id, cp.display_name, cp.party_affiliation,
            cp.fec_office_type, cp.fec_state
     FROM candidate_profiles cp
     WHERE cp.id IN (
       SELECT politician_id FROM official_trades
       WHERE trade_date >= NOW() - INTERVAL '1 year'
     )
     AND cp.id IN (
       SELECT vr.candidate_id FROM voting_records vr
       JOIN vote_events ve ON ve.id = vr.vote_event_id
       WHERE ve.vote_date >= NOW() - INTERVAL '1 year'
     )
     ${whereClause}
     ORDER BY cp.display_name`,
    params
  );
  return rows;
}

/**
 * Get trades from the last year for a politician.
 */
async function getTrades(politicianId) {
  const { rows } = await pool.query(
    `SELECT id, ticker, asset_name, trade_type,
            amount_range_low, amount_range_high, trade_date, disclosure_date
     FROM official_trades
     WHERE politician_id = $1
       AND trade_date >= NOW() - INTERVAL '1 year'
     ORDER BY trade_date DESC`,
    [politicianId]
  );
  return rows;
}

/**
 * Get votes from the last year for a politician, with bill details.
 */
async function getVotes(politicianId) {
  const { rows } = await pool.query(
    `SELECT vr.id AS voting_record_id, vr.vote, ve.id AS vote_event_id,
            ve.vote_date, ve.description AS vote_description,
            b.id AS bill_id, b.title AS bill_title,
            b.summary AS bill_summary, b.categories AS bill_categories
     FROM voting_records vr
     JOIN vote_events ve ON ve.id = vr.vote_event_id
     LEFT JOIN bills b ON b.id = ve.bill_id
     WHERE vr.candidate_id = $1
       AND ve.vote_date >= NOW() - INTERVAL '1 year'
     ORDER BY ve.vote_date DESC`,
    [politicianId]
  );
  return rows;
}

/**
 * Find votes within 90 days of a trade (before or after).
 */
function findNearbyVotes(trade, votes) {
  const tradeDate = new Date(trade.trade_date);
  return votes.filter((v) => {
    const voteDate = new Date(v.vote_date);
    const diffDays = Math.abs((voteDate - tradeDate) / (1000 * 60 * 60 * 24));
    return diffDays <= 90;
  });
}

/**
 * Ask Claude to analyze a trade-vote pair for conflict of interest.
 */
async function analyzeConflict(politician, trade, vote) {
  const amountDesc = trade.amount_range_low && trade.amount_range_high
    ? `$${Number(trade.amount_range_low).toLocaleString()}-$${Number(trade.amount_range_high).toLocaleString()}`
    : 'undisclosed amount';

  const tradeDate = new Date(trade.trade_date);
  const voteDate = new Date(vote.vote_date);
  const timeGapDays = Math.round((voteDate - tradeDate) / (1000 * 60 * 60 * 24));
  const timing = timeGapDays > 0
    ? `${timeGapDays} days after the trade`
    : timeGapDays < 0
      ? `${Math.abs(timeGapDays)} days before the trade`
      : 'on the same day as the trade';

  const prompt = `This politician traded ${trade.ticker || trade.asset_name} (${trade.trade_type}, ${amountDesc}) on ${trade.trade_date}. They voted ${vote.vote} on "${vote.bill_title || vote.vote_description}" on ${vote.vote_date} (${timing}).

Politician: ${politician.display_name} (${politician.party_affiliation || 'Unknown party'}, ${politician.fec_state || 'Unknown state'})
Bill summary: ${vote.bill_summary || 'No summary available'}
Bill categories: ${vote.bill_categories ? vote.bill_categories.join(', ') : 'None'}

Is there a potential conflict of interest? Return JSON only:
{
  "is_conflict": boolean,
  "severity": "low" | "medium" | "high" | "critical",
  "description": "one sentence like 'Senator X voted yes on pharmaceutical bill 3 weeks after buying $180K in Pfizer stock'",
  "confidence": 0-1,
  "reasoning": "string explaining your analysis"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'You are a nonpartisan financial conflict-of-interest analyst. Evaluate whether a politician\'s stock trade and vote suggest a conflict of interest. Be rigorous — only flag genuine concerns. Return JSON only, no markdown fences.',
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim();

  // Extract JSON — handle possible markdown fences
  let jsonStr = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  const result = JSON.parse(jsonStr);
  result._time_gap_days = timeGapDays;
  return result;
}

/**
 * Insert a conflict flag into the database.
 */
async function insertConflict(politicianId, trade, vote, analysis) {
  await pool.query(
    `INSERT INTO conflict_of_interest_flags
       (politician_id, trade_id, vote_event_id, bill_id,
        trade_ticker, trade_asset_name, trade_type,
        trade_amount_range_low, trade_amount_range_high,
        trade_date, vote_date, time_gap_days,
        description, severity, ai_reasoning, confidence,
        verified, published)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, FALSE, FALSE)`,
    [
      politicianId,
      trade.id,
      vote.vote_event_id,
      vote.bill_id || null,
      trade.ticker,
      trade.asset_name,
      trade.trade_type,
      trade.amount_range_low,
      trade.amount_range_high,
      trade.trade_date,
      vote.vote_date,
      analysis._time_gap_days,
      analysis.description,
      analysis.severity,
      analysis.reasoning,
      analysis.confidence
    ]
  );
}

async function main() {
  console.log('=== Conflict of Interest Scanner ===');
  if (dryRun) console.log('DRY RUN — no database writes will occur.');
  if (singlePoliticianId) console.log(`Processing single politician: ${singlePoliticianId}`);

  const politicians = await getPoliticiansWithTradesAndVotes();
  console.log(`Found ${politicians.length} politician(s) with both trades and votes in the last year.`);

  if (politicians.length === 0) {
    console.log('No politicians to process. Exiting.');
    await pool.end();
    process.exit(0);
  }

  let totalTradesAnalyzed = 0;
  let totalConflictsFound = 0;
  let totalClaudeCallsMade = 0;
  let totalErrors = 0;

  for (const politician of politicians) {
    console.log(`\nProcessing: ${politician.display_name} (${politician.id})`);

    try {
      const [trades, votes] = await Promise.all([
        getTrades(politician.id),
        getVotes(politician.id)
      ]);

      console.log(`  Trades: ${trades.length}, Votes: ${votes.length}`);

      for (const trade of trades) {
        const nearbyVotes = findNearbyVotes(trade, votes);

        if (nearbyVotes.length === 0) {
          continue;
        }

        totalTradesAnalyzed++;
        console.log(`  Trade: ${trade.ticker || trade.asset_name} (${trade.trade_type}) on ${trade.trade_date} — ${nearbyVotes.length} nearby vote(s)`);

        for (const vote of nearbyVotes) {
          try {
            // Rate limit: 2 second delay between Claude calls
            if (totalClaudeCallsMade > 0) {
              await sleep(CLAUDE_DELAY_MS);
            }

            const analysis = await analyzeConflict(politician, trade, vote);
            totalClaudeCallsMade++;

            if (analysis.is_conflict) {
              totalConflictsFound++;
              console.log(`    CONFLICT (${analysis.severity}, confidence ${analysis.confidence}): ${analysis.description}`);

              if (!dryRun) {
                await insertConflict(politician.id, trade, vote, analysis);
                console.log('    Inserted into database (unpublished).');
              } else {
                console.log('    [DRY RUN] Would insert conflict flag.');
              }
            } else {
              console.log(`    No conflict: ${trade.ticker || trade.asset_name} vs "${(vote.bill_title || '').substring(0, 60)}"`);
            }
          } catch (err) {
            if (err instanceof SyntaxError) {
              console.log(`    Skipped — Claude returned invalid JSON: ${err.message}`);
            } else {
              console.error(`    Error analyzing trade-vote pair: ${err.message}`);
            }
            totalErrors++;
          }
        }
      }
    } catch (err) {
      console.error(`  Error processing ${politician.display_name}: ${err.message}`);
      totalErrors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Politicians processed: ${politicians.length}`);
  console.log(`Trades with nearby votes analyzed: ${totalTradesAnalyzed}`);
  console.log(`Claude API calls made: ${totalClaudeCallsMade}`);
  console.log(`Conflicts found: ${totalConflictsFound}`);
  console.log(`Errors: ${totalErrors}`);

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Fatal error:', err.message);
  await pool.end();
  process.exit(1);
});
