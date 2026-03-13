#!/usr/bin/env node

/**
 * Campaign Finance Sync Script
 *
 * Pulls financial data from the FEC API for all candidates with FEC IDs:
 *   1. Campaign finance summaries (total raised, spent, cash on hand, by source)
 *   2. Top individual contributors (name, employer, amount)
 *   3. Contribution size breakdowns (small vs large dollar)
 *
 * Usage:
 *   node sync-finance.js                     # All candidates with FEC IDs
 *   node sync-finance.js --state=TX          # Texas candidates only
 *   node sync-finance.js --cycle=2024        # 2024 cycle (default: 2026)
 *   node sync-finance.js --top=50            # Only top 50 fundraisers
 *   node sync-finance.js --candidate=S2TX00312  # Single FEC candidate ID
 *
 * Environment:
 *   FEC_API_KEY - Required (https://api.data.gov/signup/)
 *   DATABASE_URL - PostgreSQL connection string
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');
const FECClient = require('../services/ingestion/fecClient');

const args = process.argv.slice(2);
const stateFlag = args.find(a => a.startsWith('--state='));
const cycleFlag = args.find(a => a.startsWith('--cycle='));
const topFlag = args.find(a => a.startsWith('--top='));
const candidateFlag = args.find(a => a.startsWith('--candidate='));

const state = stateFlag ? stateFlag.split('=')[1].toUpperCase() : null;
const cycle = cycleFlag ? parseInt(cycleFlag.split('=')[1]) : 2026;
const topN = topFlag ? parseInt(topFlag.split('=')[1]) : null;
const singleCandidate = candidateFlag ? candidateFlag.split('=')[1] : null;

const fec = new FECClient();

const stats = {
  candidates: 0,
  summaries: 0,
  contributions: 0,
  contributors: 0,
  topDonors: 0,
  errors: 0,
  skipped: 0,
};

async function main() {
  if (!process.env.FEC_API_KEY) {
    console.error('ERROR: FEC_API_KEY is required');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Campaign Finance Sync');
  console.log('='.repeat(60));
  console.log(`Cycle:     ${cycle}`);
  console.log(`State:     ${state || 'All'}`);
  console.log(`Limit:     ${topN || 'None'}`);
  console.log(`Candidate: ${singleCandidate || 'All with FEC IDs'}`);
  console.log('='.repeat(60));
  console.log('');

  try {
    // Get candidates from our DB that have FEC IDs
    let query = `
      SELECT cp.id, cp.display_name, cp.fec_candidate_id, cp.party_affiliation
      FROM candidate_profiles cp
      WHERE cp.fec_candidate_id IS NOT NULL
        AND cp.is_active = TRUE
    `;
    const params = [];

    if (singleCandidate) {
      query += ` AND cp.fec_candidate_id = $${params.length + 1}`;
      params.push(singleCandidate);
    } else if (state) {
      // Match state from the FEC ID: H2TX, S2TX, etc. — state is chars 3-4
      // Or match from candidate_source_links
      query += ` AND (
        SUBSTRING(cp.fec_candidate_id FROM 3 FOR 2) = $${params.length + 1}
        OR EXISTS (
          SELECT 1 FROM candidate_source_links csl
          WHERE csl.candidate_id = cp.id
            AND csl.external_data->>'state' = $${params.length + 1}
        )
      )`;
      params.push(state);
    }

    query += ' ORDER BY cp.display_name';
    if (topN) query += ` LIMIT ${topN}`;

    const { rows: candidates } = await db.query(query, params);
    console.log(`Found ${candidates.length} candidates with FEC IDs\n`);

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const fecId = candidate.fec_candidate_id;

      console.log(`[${i + 1}/${candidates.length}] ${candidate.display_name} (${fecId})`);

      try {
        // Step 1: Get the principal committee ID
        const committeeId = await getPrincipalCommittee(fecId);
        if (!committeeId) {
          stats.skipped++;
          continue;
        }

        // Step 2: Sync financial summary
        await syncFinanceSummary(candidate.id, fecId, committeeId);

        // Step 3: Sync top contributions
        await syncContributions(candidate.id, committeeId);

        stats.candidates++;

        // Rate limiting — FEC allows ~1000 req/hr
        await sleep(250);

      } catch (err) {
        console.error(`  ERROR: ${err.message}`);
        stats.errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Finance Sync Complete');
    console.log('='.repeat(60));
    console.log(`Candidates processed: ${stats.candidates}`);
    console.log(`Summaries created:    ${stats.summaries}`);
    console.log(`Contributions stored: ${stats.contributions}`);
    console.log(`Contributors created: ${stats.contributors}`);
    console.log(`Top donors recorded:  ${stats.topDonors}`);
    console.log(`Skipped:              ${stats.skipped}`);
    console.log(`Errors:               ${stats.errors}`);
    console.log('='.repeat(60));

  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

/**
 * Get the principal campaign committee ID for an FEC candidate
 */
