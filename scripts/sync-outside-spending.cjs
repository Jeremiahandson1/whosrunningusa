#!/usr/bin/env node

/**
 * Sync Outside Spending (Dark Money)
 *
 * Pulls FEC independent expenditure (Schedule E) data for candidates
 * with known FEC IDs. Classifies spending groups as Super PACs or
 * 501(c)(4) dark money orgs and calculates dark money summaries.
 *
 * Usage:
 *   node scripts/sync-outside-spending.js
 *   node scripts/sync-outside-spending.js --cycle=2026
 *   node scripts/sync-outside-spending.js --state=TX
 *   node scripts/sync-outside-spending.js --dry-run
 *
 * Required env vars:
 *   DATABASE_URL
 *   FEC_API_KEY
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const FEC_BASE = 'https://api.open.fec.gov/v1';
const FEC_API_KEY = process.env.FEC_API_KEY;

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = { dryRun: false, cycle: 2026, state: null };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--cycle=')) args.cycle = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--state=')) args.state = arg.split('=')[1].toUpperCase();
  }
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// FEC API helpers
// ---------------------------------------------------------------------------

async function fecGet(path, params = {}) {
  params.api_key = FEC_API_KEY;
  const url = `${FEC_BASE}${path}`;
  const resp = await axios.get(url, { params, timeout: 30000 });
  return resp.data;
}

async function fetchAllScheduleE(fecCandidateId, cycle) {
  const results = [];
  const seen = new Set();
  let lastIndex = null;
  let lastExpenditureDate = null;

  while (true) {
    const params = {
      candidate_id: fecCandidateId,
      cycle,
      per_page: 100,
      sort: '-expenditure_date',
    };
    if (lastIndex) {
      params.last_index = lastIndex;
      params.last_expenditure_date = lastExpenditureDate;
    }

    const data = await fecGet('/schedules/schedule_e/', params);
    if (!data.results || data.results.length === 0) break;

    // Dedup by sub_id and bail out if the seek cursor stalls (a null
    // last_expenditure_date gets dropped from params and the API re-serves
    // the same window) — without this the loop appends the same page until
    // results.length reaches pagination.count, multiplying totals.
    let added = 0;
    for (const r of data.results) {
      const key = r.sub_id
        || `${r.transaction_id || ''}|${r.committee_id}|${r.expenditure_date}|${r.expenditure_amount}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(r);
      added++;
    }
    if (added === 0) break;

    if (!data.pagination || !data.pagination.last_indexes) break;
    lastIndex = data.pagination.last_indexes.last_index;
    lastExpenditureDate = data.pagination.last_indexes.last_expenditure_date;

    if (results.length >= data.pagination.count) break;

    await sleep(100);
  }

  return results;
}

async function fetchCommitteeDetails(committeeId) {
  const data = await fecGet(`/committee/${committeeId}/`);
  return data.results && data.results.length > 0 ? data.results[0] : null;
}

// ---------------------------------------------------------------------------
// Group classification
// ---------------------------------------------------------------------------

function classifyGroup(committee) {
  const committeeType = (committee.committee_type || '').toUpperCase();
  const designation = (committee.designation || '').toUpperCase();
  const orgType = (committee.organization_type || '').toUpperCase();
  const orgTypeDesc = (committee.organization_type_full || '').toLowerCase();

  const is501c4 = committeeType === 'V' || orgType.includes('501(C)(4)') || orgTypeDesc.includes('501(c)(4)');
  const isSuperPac = committeeType === 'O' && designation === 'U';

  return { is501c4, isSuperPac };
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

async function getCandidates(state) {
  let query = `
    SELECT id, fec_candidate_id, display_name, fec_state
    FROM candidate_profiles
    WHERE fec_candidate_id IS NOT NULL AND fec_candidate_id != ''
  `;
  const params = [];

  if (state) {
    params.push(state);
    query += ` AND fec_state = $${params.length}`;
  }

  query += ' ORDER BY display_name';
  const { rows } = await pool.query(query, params);
  return rows;
}

async function upsertSpendingGroup(client, group, cycle) {
  const { rows } = await client.query(
    `INSERT INTO outside_spending_groups
       (fec_committee_id, name, organization_type, designation, filing_frequency,
        is_501c4, is_super_pac, cycle_year, source_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (fec_committee_id) DO UPDATE SET
       name = EXCLUDED.name,
       organization_type = EXCLUDED.organization_type,
       designation = EXCLUDED.designation,
       filing_frequency = EXCLUDED.filing_frequency,
       is_501c4 = EXCLUDED.is_501c4,
       is_super_pac = EXCLUDED.is_super_pac,
       cycle_year = EXCLUDED.cycle_year,
       source_url = EXCLUDED.source_url,
       updated_at = NOW()
     RETURNING id, is_501c4, donor_disclosure_percentage`,
    [
      group.fec_committee_id,
      group.name,
      group.organization_type,
      group.designation,
      group.filing_frequency,
      group.is_501c4,
      group.is_super_pac,
      cycle,
      `https://www.fec.gov/data/independent-expenditures/?data_type=processed&committee_id=${group.fec_committee_id}`,
    ]
  );
  return rows[0];
}

async function insertTransaction(client, tx, groupId, candidateId, cycle) {
  await client.query(
    `INSERT INTO outside_spending_transactions
       (group_id, candidate_id, fec_candidate_id, fec_filing_id, amount,
        expenditure_date, support_oppose, expenditure_description,
        payee_name, state, office, cycle_year, source_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      groupId,
      candidateId,
      tx.candidate_id,
      tx.filing ? String(tx.filing.filing_id) : null,
      tx.expenditure_amount || 0,
      tx.expenditure_date || null,
      tx.support_oppose_indicator === 'S' ? 'support' : 'oppose',
      tx.expenditure_description || null,
      tx.payee_name || null,
      tx.candidate_state || null,
      tx.candidate_office_full || null,
      cycle,
      `https://www.fec.gov/data/independent-expenditures/?data_type=processed&committee_id=${tx.committee_id}`,
    ]
  );
}

async function upsertDarkMoneySummary(client, candidateId, cycle, stats) {
  const darkMoneyPct = stats.totalOutside > 0
    ? ((stats.unaccounted / stats.totalOutside) * 100).toFixed(2)
    : 0;

  await client.query(
    `INSERT INTO dark_money_summaries
       (candidate_id, cycle_year, total_outside_spending, total_supporting,
        total_opposing, disclosed_amount, unaccounted_amount, dark_money_percentage,
        group_count, c4_group_count, c4_total_spent, last_updated)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (candidate_id, cycle_year) DO UPDATE SET
       total_outside_spending = EXCLUDED.total_outside_spending,
       total_supporting = EXCLUDED.total_supporting,
       total_opposing = EXCLUDED.total_opposing,
       disclosed_amount = EXCLUDED.disclosed_amount,
       unaccounted_amount = EXCLUDED.unaccounted_amount,
       dark_money_percentage = EXCLUDED.dark_money_percentage,
       group_count = EXCLUDED.group_count,
       c4_group_count = EXCLUDED.c4_group_count,
       c4_total_spent = EXCLUDED.c4_total_spent,
       last_updated = NOW()`,
    [
      candidateId,
      cycle,
      stats.totalOutside,
      stats.totalSupporting,
      stats.totalOpposing,
      stats.disclosed,
      stats.unaccounted,
      darkMoneyPct,
      stats.groupCount,
      stats.c4GroupCount,
      stats.c4TotalSpent,
    ]
  );
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  if (!FEC_API_KEY) {
    console.error('ERROR: FEC_API_KEY is not set. Get one at https://api.open.fec.gov/developers/');
    process.exit(1);
  }

  console.log(`\n=== Sync Outside Spending ===`);
  console.log(`Cycle: ${opts.cycle}  State: ${opts.state || 'ALL'}  Dry run: ${opts.dryRun}\n`);

  const candidates = await getCandidates(opts.state);
  console.log(`Found ${candidates.length} candidates with FEC IDs\n`);

  let totalTransactions = 0;
  let totalGroups = 0;
  let totalAmount = 0;

  for (const candidate of candidates) {
    console.log(`--- ${candidate.display_name} (${candidate.fec_candidate_id}) ---`);

    let expenditures;
    try {
      expenditures = await fetchAllScheduleE(candidate.fec_candidate_id, opts.cycle);
    } catch (err) {
      console.log(`  ERROR fetching Schedule E: ${err.message}`);
      await sleep(100);
      continue;
    }

    if (expenditures.length === 0) {
      console.log('  No independent expenditures found');
      continue;
    }

    // Sanity cap: the FEC processed feed contains unvalidated filer-entered
    // amounts, including outright garbage (real example: two "expenditures"
    // of $8B and $9B against one candidate, payee "SHAWN BETTIS/TANKING").
    // The largest legitimate single independent expenditures are low tens of
    // millions; anything above the cap is skipped and logged, never summed.
    const MAX_PLAUSIBLE_IE_AMOUNT = 50_000_000;
    const implausible = expenditures.filter(
      e => (parseFloat(e.expenditure_amount) || 0) > MAX_PLAUSIBLE_IE_AMOUNT
    );
    for (const e of implausible) {
      console.log(`  SKIPPING implausible amount $${Number(e.expenditure_amount).toLocaleString()} `
        + `(committee ${e.committee_id}, payee "${e.payee_name || '?'}") — over $${MAX_PLAUSIBLE_IE_AMOUNT.toLocaleString()} cap`);
    }
    if (implausible.length > 0) {
      expenditures = expenditures.filter(
        e => (parseFloat(e.expenditure_amount) || 0) <= MAX_PLAUSIBLE_IE_AMOUNT
      );
      if (expenditures.length === 0) {
        console.log('  No plausible expenditures remain');
        continue;
      }
    }

    console.log(`  Found ${expenditures.length} expenditure records`);

    // Collect unique committees
    const committeeIds = [...new Set(expenditures.map(e => e.committee_id).filter(Boolean))];
    console.log(`  ${committeeIds.length} unique spending groups`);

    // Fetch committee details
    const committeeMap = {};
    for (const cid of committeeIds) {
      try {
        const details = await fetchCommitteeDetails(cid);
        if (details) {
          const { is501c4, isSuperPac } = classifyGroup(details);
          committeeMap[cid] = {
            fec_committee_id: cid,
            name: details.name || 'Unknown Committee',
            organization_type: details.organization_type || null,
            designation: details.designation || null,
            filing_frequency: details.filing_frequency || null,
            is_501c4: is501c4,
            is_super_pac: isSuperPac,
          };
        }
      } catch (err) {
        console.log(`  WARNING: could not fetch committee ${cid}: ${err.message}`);
      }
      await sleep(100);
    }

    if (opts.dryRun) {
      let support = 0;
      let oppose = 0;
      for (const e of expenditures) {
        const amt = parseFloat(e.expenditure_amount) || 0;
        if (e.support_oppose_indicator === 'S') support += amt;
        else oppose += amt;
      }
      console.log(`  [DRY RUN] Would insert ${expenditures.length} transactions`);
      console.log(`  [DRY RUN] Supporting: $${support.toLocaleString()}  Opposing: $${oppose.toLocaleString()}`);
      continue;
    }

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Snapshot semantics: replace this candidate/cycle's transactions
      // instead of appending — the bare INSERT (no unique key on the table)
      // used to duplicate the full result set on every nightly run.
      await client.query(
        `DELETE FROM outside_spending_transactions WHERE candidate_id = $1 AND cycle_year = $2`,
        [candidate.id, opts.cycle]
      );

      // Upsert groups and build group_id map
      const groupIdMap = {};
      const groupMetaMap = {};
      for (const [cid, group] of Object.entries(committeeMap)) {
        const row = await upsertSpendingGroup(client, group, opts.cycle);
        groupIdMap[cid] = row.id;
        groupMetaMap[cid] = {
          is501c4: row.is_501c4,
          donorDisclosurePct: parseFloat(row.donor_disclosure_percentage) || 0,
        };
        totalGroups++;
      }

      // Insert transactions
      let totalOutside = 0;
      let totalSupporting = 0;
      let totalOpposing = 0;

      for (const e of expenditures) {
        const groupId = groupIdMap[e.committee_id] || null;
        if (!groupId) continue;

        await insertTransaction(client, e, groupId, candidate.id, opts.cycle);

        const amt = parseFloat(e.expenditure_amount) || 0;
        totalOutside += amt;
        if (e.support_oppose_indicator === 'S') totalSupporting += amt;
        else totalOpposing += amt;

        totalTransactions++;
        totalAmount += amt;
      }

      // Calculate dark money summary
      let disclosed = 0;
      let c4GroupCount = 0;
      let c4TotalSpent = 0;

      // Sum per-group spending for disclosure calculation
      const groupSpending = {};
      for (const e of expenditures) {
        const cid = e.committee_id;
        if (!groupSpending[cid]) groupSpending[cid] = 0;
        groupSpending[cid] += parseFloat(e.expenditure_amount) || 0;
      }

      for (const [cid, spent] of Object.entries(groupSpending)) {
        const meta = groupMetaMap[cid];
        if (!meta) continue;

        if (meta.donorDisclosurePct > 0) {
          disclosed += spent;
        }
        if (meta.is501c4) {
          c4GroupCount++;
          c4TotalSpent += spent;
        }
      }

      const unaccounted = totalOutside - disclosed;

      await upsertDarkMoneySummary(client, candidate.id, opts.cycle, {
        totalOutside,
        totalSupporting,
        totalOpposing,
        disclosed,
        unaccounted,
        groupCount: committeeIds.length,
        c4GroupCount,
        c4TotalSpent,
      });

      await client.query('COMMIT');

      const darkPct = totalOutside > 0 ? ((unaccounted / totalOutside) * 100).toFixed(1) : 0;
      console.log(`  Inserted ${expenditures.length} transactions from ${committeeIds.length} groups`);
      console.log(`  Total: $${totalOutside.toLocaleString()}  Dark money: ${darkPct}%`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ERROR processing ${candidate.display_name}: ${err.message}`);
    } finally {
      client.release();
    }
  }

  console.log(`\n=== Sync Complete ===`);
  console.log(`Transactions: ${totalTransactions}`);
  console.log(`Groups: ${totalGroups}`);
  console.log(`Total spending: $${totalAmount.toLocaleString()}`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
