#!/usr/bin/env node

/**
 * Sync FEC Schedule A itemized receipts into the contributions table.
 *
 * For each candidate_profile with a fec_candidate_id, resolves their principal
 * campaign committee(s) and pages the openFEC Schedule A endpoint, upserting
 * each itemized receipt keyed by FEC sub_id (contributions.external_id).
 * Candidates with zero existing contributions rows are processed first, so
 * capped nightly runs converge on full coverage.
 *
 * API: https://api.open.fec.gov/v1 — default keys allow 1,000 req/hour,
 * so pace at 3.7s/request and back off on 429 (honoring Retry-After).
 *
 * Usage:
 *   node scripts/sync-fec-receipts.cjs [--cycle=2026] [--min=500]
 *                                      [--candidates=150] [--fec-id=H8WI05191]
 *
 * Required env vars:
 *   DATABASE_URL
 *   FEC_API_KEY  (register at https://api.open.fec.gov/developers/)
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch (_) {}

const { Pool } = require('pg');
const axios = require('axios');

const FEC_API_KEY = process.env.FEC_API_KEY;
if (!FEC_API_KEY) {
  console.error('Fatal: FEC_API_KEY is not set. Get a key at https://api.open.fec.gov/developers/ and add it to backend/.env');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const API_BASE = 'https://api.open.fec.gov/v1';

// Default FEC keys are limited to 1,000 requests/hour — pace at 3.7s/request.
const RATE_MS = 3700;
const MAX_RETRIES = 4;
const MAX_PAGES_PER_CANDIDATE = 10;
const MAX_COMMITTEES = 2;

let apiRequests = 0;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseArgs() {
  const args = { cycle: 2026, min: 500, candidates: 150, fecId: null };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--cycle=')) args.cycle = parseInt(a.slice(8), 10);
    if (a.startsWith('--min=')) args.min = parseInt(a.slice(6), 10);
    if (a.startsWith('--candidates=')) args.candidates = parseInt(a.slice(13), 10);
    if (a.startsWith('--fec-id=')) args.fecId = a.slice(9).toUpperCase();
  }
  return args;
}

async function fetchJSON(url, params) {
  for (let attempt = 1; ; attempt++) {
    await sleep(RATE_MS);
    apiRequests++;
    try {
      const res = await axios.get(url, {
        params: { ...params, api_key: FEC_API_KEY },
        timeout: 60000,
        headers: { Accept: 'application/json', 'User-Agent': 'WhosRunningUSA/1.0 civic-data-project' },
      });
      return res.data;
    } catch (err) {
      const status = err.response?.status;
      if (status === 429 && attempt <= MAX_RETRIES) {
        const retryAfter = parseInt(err.response?.headers?.['retry-after'], 10);
        const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : attempt * 30000;
        console.log(`  429 rate-limited, waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${MAX_RETRIES})...`);
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Committee resolution: principal campaign committees (P), falling back to
// authorized committees (A) for candidates without a designated principal.
// ---------------------------------------------------------------------------

async function getCommittees(fecCandidateId) {
  for (const designation of ['P', 'A']) {
    let data;
    try {
      data = await fetchJSON(`${API_BASE}/candidate/${encodeURIComponent(fecCandidateId)}/committees/`, {
        designation, per_page: 10,
      });
    } catch (err) {
      if (err.response?.status === 404) return [];
      throw err;
    }
    const results = data?.results || [];
    if (results.length > 0) {
      return results
        .map(c => c.committee_id)
        .filter(Boolean)
        .slice(0, MAX_COMMITTEES);
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Schedule A receipts for one committee, with FEC keyset pagination.
// pageBudget limits total pages fetched across a candidate's committees.
// ---------------------------------------------------------------------------

async function syncCommitteeReceipts(candidateId, committeeId, cycle, minAmount, pageBudget) {
  const sourceUrl = `https://www.fec.gov/data/receipts/?committee_id=${committeeId}`;
  let upserted = 0;
  let pages = 0;
  let lastIndexes = null;

  while (pages < pageBudget) {
    const params = {
      committee_id: committeeId,
      two_year_transaction_period: cycle,
      min_amount: minAmount,
      per_page: 100,
      sort: '-contribution_receipt_date',
    };
    if (lastIndexes) Object.assign(params, lastIndexes);

    const data = await fetchJSON(`${API_BASE}/schedules/schedule_a/`, params);
    pages++;

    const results = data?.results || [];
    for (const r of results) {
      if (!r.sub_id) continue;
      await pool.query(
        `INSERT INTO contributions
           (candidate_id, contributor_name, contributor_type,
            contributor_employer, contributor_occupation,
            amount, contribution_date, contribution_type,
            election_cycle, source, source_url, external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO UPDATE SET
           amount = EXCLUDED.amount,
           contributor_employer = EXCLUDED.contributor_employer,
           contributor_occupation = EXCLUDED.contributor_occupation`,
        [
          candidateId,
          r.contributor_name || null,
          r.entity_type || null,
          r.contributor_employer || null,
          r.contributor_occupation || null,
          r.contribution_receipt_amount != null ? r.contribution_receipt_amount : 0,
          r.contribution_receipt_date ? r.contribution_receipt_date.slice(0, 10) : null,
          'itemized',
          String(cycle),
          'fec',
          sourceUrl,
          String(r.sub_id),
        ]
      );
      upserted++;
    }

    // FEC keyset pagination: pass back last_indexes (+ the sort column's
    // last value) to get the next page; absent/null means we're done.
    const li = data?.pagination?.last_indexes;
    if (!li || !li.last_index || results.length === 0) break;
    lastIndexes = {
      last_index: li.last_index,
      ...(li.last_contribution_receipt_date
        ? { last_contribution_receipt_date: li.last_contribution_receipt_date }
        : {}),
    };
  }

  return { upserted, pages };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  console.log(`=== FEC Schedule A Receipts Sync (cycle ${args.cycle}) ===`);
  console.log(`Min amount: $${args.min}  |  Max candidates: ${args.candidates}${args.fecId ? `  |  FEC ID: ${args.fecId}` : ''}`);

  // Candidates with zero existing contributions come first so capped runs
  // converge; ties break alphabetically for a stable order.
  const { rows: candidates } = await pool.query(
    `SELECT cp.id, cp.fec_candidate_id, cp.display_name
     FROM candidate_profiles cp
     WHERE cp.fec_candidate_id IS NOT NULL
       AND cp.is_active = TRUE
       ${args.fecId ? 'AND cp.fec_candidate_id = $2' : ''}
     ORDER BY
       (NOT EXISTS (SELECT 1 FROM contributions c WHERE c.candidate_id = cp.id)) DESC,
       cp.display_name
     LIMIT $1`,
    args.fecId ? [args.candidates, args.fecId] : [args.candidates]
  );
  console.log(`Candidates to sync: ${candidates.length}\n`);

  let totalReceipts = 0;
  let candidatesWithData = 0;
  let failed = 0;

  for (const cand of candidates) {
    try {
      const committees = await getCommittees(cand.fec_candidate_id);
      if (committees.length === 0) {
        console.log(`${cand.display_name} (${cand.fec_candidate_id}): no committees found`);
        continue;
      }

      let receipts = 0;
      let pagesUsed = 0;
      for (const committeeId of committees) {
        const budget = MAX_PAGES_PER_CANDIDATE - pagesUsed;
        if (budget <= 0) break;
        const res = await syncCommitteeReceipts(cand.id, committeeId, args.cycle, args.min, budget);
        receipts += res.upserted;
        pagesUsed += res.pages;
      }

      console.log(`${cand.display_name} (${cand.fec_candidate_id}): ${receipts} receipts`);
      totalReceipts += receipts;
      if (receipts > 0) candidatesWithData++;
    } catch (err) {
      failed++;
      console.error(`  Error for ${cand.display_name} (${cand.fec_candidate_id}): ${err.message}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Candidates processed:  ${candidates.length}`);
  console.log(`Candidates with data:  ${candidatesWithData}`);
  console.log(`Receipts upserted:     ${totalReceipts}`);
  console.log(`Candidates failed:     ${failed}`);
  console.log(`API requests made:     ${apiRequests}`);
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
