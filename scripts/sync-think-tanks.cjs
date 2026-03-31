#!/usr/bin/env node

/**
 * Sync Think Tank Data
 *
 * Pulls IRS 990 filing data from ProPublica Nonprofit Explorer API
 * for all think tanks in the database. Extracts revenue, filing info,
 * and cross-references staff against candidate_profiles for revolving
 * door detection.
 *
 * Usage:
 *   node scripts/sync-think-tanks.js
 *   node scripts/sync-think-tanks.js --dry-run
 *   node scripts/sync-think-tanks.js --ein=53-0196577
 *
 * Required env vars:
 *   DATABASE_URL
 *
 * API: ProPublica Nonprofit Explorer (no key required)
 *   https://projects.propublica.org/nonprofits/api/v2/organizations/{ein}.json
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PROPUBLICA_BASE = 'https://projects.propublica.org/nonprofits/api/v2';

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = { dryRun: false, ein: null };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--ein=')) args.ein = arg.split('=')[1];
  }
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// ProPublica API
// ---------------------------------------------------------------------------

async function fetchOrganization(ein) {
  // ProPublica expects EIN without hyphens
  const cleanEin = ein.replace(/-/g, '');
  const url = `${PROPUBLICA_BASE}/organizations/${cleanEin}.json`;
  const resp = await axios.get(url, { timeout: 30000 });
  return resp.data;
}

// ---------------------------------------------------------------------------
// Data extraction
// ---------------------------------------------------------------------------

function extractFilingData(orgData) {
  const org = orgData.organization || {};
  const filings = orgData.filings_with_data || [];

  // Get latest filing
  const latestFiling = filings.length > 0 ? filings[0] : null;

  const result = {
    propublicaId: String(org.id || ''),
    totalRevenue: org.total_revenue || 0,
    latestFiscalYear: latestFiling ? latestFiling.tax_prd_yr : null,
    filings: [],
  };

  // Extract key data from recent filings (up to 5 years)
  for (const filing of filings.slice(0, 5)) {
    result.filings.push({
      fiscalYear: filing.tax_prd_yr,
      totalRevenue: filing.totrevenue || 0,
      totalExpenses: filing.totfuncexpns || 0,
      totalAssets: filing.totassetsend || 0,
      grantsPaid: filing.grntstogovt || 0,
      compensationTotal: filing.compnsatncurrofcrs || 0,
      pdfUrl: filing.pdf_url || null,
    });
  }

  return result;
}

function extractDonorInfo(orgData) {
  // ProPublica 990 data includes some donor/grant info from Schedule B
  // when available in digital filings. Most large donors are not public
  // for 501(c)(3) orgs, but grant-related revenue is visible.
  const filings = orgData.filings_with_data || [];
  const donors = [];

  for (const filing of filings.slice(0, 3)) {
    if (filing.totcntrbgfts && filing.totcntrbgfts > 0) {
      donors.push({
        donorName: 'Contributions & Grants (aggregate)',
        donorType: 'unknown',
        amount: filing.totcntrbgfts,
        fiscalYear: filing.tax_prd_yr,
        sourceUrl: filing.pdf_url || null,
      });
    }

    if (filing.totprgmrevnue && filing.totprgmrevnue > 0) {
      donors.push({
        donorName: 'Program Service Revenue (aggregate)',
        donorType: 'unknown',
        amount: filing.totprgmrevnue,
        fiscalYear: filing.tax_prd_yr,
        sourceUrl: filing.pdf_url || null,
      });
    }

    if (filing.invstmntinc && filing.invstmntinc > 0) {
      donors.push({
        donorName: 'Investment Income (aggregate)',
        donorType: 'unknown',
        amount: filing.invstmntinc,
        fiscalYear: filing.tax_prd_yr,
        sourceUrl: filing.pdf_url || null,
      });
    }
  }

  return donors;
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

async function getThinkTanks(ein) {
  let query = 'SELECT id, name, ein FROM think_tanks';
  const params = [];

  if (ein) {
    query += ' WHERE ein = $1';
    params.push(ein);
  }

  query += ' ORDER BY name';
  const { rows } = await pool.query(query, params);
  return rows;
}

async function updateThinkTankRevenue(client, thinkTankId, propublicaId, totalRevenue) {
  await client.query(
    `UPDATE think_tanks
     SET propublica_id = $1, total_revenue = $2, updated_at = NOW()
     WHERE id = $3`,
    [propublicaId, totalRevenue, thinkTankId]
  );
}

async function upsertFunding(client, thinkTankId, donor) {
  await client.query(
    `INSERT INTO think_tank_funding
       (think_tank_id, donor_name, donor_type, amount, fiscal_year, source_type, source_url, source_date)
     VALUES ($1, $2, $3, $4, $5, '990_filing', $6, NOW())`,
    [
      thinkTankId,
      donor.donorName,
      donor.donorType,
      donor.amount,
      donor.fiscalYear,
      donor.sourceUrl,
    ]
  );
}

async function crossReferenceStaff(client, thinkTankId) {
  // Find think_tank_staff entries that match candidate_profiles by name
  const { rows: staff } = await client.query(
    `SELECT tts.id, tts.person_name
     FROM think_tank_staff tts
     WHERE tts.think_tank_id = $1
       AND tts.candidate_id IS NULL
       AND tts.is_revolving_door = FALSE`,
    [thinkTankId]
  );

  let matches = 0;

  for (const s of staff) {
    // Try exact name match against candidate_profiles
    const { rows: candidates } = await client.query(
      `SELECT id, display_name
       FROM candidate_profiles
       WHERE LOWER(display_name) = LOWER($1)
       LIMIT 1`,
      [s.person_name]
    );

    if (candidates.length > 0) {
      await client.query(
        `UPDATE think_tank_staff
         SET candidate_id = $1, is_revolving_door = TRUE
         WHERE id = $2`,
        [candidates[0].id, s.id]
      );
      matches++;
      console.log(`    Revolving door match: ${s.person_name} -> ${candidates[0].display_name}`);
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  console.log(`\n=== Sync Think Tank Data ===`);
  console.log(`Source: ProPublica Nonprofit Explorer`);
  console.log(`Dry run: ${opts.dryRun}\n`);

  const thinkTanks = await getThinkTanks(opts.ein);
  console.log(`Found ${thinkTanks.length} think tanks to sync\n`);

  let synced = 0;
  let errors = 0;
  let revolvingDoorMatches = 0;

  for (const tt of thinkTanks) {
    console.log(`--- ${tt.name} (EIN: ${tt.ein}) ---`);

    if (!tt.ein) {
      console.log('  SKIP: No EIN');
      continue;
    }

    let orgData;
    try {
      orgData = await fetchOrganization(tt.ein);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('  NOT FOUND on ProPublica');
      } else {
        console.log(`  ERROR fetching: ${err.message}`);
      }
      errors++;
      await sleep(500);
      continue;
    }

    const filingData = extractFilingData(orgData);
    const donors = extractDonorInfo(orgData);

    console.log(`  Revenue: $${(filingData.totalRevenue || 0).toLocaleString()}`);
    console.log(`  Filings found: ${filingData.filings.length}`);
    console.log(`  Funding records to insert: ${donors.length}`);

    if (opts.dryRun) {
      console.log('  [DRY RUN] Would update database');
      await sleep(500);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update think tank with ProPublica data
      await updateThinkTankRevenue(
        client,
        tt.id,
        filingData.propublicaId,
        filingData.totalRevenue
      );

      // Clear old funding records for this think tank and re-insert
      await client.query(
        `DELETE FROM think_tank_funding
         WHERE think_tank_id = $1 AND source_type = '990_filing'`,
        [tt.id]
      );

      // Insert funding records
      for (const donor of donors) {
        await upsertFunding(client, tt.id, donor);
      }

      // Cross-reference staff with candidates
      const matches = await crossReferenceStaff(client, tt.id);
      revolvingDoorMatches += matches;

      await client.query('COMMIT');
      synced++;

      console.log(`  Synced successfully${matches > 0 ? ` (${matches} revolving door matches)` : ''}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ERROR processing: ${err.message}`);
      errors++;
    } finally {
      client.release();
    }

    // Rate limiting: 500ms between ProPublica calls
    await sleep(500);
  }

  console.log(`\n=== Sync Complete ===`);
  console.log(`Synced: ${synced}  Errors: ${errors}  Total: ${thinkTanks.length}`);
  console.log(`Revolving door matches: ${revolvingDoorMatches}`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
