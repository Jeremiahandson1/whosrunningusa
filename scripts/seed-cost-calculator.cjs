#!/usr/bin/env node

/**
 * Seed Cost Calculator
 *
 * Populates cost_calculator_items and income_brackets tables with real
 * federal spending items and IRS-derived income bracket data.
 *
 * Usage:
 *   node scripts/seed-cost-calculator.js
 *   node scripts/seed-cost-calculator.js --dry-run
 *
 * Required env vars:
 *   DATABASE_URL
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const dryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Cost Calculator Items (real figures with cited sources)
// ---------------------------------------------------------------------------

const COST_ITEMS = [
  {
    slug: 'iraq-war',
    title: 'Iraq War',
    description: 'Total cost of the Iraq War including operations, veteran care, and interest on war borrowing. Brown University Costs of War project estimate.',
    total_cost: 2400000000000,
    cost_display: '$2.4 Trillion',
    cost_type: 'military',
    fiscal_year: 2003,
    duration_years: 20,
    source_url: 'https://watson.brown.edu/costsofwar/costs/economic',
    source_label: 'Brown University Costs of War Project / CBO',
  },
  {
    slug: 'afghanistan-war',
    title: 'Afghanistan War',
    description: 'Total cost of the war in Afghanistan spanning 2001-2021, including direct spending, veteran care, and interest. Brown University estimate.',
    total_cost: 2300000000000,
    cost_display: '$2.3 Trillion',
    cost_type: 'military',
    fiscal_year: 2001,
    duration_years: 20,
    source_url: 'https://watson.brown.edu/costsofwar/costs/economic',
    source_label: 'Brown University Costs of War Project',
  },
  {
    slug: 'tarp-bank-bailout',
    title: '2008 Bank Bailout (TARP)',
    description: 'Troubled Asset Relief Program authorized $700B; Treasury disbursed $443.5B to stabilize financial institutions during the 2008 crisis.',
    total_cost: 443500000000,
    cost_display: '$443.5 Billion',
    cost_type: 'bailout',
    fiscal_year: 2008,
    duration_years: 7,
    source_url: 'https://home.treasury.gov/data/troubled-assets-relief-program',
    source_label: 'U.S. Department of the Treasury',
  },
  {
    slug: 'cares-act',
    title: 'COVID Relief (CARES Act)',
    description: 'Coronavirus Aid, Relief, and Economic Security Act providing stimulus checks, enhanced unemployment, PPP loans, and hospital funding.',
    total_cost: 2200000000000,
    cost_display: '$2.2 Trillion',
    cost_type: 'program',
    fiscal_year: 2020,
    duration_years: 2,
    source_url: 'https://home.treasury.gov/policy-issues/coronavirus',
    source_label: 'U.S. Department of the Treasury',
  },
  {
    slug: 'american-rescue-plan',
    title: 'COVID Relief (American Rescue Plan)',
    description: 'American Rescue Plan Act providing $1,400 stimulus checks, extended unemployment benefits, state/local aid, and vaccination funding.',
    total_cost: 1900000000000,
    cost_display: '$1.9 Trillion',
    cost_type: 'program',
    fiscal_year: 2021,
    duration_years: 2,
    source_url: 'https://www.cbo.gov/publication/57056',
    source_label: 'Congressional Budget Office',
  },
  {
    slug: 'infrastructure-investment-act',
    title: 'Infrastructure Investment and Jobs Act',
    description: 'Bipartisan infrastructure law funding roads, bridges, broadband, rail, water systems, and electric grid modernization over 10 years.',
    total_cost: 1200000000000,
    cost_display: '$1.2 Trillion',
    cost_type: 'program',
    fiscal_year: 2021,
    duration_years: 10,
    source_url: 'https://www.cbo.gov/publication/57406',
    source_label: 'Congressional Budget Office',
  },
  {
    slug: 'inflation-reduction-act',
    title: 'Inflation Reduction Act',
    description: 'Climate, energy, and health spending including clean energy tax credits, Medicare drug negotiation, and ACA subsidy extensions.',
    total_cost: 891000000000,
    cost_display: '$891 Billion',
    cost_type: 'program',
    fiscal_year: 2022,
    duration_years: 10,
    source_url: 'https://www.cbo.gov/publication/58455',
    source_label: 'Congressional Budget Office',
  },
  {
    slug: 'tcja-tax-cuts',
    title: '2017 Tax Cuts (TCJA Revenue Loss)',
    description: 'Tax Cuts and Jobs Act reduced corporate rate to 21% and cut individual rates, resulting in estimated $1.9T revenue loss over 10 years.',
    total_cost: 1900000000000,
    cost_display: '$1.9 Trillion',
    cost_type: 'budget',
    fiscal_year: 2017,
    duration_years: 10,
    source_url: 'https://www.cbo.gov/publication/53787',
    source_label: 'Congressional Budget Office',
  },
  {
    slug: 'ukraine-aid-2022-2026',
    title: 'Ukraine Aid (2022-2026 Total)',
    description: 'Combined military, economic, and humanitarian assistance to Ukraine across multiple supplemental appropriations from 2022 through 2026.',
    total_cost: 175000000000,
    cost_display: '$175 Billion',
    cost_type: 'foreign_aid',
    fiscal_year: 2022,
    duration_years: 4,
    source_url: 'https://www.state.gov/united-states-security-cooperation-with-ukraine',
    source_label: 'U.S. Department of State',
  },
  {
    slug: 'israel-aid-annual',
    title: 'Israel Aid (Annual)',
    description: 'Annual bilateral military aid under the 2016 Memorandum of Understanding providing $3.8B per year in security assistance.',
    total_cost: 3800000000,
    cost_display: '$3.8 Billion/year',
    cost_type: 'foreign_aid',
    fiscal_year: 2024,
    duration_years: 1,
    source_url: 'https://www.state.gov/u-s-relations-with-israel/',
    source_label: 'U.S. Department of State',
  },
  {
    slug: 'student-loan-forgiveness',
    title: 'Student Loan Forgiveness',
    description: 'Estimated cost of broad student loan forgiveness programs including SAVE plan and related executive actions. CBO score.',
    total_cost: 430000000000,
    cost_display: '$430 Billion',
    cost_type: 'program',
    fiscal_year: 2022,
    duration_years: 10,
    source_url: 'https://www.cbo.gov/publication/58494',
    source_label: 'Congressional Budget Office',
  },
  {
    slug: 'fannie-freddie-bailout',
    title: 'Fannie Mae / Freddie Mac Bailout',
    description: 'Federal conservatorship of Fannie Mae and Freddie Mac during 2008 housing crisis. Treasury injected $191B in preferred stock purchases.',
    total_cost: 191000000000,
    cost_display: '$191 Billion',
    cost_type: 'bailout',
    fiscal_year: 2008,
    duration_years: 1,
    source_url: 'https://www.fhfa.gov/conservatorship',
    source_label: 'Federal Housing Finance Agency (FHFA)',
  },
];

// ---------------------------------------------------------------------------
// Income Brackets (IRS SOI data, approximate 2023)
// ---------------------------------------------------------------------------

const INCOME_BRACKETS = [
  {
    bracket_label: 'Under $25,000',
    min_income: 0,
    max_income: 24999,
    effective_tax_rate: 3.7,
    tax_share_pct: 0.019,
    household_count: 32000000,
    source_year: 2023,
  },
  {
    bracket_label: '$25,000 - $50,000',
    min_income: 25000,
    max_income: 49999,
    effective_tax_rate: 8.2,
    tax_share_pct: 0.053,
    household_count: 28000000,
    source_year: 2023,
  },
  {
    bracket_label: '$50,000 - $75,000',
    min_income: 50000,
    max_income: 74999,
    effective_tax_rate: 11.5,
    tax_share_pct: 0.076,
    household_count: 21000000,
    source_year: 2023,
  },
  {
    bracket_label: '$75,000 - $100,000',
    min_income: 75000,
    max_income: 99999,
    effective_tax_rate: 13.1,
    tax_share_pct: 0.082,
    household_count: 15000000,
    source_year: 2023,
  },
  {
    bracket_label: '$100,000 - $200,000',
    min_income: 100000,
    max_income: 199999,
    effective_tax_rate: 16.4,
    tax_share_pct: 0.214,
    household_count: 22000000,
    source_year: 2023,
  },
  {
    bracket_label: '$200,000 - $500,000',
    min_income: 200000,
    max_income: 499999,
    effective_tax_rate: 22.8,
    tax_share_pct: 0.198,
    household_count: 8000000,
    source_year: 2023,
  },
  {
    bracket_label: '$500,000 - $1,000,000',
    min_income: 500000,
    max_income: 999999,
    effective_tax_rate: 28.3,
    tax_share_pct: 0.119,
    household_count: 2000000,
    source_year: 2023,
  },
  {
    bracket_label: 'Over $1,000,000',
    min_income: 1000000,
    max_income: null,
    effective_tax_rate: 31.5,
    tax_share_pct: 0.239,
    household_count: 800000,
    source_year: 2023,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n=== Seed Cost Calculator ===`);
  console.log(`Cost items to seed: ${COST_ITEMS.length}`);
  console.log(`Income brackets to seed: ${INCOME_BRACKETS.length}`);
  console.log(`Dry run: ${dryRun}\n`);

  let itemsInserted = 0;
  let itemsUpdated = 0;

  // -- Cost calculator items --
  console.log('--- Cost Calculator Items ---');
  for (const item of COST_ITEMS) {
    if (dryRun) {
      console.log(`[DRY RUN] Would upsert: ${item.title} (${item.cost_display})`);
      continue;
    }

    const { rows } = await pool.query(
      `INSERT INTO cost_calculator_items
         (slug, title, description, total_cost, cost_display, cost_type,
          fiscal_year, duration_years, source_url, source_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         total_cost = EXCLUDED.total_cost,
         cost_display = EXCLUDED.cost_display,
         cost_type = EXCLUDED.cost_type,
         fiscal_year = EXCLUDED.fiscal_year,
         duration_years = EXCLUDED.duration_years,
         source_url = EXCLUDED.source_url,
         source_label = EXCLUDED.source_label,
         updated_at = NOW()
       RETURNING (xmax = 0) AS is_insert`,
      [
        item.slug, item.title, item.description, item.total_cost,
        item.cost_display, item.cost_type, item.fiscal_year,
        item.duration_years, item.source_url, item.source_label,
      ]
    );

    if (rows[0].is_insert) {
      itemsInserted++;
      console.log(`  INSERTED: ${item.title}`);
    } else {
      itemsUpdated++;
      console.log(`  UPDATED:  ${item.title}`);
    }
  }

  // -- Income brackets --
  let bracketsInserted = 0;
  let bracketsUpdated = 0;

  console.log('\n--- Income Brackets ---');
  for (const b of INCOME_BRACKETS) {
    if (dryRun) {
      console.log(`[DRY RUN] Would upsert: ${b.bracket_label}`);
      continue;
    }

    const { rows } = await pool.query(
      `INSERT INTO income_brackets
         (bracket_label, min_income, max_income, effective_tax_rate,
          tax_share_pct, household_count, source_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (min_income) DO UPDATE SET
         bracket_label = EXCLUDED.bracket_label,
         max_income = EXCLUDED.max_income,
         effective_tax_rate = EXCLUDED.effective_tax_rate,
         tax_share_pct = EXCLUDED.tax_share_pct,
         household_count = EXCLUDED.household_count,
         source_year = EXCLUDED.source_year
       RETURNING (xmax = 0) AS is_insert`,
      [
        b.bracket_label, b.min_income, b.max_income,
        b.effective_tax_rate, b.tax_share_pct, b.household_count,
        b.source_year,
      ]
    );

    if (rows[0].is_insert) {
      bracketsInserted++;
      console.log(`  INSERTED: ${b.bracket_label}`);
    } else {
      bracketsUpdated++;
      console.log(`  UPDATED:  ${b.bracket_label}`);
    }
  }

  if (!dryRun) {
    console.log(`\n=== Seed Complete ===`);
    console.log(`Cost items   — Inserted: ${itemsInserted}  Updated: ${itemsUpdated}  Total: ${COST_ITEMS.length}`);
    console.log(`Brackets     — Inserted: ${bracketsInserted}  Updated: ${bracketsUpdated}  Total: ${INCOME_BRACKETS.length}`);
  } else {
    console.log(`\n[DRY RUN] Would process ${COST_ITEMS.length} cost items and ${INCOME_BRACKETS.length} brackets`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