async function getPrincipalCommittee(fecCandidateId) {
  try {
    const resp = await fec.request('/candidates/search/', {
      candidate_id: fecCandidateId,
      per_page: 1,
    });
    return resp.results?.[0]?.principal_committees?.[0]?.committee_id || null;
  } catch (err) {
    return null;
  }
}

/**
 * Sync campaign finance summary for a candidate
 */
async function syncFinanceSummary(candidateId, fecCandidateId, committeeId) {
  // Get committee financial totals
  const resp = await fec.getCommitteeTotals(committeeId, cycle);
  const totals = resp.results?.[0];

  if (!totals) {
    console.log('  No financial totals for this cycle');
    return;
  }

  // Also get contribution size breakdown
  let smallDonorTotal = 0;
  let largeDonorTotal = 0;

  try {
    const sizeResp = await fec.getContributionsBySize(fecCandidateId, cycle);
    for (const bucket of (sizeResp.results || [])) {
      if (bucket.size <= 200) {
        smallDonorTotal += bucket.total || 0;
      } else {
        largeDonorTotal += bucket.total || 0;
      }
    }
  } catch (err) {
    // Size data not always available
  }

  const totalIndividual = totals.individual_contributions || 0;
  const smallDonorPercent = totalIndividual > 0
    ? ((smallDonorTotal / totalIndividual) * 100).toFixed(2)
    : 0;

  await db.query(`
    INSERT INTO campaign_finance_summaries (
      candidate_id, election_cycle, total_raised, total_spent,
      cash_on_hand, debt, individual_contributions, pac_contributions,
      party_contributions, self_financing, other_contributions,
      small_donor_total, large_donor_total, small_donor_percent,
      total_transactions, coverage_start_date, coverage_end_date,
      last_filed_date, source, source_url
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, 'fec',
      $19
    )
    ON CONFLICT (candidate_id, election_cycle) DO UPDATE SET
      total_raised = EXCLUDED.total_raised,
      total_spent = EXCLUDED.total_spent,
      cash_on_hand = EXCLUDED.cash_on_hand,
      debt = EXCLUDED.debt,
      individual_contributions = EXCLUDED.individual_contributions,
      pac_contributions = EXCLUDED.pac_contributions,
      party_contributions = EXCLUDED.party_contributions,
      self_financing = EXCLUDED.self_financing,
      other_contributions = EXCLUDED.other_contributions,
      small_donor_total = EXCLUDED.small_donor_total,
      large_donor_total = EXCLUDED.large_donor_total,
      small_donor_percent = EXCLUDED.small_donor_percent,
      total_transactions = EXCLUDED.total_transactions,
      coverage_start_date = EXCLUDED.coverage_start_date,
      coverage_end_date = EXCLUDED.coverage_end_date,
      last_filed_date = EXCLUDED.last_filed_date,
      updated_at = NOW()
  `, [
    candidateId,
    String(cycle),
    totals.receipts || 0,
    totals.disbursements || 0,
    totals.cash_on_hand_end_period || 0,
    totals.debts_owed_by_committee || 0,
    totals.individual_contributions || 0,
    totals.other_political_committee_contributions || 0,
    totals.political_party_committee_contributions || 0,
    totals.candidate_contribution || 0,
    totals.other_receipts || 0,
    smallDonorTotal,
    largeDonorTotal,
    smallDonorPercent,
    totals.contribution_refunds_individual_total ? null : null, // no transaction count in API
    totals.coverage_start_date || null,
    totals.coverage_end_date || null,
    totals.last_beginning_image_number ? null : null, // approximate
    `https://www.fec.gov/data/candidate/${fecCandidateId}/`,
  ]);

  const raised = (totals.receipts || 0) / 1e6;
  console.log(`  Finance: $${raised.toFixed(1)}M raised, $${((totals.individual_contributions || 0) / 1e6).toFixed(1)}M individual`);
  stats.summaries++;
}

/**
 * Sync individual contributions for a candidate
 */
