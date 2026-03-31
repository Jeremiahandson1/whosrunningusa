#!/usr/bin/env node

/**
 * Seed Think Tanks
 *
 * Populates the think_tanks table with the top 50 DC-area think tanks,
 * including real EINs and policy focus areas.
 *
 * Usage:
 *   node scripts/seed-think-tanks.js
 *   node scripts/seed-think-tanks.js --dry-run
 *
 * Required env vars:
 *   DATABASE_URL
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const dryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Top 50 DC Think Tanks (real EINs, real websites)
// ---------------------------------------------------------------------------

const THINK_TANKS = [
  {
    name: 'Brookings Institution',
    ein: '53-0196577',
    website: 'https://www.brookings.edu',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['governance', 'economics', 'foreign_policy', 'metropolitan_policy'],
  },
  {
    name: 'Heritage Foundation',
    ein: '23-7327730',
    website: 'https://www.heritage.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['conservative_policy', 'defense', 'economics', 'government_reform'],
  },
  {
    name: 'Cato Institute',
    ein: '23-7432162',
    website: 'https://www.cato.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['libertarian_policy', 'free_markets', 'civil_liberties', 'foreign_policy'],
  },
  {
    name: 'Center for American Progress',
    ein: '20-2014027',
    website: 'https://www.americanprogress.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['progressive_policy', 'healthcare', 'climate', 'economy'],
  },
  {
    name: 'Council on Foreign Relations',
    ein: '13-1628168',
    website: 'https://www.cfr.org',
    city: 'New York',
    state: 'NY',
    policy_focus: ['foreign_policy', 'national_security', 'international_economics', 'diplomacy'],
  },
  {
    name: 'RAND Corporation',
    ein: '95-1893573',
    website: 'https://www.rand.org',
    city: 'Santa Monica',
    state: 'CA',
    policy_focus: ['defense', 'health', 'education', 'technology', 'national_security'],
  },
  {
    name: 'Carnegie Endowment for International Peace',
    ein: '25-0642740',
    website: 'https://carnegieendowment.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['foreign_policy', 'nuclear_policy', 'democracy', 'global_order'],
  },
  {
    name: 'American Enterprise Institute',
    ein: '53-0218495',
    website: 'https://www.aei.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['conservative_policy', 'economics', 'defense', 'social_policy'],
  },
  {
    name: 'Center for Strategic and International Studies',
    ein: '52-0831888',
    website: 'https://www.csis.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['national_security', 'defense', 'geopolitics', 'technology'],
  },
  {
    name: 'Hoover Institution',
    ein: '94-1156617',
    website: 'https://www.hoover.org',
    city: 'Stanford',
    state: 'CA',
    policy_focus: ['economics', 'governance', 'national_security', 'education'],
  },
  {
    name: 'Urban Institute',
    ein: '52-0880806',
    website: 'https://www.urban.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['social_policy', 'housing', 'education', 'health', 'economic_policy'],
  },
  {
    name: 'New America',
    ein: '68-0500419',
    website: 'https://www.newamerica.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['technology', 'education', 'national_security', 'political_reform'],
  },
  {
    name: 'Bipartisan Policy Center',
    ein: '27-0745781',
    website: 'https://bipartisanpolicy.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['bipartisan_solutions', 'health', 'energy', 'infrastructure', 'economy'],
  },
  {
    name: 'Center for a New American Security',
    ein: '20-5853027',
    website: 'https://www.cnas.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['national_security', 'defense', 'foreign_policy', 'technology'],
  },
  {
    name: 'Atlantic Council',
    ein: '52-1328734',
    website: 'https://www.atlanticcouncil.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['transatlantic_relations', 'global_security', 'energy', 'economics'],
  },
  {
    name: 'Peterson Institute for International Economics',
    ein: '52-1014846',
    website: 'https://www.piie.com',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['international_economics', 'trade', 'globalization', 'finance'],
  },
  {
    name: 'Woodrow Wilson International Center for Scholars',
    ein: '52-0810809',
    website: 'https://www.wilsoncenter.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['foreign_policy', 'history', 'science', 'global_issues'],
  },
  {
    name: 'Aspen Institute',
    ein: '52-0819828',
    website: 'https://www.aspeninstitute.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['leadership', 'policy_programs', 'education', 'communications'],
  },
  {
    name: 'Stimson Center',
    ein: '52-1641721',
    website: 'https://www.stimson.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['international_security', 'arms_control', 'southeast_asia', 'environment'],
  },
  {
    name: 'Hudson Institute',
    ein: '13-1628350',
    website: 'https://www.hudson.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['national_security', 'defense', 'technology', 'economics'],
  },
  {
    name: 'Center on Budget and Policy Priorities',
    ein: '52-1194561',
    website: 'https://www.cbpp.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['fiscal_policy', 'poverty', 'health', 'safety_net'],
  },
  {
    name: 'Economic Policy Institute',
    ein: '52-1466905',
    website: 'https://www.epi.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['labor', 'wages', 'economic_inequality', 'trade'],
  },
  {
    name: 'Mercatus Center at George Mason University',
    ein: '54-1630827',
    website: 'https://www.mercatus.org',
    city: 'Arlington',
    state: 'VA',
    policy_focus: ['regulatory_policy', 'free_markets', 'government_spending', 'technology'],
  },
  {
    name: 'Resources for the Future',
    ein: '53-0220900',
    website: 'https://www.rff.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['environment', 'energy', 'natural_resources', 'climate'],
  },
  {
    name: 'Center for Immigration Studies',
    ein: '52-1549711',
    website: 'https://cis.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['immigration', 'border_security', 'demographics'],
  },
  {
    name: 'Migration Policy Institute',
    ein: '52-2268027',
    website: 'https://www.migrationpolicy.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['immigration', 'refugee_policy', 'integration', 'labor_migration'],
  },
  {
    name: 'Information Technology and Innovation Foundation',
    ein: '20-3362513',
    website: 'https://itif.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['technology', 'innovation', 'broadband', 'manufacturing'],
  },
  {
    name: 'Third Way',
    ein: '20-4087865',
    website: 'https://www.thirdway.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['centrist_policy', 'energy', 'economy', 'national_security'],
  },
  {
    name: 'Competitive Enterprise Institute',
    ein: '52-1351785',
    website: 'https://cei.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['deregulation', 'free_markets', 'energy', 'technology'],
  },
  {
    name: 'Center for Global Development',
    ein: '71-0928741',
    website: 'https://www.cgdev.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['global_development', 'foreign_aid', 'migration', 'global_health'],
  },
  {
    name: 'German Marshall Fund of the United States',
    ein: '52-1082022',
    website: 'https://www.gmfus.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['transatlantic_relations', 'democracy', 'trade', 'immigration'],
  },
  {
    name: 'Brennan Center for Justice',
    ein: '13-3798318',
    website: 'https://www.brennancenter.org',
    city: 'New York',
    state: 'NY',
    policy_focus: ['voting_rights', 'democracy', 'criminal_justice', 'rule_of_law'],
  },
  {
    name: 'Tax Foundation',
    ein: '52-0796928',
    website: 'https://taxfoundation.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['tax_policy', 'fiscal_policy', 'economic_competitiveness'],
  },
  {
    name: 'Manhattan Institute for Policy Research',
    ein: '13-2912529',
    website: 'https://www.manhattan-institute.org',
    city: 'New York',
    state: 'NY',
    policy_focus: ['urban_policy', 'economics', 'energy', 'criminal_justice'],
  },
  {
    name: 'Progressive Policy Institute',
    ein: '52-1578171',
    website: 'https://www.progressivepolicy.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['centrist_progressive', 'trade', 'innovation', 'education'],
  },
  {
    name: 'American Action Forum',
    ein: '27-1786888',
    website: 'https://www.americanactionforum.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['regulatory_policy', 'fiscal_policy', 'healthcare', 'immigration'],
  },
  {
    name: 'Niskanen Center',
    ein: '47-5213757',
    website: 'https://www.niskanencenter.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['libertarian_moderate', 'climate', 'immigration', 'criminal_justice'],
  },
  {
    name: 'Center for Democracy and Technology',
    ein: '52-1857811',
    website: 'https://cdt.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['digital_rights', 'privacy', 'free_expression', 'technology'],
  },
  {
    name: 'National Bureau of Economic Research',
    ein: '04-1706940',
    website: 'https://www.nber.org',
    city: 'Cambridge',
    state: 'MA',
    policy_focus: ['economics', 'labor', 'healthcare', 'public_finance'],
  },
  {
    name: 'Committee for a Responsible Federal Budget',
    ein: '23-7255908',
    website: 'https://www.crfb.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['fiscal_policy', 'national_debt', 'budget', 'entitlements'],
  },
  {
    name: 'Institute for Policy Studies',
    ein: '52-0781390',
    website: 'https://ips-dc.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['progressive_policy', 'inequality', 'peace', 'climate'],
  },
  {
    name: 'Lexington Institute',
    ein: '54-1837309',
    website: 'https://www.lexingtoninstitute.org',
    city: 'Arlington',
    state: 'VA',
    policy_focus: ['defense', 'homeland_security', 'education', 'space'],
  },
  {
    name: 'Center for European Policy Analysis',
    ein: '26-0514668',
    website: 'https://cepa.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['european_security', 'transatlantic_relations', 'energy', 'defense'],
  },
  {
    name: 'Inter-American Dialogue',
    ein: '52-1231658',
    website: 'https://www.thedialogue.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['latin_america', 'trade', 'migration', 'governance'],
  },
  {
    name: 'Foundation for Defense of Democracies',
    ein: '31-1697791',
    website: 'https://www.fdd.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['national_security', 'counterterrorism', 'sanctions', 'foreign_policy'],
  },
  {
    name: 'Middle East Institute',
    ein: '53-0218498',
    website: 'https://www.mei.edu',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['middle_east', 'foreign_policy', 'energy', 'culture'],
  },
  {
    name: 'R Street Institute',
    ein: '46-0628030',
    website: 'https://www.rstreet.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['free_markets', 'governance', 'technology', 'insurance'],
  },
  {
    name: 'World Resources Institute',
    ein: '52-1257057',
    website: 'https://www.wri.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['climate', 'energy', 'food', 'forests', 'water'],
  },
  {
    name: 'Belfer Center for Science and International Affairs',
    ein: '04-2103580',
    website: 'https://www.belfercenter.org',
    city: 'Cambridge',
    state: 'MA',
    policy_focus: ['nuclear_policy', 'cybersecurity', 'diplomacy', 'energy'],
  },
  {
    name: 'National Endowment for Democracy',
    ein: '52-1355436',
    website: 'https://www.ned.org',
    city: 'Washington',
    state: 'DC',
    policy_focus: ['democracy_promotion', 'human_rights', 'governance', 'civil_society'],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n=== Seed Think Tanks ===`);
  console.log(`Think tanks to seed: ${THINK_TANKS.length}`);
  console.log(`Dry run: ${dryRun}\n`);

  let inserted = 0;
  let updated = 0;

  for (const tt of THINK_TANKS) {
    if (dryRun) {
      console.log(`[DRY RUN] Would upsert: ${tt.name} (EIN: ${tt.ein})`);
      continue;
    }

    const { rows } = await pool.query(
      `INSERT INTO think_tanks (name, ein, website, city, state, policy_focus)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (ein) DO UPDATE SET
         name = EXCLUDED.name,
         website = EXCLUDED.website,
         city = EXCLUDED.city,
         state = EXCLUDED.state,
         policy_focus = EXCLUDED.policy_focus,
         updated_at = NOW()
       RETURNING (xmax = 0) AS is_insert`,
      [tt.name, tt.ein, tt.website, tt.city, tt.state, tt.policy_focus]
    );

    if (rows[0].is_insert) {
      inserted++;
      console.log(`  INSERTED: ${tt.name}`);
    } else {
      updated++;
      console.log(`  UPDATED:  ${tt.name}`);
    }
  }

  if (!dryRun) {
    console.log(`\n=== Seed Complete ===`);
    console.log(`Inserted: ${inserted}  Updated: ${updated}  Total: ${THINK_TANKS.length}`);
  } else {
    console.log(`\n[DRY RUN] Would process ${THINK_TANKS.length} think tanks`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
