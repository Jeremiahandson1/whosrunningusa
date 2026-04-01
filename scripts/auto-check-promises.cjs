#!/usr/bin/env node

/**
 * AI-powered script that matches voting records against locked promises.
 *
 * Usage:
 *   node scripts/auto-check-promises.js
 *   node scripts/auto-check-promises.js --dry-run
 *
 * Required env vars:
 *   DATABASE_URL    — PostgreSQL connection string
 *   ANTHROPIC_API_KEY — Anthropic API key
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
let Anthropic; try { Anthropic = require('@anthropic-ai/sdk'); } catch(_) { console.log('Skipping: @anthropic-ai/sdk not installed'); process.exit(0); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
if (!process.env.ANTHROPIC_API_KEY) { console.log("Skipping: ANTHROPIC_API_KEY not set"); process.exit(0); }
const anthropic = new Anthropic();

const DRY_RUN = process.argv.includes('--dry-run');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Auto-checking promises against voting records${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  // Get locked promises that don't have a recent auto_check (within last 7 days)
  const { rows: promises } = await pool.query(`
    SELECT p.id AS promise_id, p.candidate_id, p.promise_text, p.status,
           cp.display_name
    FROM promises p
    JOIN candidate_profiles cp ON cp.id = p.candidate_id
    LEFT JOIN promise_auto_checks pac ON pac.promise_id = p.id
      AND pac.created_at > NOW() - INTERVAL '7 days'
    WHERE p.is_locked = TRUE
      AND pac.id IS NULL
    ORDER BY p.created_at DESC
  `);

  console.log(`Found ${promises.length} locked promises without a recent auto-check.\n`);

  let matched = 0;
  let noMatch = 0;
  let errors = 0;

  for (let i = 0; i < promises.length; i++) {
    const p = promises[i];
    console.log(`[${i + 1}/${promises.length}] Checking promise for ${p.display_name}: "${p.promise_text.substring(0, 80)}..."`);

    // Get recent voting records for this candidate (last 100 votes) with bill info
    const { rows: votes } = await pool.query(`
      SELECT vr.id AS voting_record_id, vr.vote, vr.vote_event_id, vr.bill_id,
             ve.motion_text, ve.vote_date, ve.result, ve.chamber,
             b.title AS bill_title, b.bill_number, b.summary AS bill_summary
      FROM voting_records vr
      JOIN vote_events ve ON ve.id = vr.vote_event_id
      LEFT JOIN bills b ON b.id = vr.bill_id
      WHERE vr.candidate_id = $1
      ORDER BY ve.vote_date DESC
      LIMIT 100
    `, [p.candidate_id]);

    if (votes.length === 0) {
      console.log('  No voting records found, skipping.');
      noMatch++;
      continue;
    }

    const votesText = votes.map((v, idx) => {
      return `${idx + 1}. [${v.vote_date}] Vote: ${v.vote} on "${v.bill_title || v.motion_text || 'Unknown'}" (${v.bill_number || 'N/A'})${v.bill_summary ? ` — ${v.bill_summary.substring(0, 200)}` : ''}`;
    }).join('\n');

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `You are analyzing whether a politician's voting record confirms or contradicts a campaign promise.

PROMISE: "${p.promise_text}"

RECENT VOTES:
${votesText}

Does any of these votes confirm or contradict this promise? Return JSON only, no markdown fencing:
{ "match_found": bool, "vote_index": number_or_null, "match_type": "kept"|"broken"|"partial", "confidence": 0.0_to_1.0, "reasoning": "brief explanation" }

If no vote is relevant, return: { "match_found": false, "vote_index": null, "match_type": null, "confidence": 0, "reasoning": "No relevant votes found" }`
        }]
      });

      const text = response.content[0].text.trim();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        // Try extracting JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Could not parse AI response: ${text.substring(0, 200)}`);
        }
      }

      if (result.match_found && result.vote_index != null) {
        const matchedVote = votes[result.vote_index - 1];
        if (!matchedVote) {
          console.log(`  AI returned invalid vote_index ${result.vote_index}, skipping.`);
          noMatch++;
        } else {
          console.log(`  MATCH: ${result.match_type} (confidence: ${result.confidence}) — ${result.reasoning}`);
          matched++;

          if (!DRY_RUN) {
            await pool.query(`
              INSERT INTO promise_auto_checks (
                promise_id, vote_event_id, bill_id, match_type,
                confidence, ai_reasoning
              ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
              p.promise_id,
              matchedVote.vote_event_id,
              matchedVote.bill_id,
              result.match_type,
              result.confidence,
              result.reasoning
            ]);
          }
        }
      } else {
        console.log(`  No match found: ${result.reasoning}`);
        noMatch++;
      }
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      errors++;
    }

    // Rate limit: 2 second delay between API calls
    if (i < promises.length - 1) {
      await sleep(2000);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Promises checked: ${promises.length}`);
  console.log(`Matches found:    ${matched}`);
  console.log(`No match:         ${noMatch}`);
  console.log(`Errors:           ${errors}`);
  if (DRY_RUN) console.log('(DRY RUN — no records were written)');
  console.log('Done.');
}

main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
