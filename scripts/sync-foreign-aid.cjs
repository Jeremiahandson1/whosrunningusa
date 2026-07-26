#!/usr/bin/env node

/**
 * Sync Foreign Aid Data from USASpending.gov
 *
 * Pulls foreign aid spending data from the USASpending.gov API, classifies
 * transactions by category (military, economic, humanitarian, etc.), and
 * upserts into foreign_aid_transactions, foreign_aid_country_summaries,
 * and foreign_aid_programs tables.
 *
 * Usage:
 *   node scripts/sync-foreign-aid.js
 *   node scripts/sync-foreign-aid.js --year=2025
 *   node scripts/sync-foreign-aid.js --country=ISR
 *   node scripts/sync-foreign-aid.js --dry-run
 *   node scripts/sync-foreign-aid.js --year=2024 --country=UKR --dry-run
 *
 * Required env vars:
 *   DATABASE_URL
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
const USASpendingClient = require('../backend/services/ingestion/usaSpendingClient');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

function parseArgs() {
  // Default fiscal year: if we're past October, it's the next calendar year's FY
  const now = new Date();
  const defaultFY = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();

  const args = { dryRun: false, year: defaultFY, country: null };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--year=')) args.year = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--country=')) args.country = arg.split('=')[1].toUpperCase();
  }
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Fetch all awards for a country, paginating through results
// ---------------------------------------------------------------------------

async function fetchAllAwardsForCountry(client, countryCode, fiscalYear) {
  const allResults = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await client.getAwardsByCountry(countryCode, fiscalYear, page);
    const results = response.results || [];

    if (results.length === 0) {
      hasMore = false;
    } else {
      allResults.push(...results);
      page++;
      // USASpending returns hasNext or we check against limit
      hasMore = results.length >= 100;
    }
  }

  return allResults;
}

// ---------------------------------------------------------------------------
// Collect unique countries from the initial broad search
// ---------------------------------------------------------------------------

async function fetchCountryList(client, fiscalYear) {
  const countries = new Map(); // code -> name
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await client.getAwardsByCountry('FOREIGN', fiscalYear, page);
    const results = response.results || [];

    if (results.length === 0) {
      hasMore = false;
    } else {
      for (const award of results) {
        const code = award['Place of Performance Country Code'];
        const name = award['Place of Performance Country Name'];
        if (code && code !== 'USA' && code !== 'FOREIGN') {
          countries.set(code, name || code);
        }
      }
      page++;
      hasMore = results.length >= 100;
      // Safety limit to avoid runaway pagination
      if (page > 50) {
        console.warn('Reached 50 pages of country list results, stopping pagination.');
        hasMore = false;
      }
    }
  }

  return countries;
}

// ---------------------------------------------------------------------------
// Upsert a single transaction
// ---------------------------------------------------------------------------

async function upsertTransaction(award, category, fiscalYear, countryCode, countryName) {
  const awardId = award['Award ID'] || award['generated_internal_id'];
  if (!awardId) return null;

  // The spending_by_award endpoint returns 'Place of Performance Country
  // Name' as null (verified 2026-07), and country_code/country_name are
  // NOT NULL — fall back to the country being processed.
  const code = award['Place of Performance Country Code'] || countryCode;
  const name = award['Place of Performance Country Name'] || countryName || code;

  const amount = parseFloat(award['Award Amount']) || 0;
  const outlays = parseFloat(award['Total Outlays']) || 0;
  const sourceUrl = `https://www.usaspending.gov/award/${encodeURIComponent(awardId)}`;

  const { rows } = await pool.query(
    `INSERT INTO foreign_aid_transactions
       (usaspending_award_id, country_code, country_name, fiscal_year,
        obligation_amount, disbursement_amount, program_name, agency_name,
        recipient_name, program_description, category, source_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (usaspending_award_id) DO UPDATE SET
       obligation_amount = EXCLUDED.obligation_amount,
       disbursement_amount = EXCLUDED.disbursement_amount,
       category = EXCLUDED.category,
       program_description = EXCLUDED.program_description,
       agency_name = EXCLUDED.agency_name,
       recipient_name = EXCLUDED.recipient_name,
       updated_at = NOW()
     RETURNING id`,
    [
      awardId,
      code,
      name,
      fiscalYear,
      amount,
      outlays,
      award['CFDA Number'] || null,
      award['Awarding Agency'] || null,
      award['Recipient Name'] || null,
      award['Description'] || null,
      category,
      sourceUrl,
    ]
  );

  return rows[0];
}

// ---------------------------------------------------------------------------
// Aggregate and upsert country summary
// ---------------------------------------------------------------------------

async function upsertCountrySummary(countryCode, countryName, fiscalYear) {
  await pool.query(
    `INSERT INTO foreign_aid_country_summaries
       (country_code, country_name, fiscal_year,
        total_obligation, total_disbursement,
        military_amount, economic_amount, humanitarian_amount,
        democracy_amount, health_amount, other_amount,
        program_count)
     SELECT
       country_code,
       $2,
       fiscal_year,
       COALESCE(SUM(obligation_amount), 0),
       COALESCE(SUM(disbursement_amount), 0),
       COALESCE(SUM(CASE WHEN category = 'military' THEN obligation_amount ELSE 0 END), 0),
       COALESCE(SUM(CASE WHEN category = 'economic' THEN obligation_amount ELSE 0 END), 0),
       COALESCE(SUM(CASE WHEN category = 'humanitarian' THEN obligation_amount ELSE 0 END), 0),
       COALESCE(SUM(CASE WHEN category = 'democracy_promotion' THEN obligation_amount ELSE 0 END), 0),
       COALESCE(SUM(CASE WHEN category = 'health' THEN obligation_amount ELSE 0 END), 0),
       COALESCE(SUM(CASE WHEN category = 'other' THEN obligation_amount ELSE 0 END), 0),
       COUNT(*)
     FROM foreign_aid_transactions
     WHERE country_code = $1 AND fiscal_year = $3
     GROUP BY country_code, fiscal_year
     ON CONFLICT (country_code, fiscal_year) DO UPDATE SET
       country_name = EXCLUDED.country_name,
       total_obligation = EXCLUDED.total_obligation,
       total_disbursement = EXCLUDED.total_disbursement,
       military_amount = EXCLUDED.military_amount,
       economic_amount = EXCLUDED.economic_amount,
       humanitarian_amount = EXCLUDED.humanitarian_amount,
       democracy_amount = EXCLUDED.democracy_amount,
       health_amount = EXCLUDED.health_amount,
       other_amount = EXCLUDED.other_amount,
       program_count = EXCLUDED.program_count,
       updated_at = NOW()`,
    [countryCode, countryName, fiscalYear]
  );
}

// ---------------------------------------------------------------------------
// Aggregate and upsert program-level summaries
// ---------------------------------------------------------------------------

async function upsertProgramSummaries(countryCode, countryName, fiscalYear) {
  await pool.query(
    `INSERT INTO foreign_aid_programs
       (country_code, country_name, fiscal_year, program_name, agency_name,
        category, total_obligation, total_disbursement, transaction_count)
     SELECT
       country_code,
       $2,
       fiscal_year,
       COALESCE(program_name, 'Unknown Program'),
       COALESCE(agency_name, 'Unknown Agency'),
       mode() WITHIN GROUP (ORDER BY category),
       COALESCE(SUM(obligation_amount), 0),
       COALESCE(SUM(disbursement_amount), 0),
       COUNT(*)
     FROM foreign_aid_transactions
     WHERE country_code = $1 AND fiscal_year = $3
     GROUP BY country_code, fiscal_year, COALESCE(program_name, 'Unknown Program'), COALESCE(agency_name, 'Unknown Agency')
     ON CONFLICT (country_code, fiscal_year, program_name, agency_name) DO UPDATE SET
       category = EXCLUDED.category,
       total_obligation = EXCLUDED.total_obligation,
       total_disbursement = EXCLUDED.total_disbursement,
       transaction_count = EXCLUDED.transaction_count,
       updated_at = NOW()`,
    [countryCode, countryName, fiscalYear]
  );
}

// ---------------------------------------------------------------------------
// Process a single country
// ---------------------------------------------------------------------------

async function processCountry(client, countryCode, countryName, fiscalYear, dryRun) {
  console.log(`\nProcessing ${countryName} (${countryCode}) for FY${fiscalYear}...`);

  const awards = await fetchAllAwardsForCountry(client, countryCode, fiscalYear);
  console.log(`  Found ${awards.length} awards`);

  if (awards.length === 0) return { inserted: 0, categories: {} };

  const categories = {};
  let inserted = 0;

  for (const award of awards) {
    const category = client.classifyCategory(
      award['CFDA Number'],
      award['Awarding Agency'] || award['Awarding Sub Agency'],
      award['Description']
    );

    categories[category] = (categories[category] || 0) + 1;

    if (dryRun) {
      inserted++;
      continue;
    }

    const result = await upsertTransaction(award, category, fiscalYear, countryCode, countryName);
    if (result) inserted++;
  }

  // Aggregate summaries
  if (!dryRun && inserted > 0) {
    await upsertCountrySummary(countryCode, countryName, fiscalYear);
    await upsertProgramSummaries(countryCode, countryName, fiscalYear);
  }

  // Log category breakdown
  const breakdown = Object.entries(categories)
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(', ');
  console.log(`  Upserted ${inserted} transactions (${breakdown})`);

  return { inserted, categories };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  console.log('=== Foreign Aid Data Sync ===');
  console.log(`Fiscal Year: ${args.year}`);
  console.log(`Dry run: ${args.dryRun}`);
  if (args.country) console.log(`Country filter: ${args.country}`);
  console.log('');

  const client = new USASpendingClient();

  let countries;

  if (args.country) {
    // Single country mode
    countries = new Map([[args.country, args.country]]);
  } else {
    // Discover countries from the broad search
    console.log('Discovering countries with foreign aid spending...');
    countries = await fetchCountryList(client, args.year);
    console.log(`Found ${countries.size} countries with spending data`);
  }

  let totalInserted = 0;
  let totalCountries = 0;
  const globalCategories = {};

  for (const [countryCode, countryName] of countries) {
    try {
      const { inserted, categories } = await processCountry(
        client, countryCode, countryName, args.year, args.dryRun
      );

      totalInserted += inserted;
      if (inserted > 0) totalCountries++;

      for (const [cat, count] of Object.entries(categories)) {
        globalCategories[cat] = (globalCategories[cat] || 0) + count;
      }
    } catch (err) {
      console.error(`  Error processing ${countryCode}: ${err.message}`);
      // Continue with next country rather than failing entirely
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Countries processed: ${totalCountries}`);
  console.log(`Total transactions upserted: ${totalInserted}`);
  console.log(`API requests made: ${client.requestCount}`);

  if (Object.keys(globalCategories).length > 0) {
    console.log('\nCategory breakdown:');
    for (const [cat, count] of Object.entries(globalCategories).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cat}: ${count}`);
    }
  }

  if (args.dryRun) {
    console.log('\n[dry-run] No database changes were made.');
  }
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
