#!/usr/bin/env node

/**
 * Check PAC pledges against actual PAC contributions.
 *
 * Usage:
 *   node scripts/check-pac-violations.js
 *   node scripts/check-pac-violations.js --dry-run
 *
 * Required env vars:
 *   DATABASE_URL — PostgreSQL connection string
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`Checking PAC pledges for violations${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  // Get all active PAC pledges
  const { rows: pledges } = await pool.query(`
    SELECT pp.id AS pledge_id, pp.candidate_id, pp.pledge_date,
           pp.violation_detected, pp.pledge_text,
           cp.display_name
    FROM pac_pledges pp
    JOIN candidate_profiles cp ON cp.id = pp.candidate_id
    WHERE pp.is_active = TRUE
    ORDER BY pp.pledge_date DESC
  `);

  console.log(`Found ${pledges.length} active PAC pledges.\n`);

  let violations = 0;
  let clean = 0;
  let noData = 0;

  for (let i = 0; i < pledges.length; i++) {
    const pledge = pledges[i];
    const pledgeYear = new Date(pledge.pledge_date).getFullYear();

    console.log(`[${i + 1}/${pledges.length}] ${pledge.display_name || pledge.candidate_id} — pledged ${pledge.pledge_date}`);

    // Get campaign_finance_summaries for this candidate where election_cycle >= pledge year
    const { rows: financials } = await pool.query(`
      SELECT election_cycle, pac_contributions, total_raised
      FROM campaign_finance_summaries
      WHERE candidate_id = $1
        AND election_cycle::INTEGER >= $2
      ORDER BY election_cycle DESC
    `, [pledge.candidate_id, pledgeYear]);

    if (financials.length === 0) {
      console.log('  No finance data found for this candidate since pledge date.');
      noData++;
      continue;
    }

    // Sum PAC contributions across all relevant cycles
    let totalPacContributions = 0;
    for (const f of financials) {
      const pac = parseFloat(f.pac_contributions) || 0;
      if (pac > 0) {
        console.log(`  Cycle ${f.election_cycle}: PAC contributions = $${pac.toLocaleString()}`);
      }
      totalPacContributions += pac;
    }

    if (totalPacContributions > 0) {
      console.log(`  ** VIOLATION DETECTED: $${totalPacContributions.toLocaleString()} in PAC contributions`);
      violations++;

      if (!DRY_RUN) {
        await pool.query(`
          UPDATE pac_pledges
          SET violation_detected = TRUE,
              violation_amount = $1,
              violation_detected_at = NOW(),
              violation_details = $2,
              updated_at = NOW()
          WHERE id = $3
        `, [
          totalPacContributions,
          `PAC contributions totaling $${totalPacContributions.toLocaleString()} detected across ${financials.filter(f => parseFloat(f.pac_contributions) > 0).length} cycle(s) since pledge date.`,
          pledge.pledge_id
        ]);
      }
    } else {
      console.log('  Clean — no PAC contributions found.');
      clean++;

      // If previously flagged as violation, clear it (unless dry run)
      if (pledge.violation_detected && !DRY_RUN) {
        await pool.query(`
          UPDATE pac_pledges
          SET violation_detected = FALSE,
              violation_amount = NULL,
              violation_detected_at = NULL,
              violation_details = NULL,
              updated_at = NOW()
          WHERE id = $1
        `, [pledge.pledge_id]);
        console.log('  (Cleared previous violation flag)');
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Active pledges checked: ${pledges.length}`);
  console.log(`Violations found:       ${violations}`);
  console.log(`Clean:                  ${clean}`);
  console.log(`No data:                ${noData}`);
  if (DRY_RUN) console.log('(DRY RUN — no records were updated)');
  console.log('Done.');
}

main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
