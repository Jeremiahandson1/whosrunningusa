#!/usr/bin/env node

/**
 * Generate Accountability Gaps
 *
 * Analyzes federal politicians' donor industries, voting records, and public
 * statements using Claude to identify genuine inconsistencies. Results are
 * stored in the accountability_gaps table and scores are recomputed.
 *
 * Cost controls: requests go through the Message Batches API (50% of
 * synchronous pricing), each politician is marked in ai_analysis_state when
 * submitted and not re-analyzed for 30 days (previously this script
 * re-analyzed every eligible politician every night), and a nightly cap
 * (--limit, default 60) bounds the worst case.
 *
 * Usage:
 *   node scripts/generate-accountability-gaps.cjs
 *   node scripts/generate-accountability-gaps.cjs --dry-run
 *   node scripts/generate-accountability-gaps.cjs --politician-id <uuid>
 *   node scripts/generate-accountability-gaps.cjs --limit=20 --poll-minutes=5
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
let Anthropic; try { Anthropic = require('@anthropic-ai/sdk'); } catch(_) { console.log('Skipping: @anthropic-ai/sdk not installed'); process.exit(0); }
const { extractJson, collectPending, submitAndPoll, parsePollMs } = require('./lib/ai-batch.cjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
if (!process.env.ANTHROPIC_API_KEY) { console.log("Skipping: ANTHROPIC_API_KEY not set"); process.exit(0); }
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-5';
const JOB_TYPE = 'gaps';
const REANALYZE_AFTER = '30 days';

// Parse CLI flags
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const politicianIdIdx = argv.indexOf('--politician-id');
const singlePoliticianId = politicianIdIdx !== -1 ? argv[politicianIdIdx + 1] : null;
const limitArg = argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 60;
const pollMs = parsePollMs(argv);

let gapsInserted = 0;

async function getFederalPoliticians() {
  const params = [];
  let whereClause = "WHERE cp.fec_office_type IN ('H', 'S')";

  if (singlePoliticianId) {
    whereClause += ' AND cp.id = $1';
    params.push(singlePoliticianId);
  } else {
    // Only iterate politicians with the minimum data needed for analysis,
    // skipping anyone analyzed within the re-analysis window — without that
    // gate this script re-analyzed (and re-billed) all ~450 every night.
    whereClause += ` AND EXISTS (SELECT 1 FROM politician_donor_industries WHERE politician_id = cp.id)
                     AND EXISTS (SELECT 1 FROM voting_records WHERE candidate_id = cp.id)
                     AND NOT EXISTS (
                       SELECT 1 FROM ai_analysis_state s
                       WHERE s.politician_id = cp.id AND s.job_type = '${JOB_TYPE}'
                         AND s.analyzed_at > NOW() - INTERVAL '${REANALYZE_AFTER}'
                     )`;
  }

  const { rows } = await pool.query(
    `SELECT cp.id, cp.display_name, cp.party_affiliation, cp.fec_office_type, cp.fec_state, cp.fec_district
     FROM candidate_profiles cp
     ${whereClause}
     ORDER BY (SELECT MAX(s.analyzed_at) FROM ai_analysis_state s
               WHERE s.politician_id = cp.id AND s.job_type = '${JOB_TYPE}') ASC NULLS FIRST,
              cp.display_name
     LIMIT ${limit}`,
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
    `SELECT COALESCE(b.title, ve.motion_text) AS bill_title,
            b.categories AS bill_categories,
            vr.vote, ve.vote_date
     FROM voting_records vr
     JOIN vote_events ve ON ve.id = vr.vote_event_id
     LEFT JOIN bills b ON b.id = ve.bill_id
     WHERE vr.candidate_id = $1
       AND COALESCE(b.title, ve.motion_text) IS NOT NULL
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

// ---------------------------------------------------------------------------
// Batch request construction / result handling
// ---------------------------------------------------------------------------

function buildRequest(politician, donors, votes, statements) {
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

  return {
    custom_id: politician.id,
    params: {
      model: MODEL,
      // Sonnet 5 thinks by default and max_tokens caps thinking + reply
      // together, so leave headroom or the JSON truncates.
      max_tokens: 8192,
      system:
        'You are a nonpartisan accountability analyst. Identify genuine inconsistencies between this politician\'s donor funding, voting record, and public statements. Only flag what the data actually shows. No partisan language. Rate severity 1-10. Return JSON only.',
      messages: [
        {
          role: 'user',
          content: `Analyze the following politician data for accountability gaps. Return a JSON array of gaps. Each gap object must have: gap_type ("donor_vote" | "statement_vote" | "statement_donor"), stated_position (string), actual_action (string), gap_severity (integer 1-10), analysis (string), topic_tag (string). If no genuine gaps exist, return an empty array [].\n\n${userMessage}`
        }
      ]
    }
  };
}

async function handleResult(politicianId, text) {
  const gaps = extractJson(text);
  if (!Array.isArray(gaps)) throw new Error('non-array response');

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
    gapsInserted++;
  }
  if (gaps.length > 0) console.log(`    ${politicianId}: ${gaps.length} gap(s)`);
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
  console.log(`Model: ${MODEL} (batched)`);
  console.log(`Limit: ${limit}`);
  if (dryRun) console.log('DRY RUN — no database writes will occur.');
  if (singlePoliticianId) console.log(`Processing single politician: ${singlePoliticianId}`);

  // 1. Collect batches from earlier runs
  let collectedOk = 0;
  if (!dryRun) {
    const collected = await collectPending({ pool, anthropic, jobType: JOB_TYPE, onResult: handleResult });
    collectedOk = collected.ok;
    if (collected.ok || collected.failed) {
      console.log(`Collected from earlier batches: ${collected.ok} ok, ${collected.failed} failed\n`);
    }
  }

  // 2. Build this run's requests
  const politicians = await getFederalPoliticians();
  console.log(`Found ${politicians.length} federal politician(s) to process.`);

  const requests = [];
  let totalSkipped = 0;
  for (const politician of politicians) {
    const [donors, votes, statements] = await Promise.all([
      getDonorIndustries(politician.id),
      getVotingRecords(politician.id),
      getPublicStatements(politician.id)
    ]);

    // Must have both donor data AND voting records to analyze
    if (donors.length === 0 || votes.length === 0) {
      totalSkipped++;
      continue;
    }
    console.log(`  ${politician.display_name}: ${donors.length} donors, ${votes.length} votes, ${statements.length} statements`);
    requests.push(buildRequest(politician, donors, votes, statements));
  }

  if (dryRun) {
    console.log(`\n=== Summary ===\n[dry-run] Would submit ${requests.length} requests (${totalSkipped} skipped)`);
    process.exit(0);
  }

  if (requests.length === 0 && gapsInserted === 0) {
    console.log('Nothing to submit.');
    console.log(`\n=== Summary ===\nCollected: ${collectedOk}\nSubmitted: 0`);
    process.exit(0);
  }

  // 3. Submit, mark analyzed, poll
  let collected = null;
  if (requests.length > 0) {
    ({ collected } = await submitAndPoll({
      pool, anthropic, jobType: JOB_TYPE, requests, pollMs, onResult: handleResult,
    }));
    await markAnalyzed(requests.map(r => r.custom_id));
  }

  // 4. Recompute scores if anything landed (this run or collected from earlier)
  if (gapsInserted > 0) {
    await recomputeScores();
  }

  console.log('\n=== Summary ===');
  console.log(`Collected from earlier batches: ${collectedOk}`);
  console.log(`Submitted: ${requests.length} (${totalSkipped} skipped for insufficient data)`);
  console.log(`Gaps inserted this run: ${gapsInserted}`);
  if (requests.length > 0 && !collected) {
    console.log('Batch still processing — next run will collect the results.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
