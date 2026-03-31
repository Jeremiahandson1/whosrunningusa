#!/usr/bin/env node

/**
 * Generate Accountability Gaps
 *
 * Analyzes federal politicians' donor industries, voting records, and public
 * statements using Claude to identify genuine inconsistencies. Results are
 * stored in the accountability_gaps table and scores are recomputed.
 *
 * Usage:
 *   node scripts/generate-accountability-gaps.js
 *   node scripts/generate-accountability-gaps.js --dry-run
 *   node scripts/generate-accountability-gaps.js --politician-id <uuid>
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Parse CLI flags
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const politicianIdIdx = args.indexOf('--politician-id');
const singlePoliticianId = politicianIdIdx !== -1 ? args[politicianIdIdx + 1] : null;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFederalPoliticians() {
  const params = [];
  let whereClause = "WHERE cp.fec_office_type IN ('H', 'S')";

  if (singlePoliticianId) {
    whereClause += ' AND cp.id = $1';
    params.push(singlePoliticianId);
  }

  const { rows } = await pool.query(
    `SELECT cp.id, cp.display_name, cp.party_affiliation, cp.fec_office_type, cp.fec_state, cp.fec_district
     FROM candidate_profiles cp
     ${whereClause}
     ORDER BY cp.display_name`,
    params
  );
  return rows;
}

async function getDonorIndustries(politicianId) {
  const { rows } = await pool.query(
    `SELECT industry_name, total_amount, donor_count, cycle_year
     FROM politician_donor_industries
     WHERE politician_id = $1
     ORDER BY total_amount DESC
     LIMIT 10`,
    [politicianId]
  );
  return rows;
}

async function getVotingRecords(politicianId) {
  const { rows } = await pool.query(
    `SELECT b.title AS bill_title, b.categories AS bill_categories,
            vr.vote, ve.vote_date
     FROM voting_records vr
     JOIN vote_events ve ON ve.id = vr.vote_event_id
     JOIN bills b ON b.id = ve.bill_id
     WHERE vr.candidate_id = $1
     ORDER BY ve.vote_date DESC
     LIMIT 50`,
    [politicianId]
  );
  return rows;
}

async function getPublicStatements(politicianId) {
  const { rows } = await pool.query(
    `SELECT statement_text, statement_date, topic_tags
     FROM public_statements
     WHERE politician_id = $1
     ORDER BY statement_date DESC
     LIMIT 30`,
    [politicianId]
  );
  return rows;
}

async function analyzeWithClaude(politician, donors, votes, statements) {
  const userMessage = JSON.stringify({
    politician: {
      name: politician.display_name,
      party: politician.party_affiliation,
      office_type: politician.fec_office_type === 'H' ? 'House' : 'Senate',
      state: politician.fec_state,
      district: politician.fec_district
    },
    top_donor_industries: donors.map((d) => ({
      industry: d.industry_name,
      total_amount: Number(d.total_amount),
      donor_count: d.donor_count,
      cycle_year: d.cycle_year
    })),
    voting_record: votes.map((v) => ({
      bill_title: v.bill_title,
      vote: v.vote,
      vote_date: v.vote_date,
      categories: v.bill_categories
    })),
    public_statements: statements.map((s) => ({
      text: s.statement_text,
      date: s.statement_date,
      topics: s.topic_tags
    }))
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system:
      'You are a nonpartisan accountability analyst. Identify genuine inconsistencies between this politician\'s donor funding, voting record, and public statements. Only flag what the data actually shows. No partisan language. Rate severity 1-10. Return JSON only.',
    messages: [
      {
        role: 'user',
        content: `Analyze the following politician data for accountability gaps. Return a JSON array of gaps. Each gap object must have: gap_type ("donor_vote" | "statement_vote" | "statement_donor"), stated_position (string), actual_action (string), gap_severity (integer 1-10), analysis (string), topic_tag (string). If no genuine gaps exist, return an empty array [].\n\n${userMessage}`
      }
    ]
  });

  const text = response.content[0].text.trim();

  // Extract JSON from response — handle possible markdown fences
  let jsonStr = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  return JSON.parse(jsonStr);
}

async function insertGaps(politicianId, gaps) {
  let inserted = 0;
  for (const gap of gaps) {
    await pool.query(
      `INSERT INTO accountability_gaps
         (politician_id, gap_type, stated_position, actual_action, gap_severity, ai_analysis, topic_tag, verified, published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, FALSE)`,
      [
        politicianId,
        gap.gap_type,
        gap.stated_position,
        gap.actual_action,
        gap.gap_severity,
        gap.analysis,
        gap.topic_tag
      ]
    );
    inserted++;
  }
  return inserted;
}

async function recomputeScores() {
  console.log('Recomputing accountability scores...');

  // Get all politicians who have gaps
  const { rows: politicians } = await pool.query(
    `SELECT DISTINCT politician_id FROM accountability_gaps`
  );

  for (const { politician_id } of politicians) {
    // Total severity sum of all gaps
    const { rows: [severityRow] } = await pool.query(
      `SELECT COALESCE(SUM(gap_severity), 0) AS severity_sum,
              COUNT(*) AS total_gaps
       FROM accountability_gaps
       WHERE politician_id = $1`,
      [politician_id]
    );

    // Count of donor-related gaps
    const { rows: [donorRow] } = await pool.query(
      `SELECT COUNT(*) AS donor_gaps
       FROM accountability_gaps
       WHERE politician_id = $1
         AND gap_type IN ('donor_vote', 'statement_donor')`,
      [politician_id]
    );

    const totalGaps = parseInt(severityRow.total_gaps, 10);
    const severitySum = parseInt(severityRow.severity_sum, 10);
    const donorGaps = parseInt(donorRow.donor_gaps, 10);

    // consistency_score: 100 - (severity_sum / max_possible * 100), clamped 0-100
    // max_possible = total_gaps * 10 (each gap can be severity 10 at most)
    const maxPossible = totalGaps * 10;
    const consistencyScore = maxPossible > 0
      ? Math.max(0, Math.min(100, Math.round(100 - (severitySum / maxPossible * 100))))
      : 100;

    // donor_influence_score: ratio of donor-related gaps to total gaps, scaled 0-100
    const donorInfluenceScore = totalGaps > 0
      ? Math.round((donorGaps / totalGaps) * 100)
      : 0;

    await pool.query(
      `INSERT INTO accountability_scores (politician_id, consistency_score, donor_influence_score, total_gaps_found, last_computed)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (politician_id) DO UPDATE SET
         consistency_score = EXCLUDED.consistency_score,
         donor_influence_score = EXCLUDED.donor_influence_score,
         total_gaps_found = EXCLUDED.total_gaps_found,
         last_computed = NOW()`,
      [politician_id, consistencyScore, donorInfluenceScore, totalGaps]
    );
  }

  console.log(`Scores recomputed for ${politicians.length} politicians.`);
}

async function main() {
  console.log('=== Accountability Gap Generator ===');
  if (dryRun) console.log('DRY RUN — no database writes will occur.');
  if (singlePoliticianId) console.log(`Processing single politician: ${singlePoliticianId}`);

  const politicians = await getFederalPoliticians();
  console.log(`Found ${politicians.length} federal politician(s) to process.`);

  if (politicians.length === 0) {
    console.log('No politicians to process. Exiting.');
    process.exit(0);
  }

  let totalProcessed = 0;
  let totalGapsFound = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Process in batches
  for (let i = 0; i < politicians.length; i += BATCH_SIZE) {
    const batch = politicians.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(politicians.length / BATCH_SIZE);
    console.log(`\nBatch ${batchNum}/${totalBatches} (${batch.length} politicians)`);

    for (const politician of batch) {
      try {
        console.log(`  Processing: ${politician.display_name} (${politician.id})`);

        const [donors, votes, statements] = await Promise.all([
          getDonorIndustries(politician.id),
          getVotingRecords(politician.id),
          getPublicStatements(politician.id)
        ]);

        console.log(`    Donors: ${donors.length}, Votes: ${votes.length}, Statements: ${statements.length}`);

        // Must have both donor data AND voting records to analyze
        if (donors.length === 0 || votes.length === 0) {
          console.log('    Skipped — insufficient data (need both donors and votes).');
          totalSkipped++;
          continue;
        }

        const gaps = await analyzeWithClaude(politician, donors, votes, statements);

        if (!Array.isArray(gaps)) {
          console.log('    Skipped — Claude returned non-array response.');
          totalErrors++;
          continue;
        }

        console.log(`    Found ${gaps.length} gap(s).`);

        if (!dryRun && gaps.length > 0) {
          const inserted = await insertGaps(politician.id, gaps);
          console.log(`    Inserted ${inserted} gap(s) into database.`);
        } else if (dryRun && gaps.length > 0) {
          for (const gap of gaps) {
            console.log(`    [DRY RUN] Would insert: ${gap.gap_type} (severity ${gap.gap_severity}) — ${gap.topic_tag}`);
          }
        }

        totalProcessed++;
        totalGapsFound += gaps.length;
      } catch (err) {
        if (err instanceof SyntaxError) {
          console.log(`    Skipped — Claude returned invalid JSON: ${err.message}`);
        } else {
          console.error(`    Error processing ${politician.display_name}: ${err.message}`);
        }
        totalErrors++;
      }
    }

    // Delay between batches to respect rate limits
    if (i + BATCH_SIZE < politicians.length) {
      console.log(`  Waiting ${BATCH_DELAY_MS}ms before next batch...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Recompute scores
  if (!dryRun && totalGapsFound > 0) {
    await recomputeScores();
  } else if (dryRun) {
    console.log('\n[DRY RUN] Skipping score recomputation.');
  }

  console.log('\n=== Summary ===');
  console.log(`Processed: ${totalProcessed}`);
  console.log(`Skipped (insufficient data): ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`Total gaps found: ${totalGapsFound}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