async function syncContributions(candidateId, committeeId) {
  // Get top contributions (sorted by amount, $200+)
  let page = 1;
  let hasMore = true;
  let totalSaved = 0;
  const maxPages = 5; // Cap at 500 contributions per candidate
  const topDonorMap = {}; // aggregate by contributor name

  while (hasMore && page <= maxPages) {
    const resp = await fec.getContributions(committeeId, cycle, {
      perPage: 100,
      page,
      minAmount: 200,
    });

    const contributions = resp.results || [];
    if (contributions.length === 0) {
      hasMore = false;
      break;
    }

    for (const c of contributions) {
      // Upsert contributor
      let contributorId = null;
      if (c.contributor_name && c.contributor_name !== 'WINRED' && c.contributor_name !== 'ACTBLUE') {
        contributorId = await upsertContributor({
          name: c.contributor_name,
          type: c.entity_type === 'IND' ? 'individual' : (c.entity_type === 'COM' ? 'committee' : 'other'),
          employer: c.contributor_employer,
          occupation: c.contributor_occupation,
          city: c.contributor_city,
          state: c.contributor_state,
          zip: c.contributor_zip,
        });
      }

      // Insert contribution
      try {
        await db.query(`
          INSERT INTO contributions (
            candidate_id, contributor_id, amount, contribution_date,
            contribution_type, election_cycle, contributor_name,
            contributor_type, contributor_employer, contributor_occupation,
            source, source_url, external_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'fec', $11, $12)
          ON CONFLICT DO NOTHING
        `, [
          candidateId,
          contributorId,
          c.contribution_receipt_amount,
          c.contribution_receipt_date,
          c.receipt_type_full || c.receipt_type,
          String(cycle),
          c.contributor_name,
          c.entity_type === 'IND' ? 'individual' : (c.entity_type === 'COM' ? 'committee' : 'other'),
          c.contributor_employer,
          c.contributor_occupation,
          `https://www.fec.gov/data/receipts/?committee_id=${committeeId}`,
          c.sub_id || c.transaction_id,
        ]);
        totalSaved++;
        stats.contributions++;
      } catch (err) {
        // Skip duplicates
      }

      // Aggregate for top donors
      if (c.contributor_name && c.contributor_name !== 'WINRED' && c.contributor_name !== 'ACTBLUE') {
        const key = c.contributor_name;
        if (!topDonorMap[key]) {
          topDonorMap[key] = {
            name: c.contributor_name,
            type: c.entity_type === 'IND' ? 'individual' : 'committee',
            industry: c.contributor_occupation || c.contributor_employer,
            total: 0,
            count: 0,
            contributorId,
          };
        }
        topDonorMap[key].total += c.contribution_receipt_amount || 0;
        topDonorMap[key].count++;
      }
    }

    const pagination = resp.pagination;
    hasMore = pagination && pagination.pages && page < pagination.pages;
    page++;

    await sleep(200);
  }

  // Save top 20 donors
  const topDonors = Object.values(topDonorMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  for (let i = 0; i < topDonors.length; i++) {
    const donor = topDonors[i];
    try {
      await db.query(`
        INSERT INTO candidate_top_donors (
          candidate_id, election_cycle, donor_name, donor_type,
          industry, total_amount, contribution_count, rank_overall,
          contributor_id, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'fec')
        ON CONFLICT (candidate_id, election_cycle, donor_name) DO UPDATE SET
          total_amount = EXCLUDED.total_amount,
          contribution_count = EXCLUDED.contribution_count,
          rank_overall = EXCLUDED.rank_overall
      `, [
        candidateId,
        String(cycle),
        donor.name,
        donor.type,
        donor.industry,
        donor.total,
        donor.count,
        i + 1,
        donor.contributorId,
      ]);
      stats.topDonors++;
    } catch (err) {
      // Skip
    }
  }

  if (totalSaved > 0) {
    console.log(`  Contributions: ${totalSaved} saved, ${topDonors.length} top donors`);
  }
}

/**
 * Upsert a contributor record
 */
async function upsertContributor({ name, type, employer, occupation, city, state, zip }) {
  // Check existing
  const existing = await db.query(
    'SELECT id FROM contributors WHERE name = $1 AND contributor_type = $2 AND COALESCE(state, \'\') = COALESCE($3, \'\')',
    [name, type, state]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const { rows } = await db.query(`
    INSERT INTO contributors (name, contributor_type, employer, occupation, city, state, zip)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [name, type, employer, occupation, city, state, zip]);
  stats.contributors++;
  return rows[0].id;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
