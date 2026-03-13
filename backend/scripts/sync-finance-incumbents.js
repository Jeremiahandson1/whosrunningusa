#!/usr/bin/env node

/**
 * Targeted finance sync for congressional incumbents.
 * Faster than sync-finance.js because it skips contributor/contribution detail
 * and focuses on getting finance summaries for all sitting members.
 *
 * Usage:
 *   node sync-finance-incumbents.js           # All incumbents (S + H)
 *   node sync-finance-incumbents.js --senate  # Senate only
 *   node sync-finance-incumbents.js --house   # House only
 *   node sync-finance-incumbents.js --cycle=2024
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');
const FECClient = require('../services/ingestion/fecClient');
const fec = new FECClient();

const args = process.argv.slice(2);
const cycleFlag = args.find(a => a.startsWith('--cycle='));
const cycle = cycleFlag ? parseInt(cycleFlag.split('=')[1]) : 2024;
const senateOnly = args.includes('--senate');
const houseOnly = args.includes('--house');

const officeFilter = senateOnly ? "'S'" : houseOnly ? "'H'" : "'S','H','P'";
const stats = { processed: 0, summaries: 0, skipped: 0, errors: 0 };

async function main() {
  if (!process.env.FEC_API_KEY) {
    console.error('ERROR: FEC_API_KEY required');
    process.exit(1);
  }

  const { rows } = await db.query(`
    SELECT cp.id, cp.fec_candidate_id, cp.display_name
    FROM candidate_profiles cp
    JOIN candidate_source_links csl ON cp.id = csl.candidate_id
      AND csl.data_source_id = '00000000-0000-0000-0000-000000000001'
    WHERE csl.external_data->>'incumbent_challenge' = 'I'
      AND csl.external_data->>'office' IN (${officeFilter})
    ORDER BY cp.display_name
  `);

  console.log(`\nSyncing finance for ${rows.length} incumbents (cycle ${cycle})\n`);

  for (let i = 0; i < rows.length; i++) {
    const c = rows[i];
    process.stdout.write(`[${i + 1}/${rows.length}] ${c.display_name}... `);

    try {
      // Get committee via search endpoint (only one that returns committees)
      const resp = await fec.request('/candidates/search/', {
        candidate_id: c.fec_candidate_id,
        per_page: 1,
      });
      const committeeId = resp.results?.[0]?.principal_committees?.[0]?.committee_id;
      if (!committeeId) {
        console.log('no committee');
        stats.skipped++;
        continue;
      }

      // Get financial totals
      const totalsResp = await fec.getCommitteeTotals(committeeId, cycle);
      const totals = totalsResp.results?.[0];
      if (!totals || !totals.receipts) {
        console.log('no data');
        stats.skipped++;
        continue;
      }

      // Upsert finance summary
      await db.query(`
        INSERT INTO campaign_finance_summaries (
          candidate_id, election_cycle, total_raised, total_spent,
          cash_on_hand, debt, individual_contributions, pac_contributions,
          party_contributions, self_financing, other_contributions,
          coverage_start_date, coverage_end_date,
          source, source_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                  'fec', $14)
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
          coverage_start_date = EXCLUDED.coverage_start_date,
          coverage_end_date = EXCLUDED.coverage_end_date,
          updated_at = NOW()
      `, [
        c.id,
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
        totals.coverage_start_date || null,
        totals.coverage_end_date || null,
        `https://www.fec.gov/data/candidate/${c.fec_candidate_id}/`,
      ]);

      const raised = ((totals.receipts || 0) / 1e6).toFixed(1);
      console.log(`$${raised}M raised`);
      stats.summaries++;
      stats.processed++;

      // Rate limit: ~2 API calls per candidate, 1000/hr limit
      await new Promise(r => setTimeout(r, 400));

    } catch (err) {
      if (err.message.includes('429') || err.message.includes('OVER_RATE_LIMIT')) {
        console.log('RATE LIMITED - waiting 60s');
        await new Promise(r => setTimeout(r, 60000));
        i--; // retry this candidate
      } else {
        console.log('ERROR:', err.message.slice(0, 100));
        stats.errors++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Finance Sync Complete');
  console.log(`Processed: ${stats.processed}`);
  console.log(`Summaries: ${stats.summaries}`);
  console.log(`Skipped:   ${stats.skipped}`);
  console.log(`Errors:    ${stats.errors}`);
  console.log('='.repeat(50));

  await db.pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
