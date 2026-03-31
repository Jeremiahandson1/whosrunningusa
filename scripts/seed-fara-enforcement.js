#!/usr/bin/env node

/**
 * Seed FARA Enforcement Cases
 *
 * Populates fara_enforcement_cases with documented enforcement actions
 * and comparable unenforced activity, powering the "enforcement gap" view
 * on the FARA tracker page.
 *
 * Usage:
 *   node scripts/seed-fara-enforcement.js
 *   node scripts/seed-fara-enforcement.js --dry-run
 *
 * Required env vars:
 *   DATABASE_URL
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const dryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Enforcement cases — documented, sourced
// ---------------------------------------------------------------------------

const ENFORCEMENT_CASES = [
  // ========== ENFORCED (enforcement_action = true) ==========
  {
    country: 'Ukraine',
    case_description: 'Paul Manafort convicted of failing to register as a foreign agent while lobbying for the Ukrainian government and the pro-Russian Party of Regions. Conducted extensive lobbying of U.S. officials and media on behalf of Ukrainian interests from 2006-2014 without FARA registration.',
    activity_description: 'Lobbying U.S. officials, placing op-eds, organizing visits for Ukrainian officials, managing PR campaigns for the Party of Regions and President Viktor Yanukovych.',
    enforcement_action: true,
    action_type: 'criminal_conviction',
    action_date: '2018-08-21',
    penalty_amount: null,
    doj_reference: 'United States v. Manafort, 1:17-cr-00201 (D.D.C.)',
    comparable_no_action_description: 'Multiple firms representing Saudi Arabia, UAE, and other foreign governments have filed late FARA registrations or retroactive amendments without criminal referral for equivalent lobbying activity.',
    source_url: 'https://www.justice.gov/archives/sco/press-release/file/1094256/download',
    source_label: 'DOJ Special Counsel Press Release — Manafort Conviction',
    source_date: '2018-08-21',
  },
  {
    country: 'Russia',
    case_description: 'Maria Butina pleaded guilty to conspiracy to act as an agent of the Russian Federation. Infiltrated political organizations including the NRA and attended National Prayer Breakfast to establish back-channel communications between Russian officials and U.S. political figures.',
    activity_description: 'Establishing unofficial lines of communication with U.S. politicians and political organizations on behalf of Russian official Alexander Torshin, without registering under FARA.',
    enforcement_action: true,
    action_type: 'guilty_plea',
    action_date: '2018-12-13',
    penalty_amount: null,
    doj_reference: 'United States v. Butina, 1:18-cr-00218 (D.D.C.)',
    comparable_no_action_description: 'China-linked organizations have funded U.S. think tanks and facilitated meetings between Chinese officials and U.S. policymakers without FARA registration or enforcement action.',
    source_url: 'https://www.justice.gov/opa/pr/russian-national-pleads-guilty-conspiracy-charge-acting-agent-russian-federation',
    source_label: 'DOJ Press Release — Butina Guilty Plea',
    source_date: '2018-12-13',
  },
  {
    country: 'Turkey',
    case_description: 'Bijan Rafiekian (business partner of Michael Flynn) convicted of acting as an unregistered agent of Turkey. Flynn Intel Group conducted a covert influence campaign to discredit Fethullah Gulen on behalf of Turkish government interests during the 2016 presidential campaign.',
    activity_description: 'Op-ed placement, research and lobbying targeting Fethullah Gulen on behalf of Turkish government interests, without FARA disclosure.',
    enforcement_action: true,
    action_type: 'criminal_conviction',
    action_date: '2019-07-23',
    penalty_amount: null,
    doj_reference: 'United States v. Rafiekian, 1:18-cr-00457 (E.D. Va.)',
    comparable_no_action_description: 'Turkey spent over $4.3 million on registered U.S. lobbying in 2019 alone through multiple firms, several of which filed late initial registrations without enforcement consequences.',
    source_url: 'https://www.justice.gov/opa/pr/former-business-partner-michael-t-flynn-convicted-secretly-acting-agent-turkey',
    source_label: 'DOJ Press Release — Rafiekian Conviction',
    source_date: '2019-07-23',
  },
  {
    country: 'Zimbabwe',
    case_description: 'Craig Engle, a Washington attorney, settled charges for failing to register under FARA while lobbying to ease U.S. sanctions on Zimbabwe. Engle worked to influence U.S. officials regarding the Zimbabwe Democracy and Economic Recovery Act sanctions regime.',
    activity_description: 'Lobbying U.S. government officials to lift sanctions on Zimbabwe without registering as a foreign agent.',
    enforcement_action: true,
    action_type: 'civil_settlement',
    action_date: '2019-04-16',
    penalty_amount: null,
    doj_reference: 'FARA NSD enforcement action',
    comparable_no_action_description: 'Multiple lobbying firms have represented sanctioned or semi-sanctioned nations with delayed FARA filings and no enforcement referral.',
    source_url: 'https://www.justice.gov/nsd/fara',
    source_label: 'DOJ National Security Division — FARA Enforcement',
    source_date: '2019-04-16',
  },
  {
    country: 'Ukraine',
    case_description: 'W. Samuel Patten pleaded guilty to acting as an unregistered foreign agent for the pro-Russian Opposition Bloc in Ukraine. Patten funneled foreign money to the Trump inaugural committee and lobbied U.S. officials on behalf of Ukrainian political interests.',
    activity_description: 'Lobbying U.S. officials on behalf of Ukrainian Opposition Bloc, channeling foreign funds to inaugural committee, political consulting without FARA registration.',
    enforcement_action: true,
    action_type: 'guilty_plea',
    action_date: '2018-08-31',
    penalty_amount: null,
    doj_reference: 'United States v. Patten, 1:18-cr-00260 (D.D.C.)',
    comparable_no_action_description: 'Gulf state-linked donors have contributed to inaugural committees and political organizations through U.S.-based intermediaries with minimal FARA scrutiny.',
    source_url: 'https://www.justice.gov/opa/pr/political-consultant-pleads-guilty-acting-unregistered-foreign-agent',
    source_label: 'DOJ Press Release — Patten Guilty Plea',
    source_date: '2018-08-31',
  },

  // ========== UNENFORCED (enforcement_action = false) ==========
  {
    country: 'Saudi Arabia',
    case_description: 'Saudi Arabia has spent over $100 million on U.S. lobbying through dozens of registered firms since 2016, with documented late filings, retroactive registrations, and incomplete disclosure of congressional contacts. Despite systematic compliance failures, no criminal referral or enforcement action has been taken.',
    activity_description: 'Extensive lobbying of Congress on arms sales, Yemen war authorization, JASTA legislation, and Khashoggi fallout through firms including Hogan Lovells, Squire Patton Boggs, Qorvis, and others. Multiple firms filed late initial registrations or retroactive supplemental statements.',
    enforcement_action: false,
    action_type: null,
    action_date: null,
    penalty_amount: null,
    doj_reference: null,
    comparable_no_action_description: null,
    source_url: 'https://www.opensecrets.org/fara/countries/Saudi+Arabia',
    source_label: 'OpenSecrets — Saudi Arabia FARA Filings',
    source_date: '2024-01-15',
  },
  {
    country: 'United Arab Emirates',
    case_description: 'UAE lobbying firms have retroactively registered or amended FARA filings to disclose previously unreported contacts with members of Congress and executive branch officials. Despite patterns of late disclosure equivalent to activity prosecuted in other cases, no enforcement action has resulted.',
    activity_description: 'Lobbying on defense sales, regional diplomacy, Abraham Accords promotion, and sanctions policy through firms that filed delayed or retroactive FARA registrations without consequences.',
    enforcement_action: false,
    action_type: null,
    action_date: null,
    penalty_amount: null,
    doj_reference: null,
    comparable_no_action_description: null,
    source_url: 'https://www.opensecrets.org/fara/countries/United+Arab+Emirates',
    source_label: 'OpenSecrets — UAE FARA Filings',
    source_date: '2024-01-15',
  },
  {
    country: 'Israel',
    case_description: 'Multiple organizations operating in the U.S. on behalf of Israeli government interests have not registered under FARA despite meeting the statutory criteria for foreign agent status. The American Israel Public Affairs Committee (AIPAC) and similar groups have consistently avoided FARA registration, a status the DOJ has not challenged since the 1960s.',
    activity_description: 'Direct lobbying of Congress on aid packages, military cooperation, and Middle East policy. Organization of congressional trips to Israel. Coordination with Israeli government officials on policy messaging.',
    enforcement_action: false,
    action_type: null,
    action_date: null,
    penalty_amount: null,
    doj_reference: null,
    comparable_no_action_description: null,
    source_url: 'https://www.aljazeera.com/news/2023/3/5/us-pro-israel-groups-fara',
    source_label: 'Al Jazeera — U.S. Pro-Israel Groups and FARA',
    source_date: '2023-03-05',
  },
  {
    country: 'China',
    case_description: 'Chinese government-linked entities have funded U.S. think tanks, academic institutions, and policy organizations without foreign principal disclosure under FARA. Confucius Institutes at U.S. universities operated for years with funding from the Chinese Ministry of Education (via Hanban) before congressional scrutiny led to closures, but no FARA enforcement action was pursued.',
    activity_description: 'Funding of policy research, academic exchange programs, and media operations in the U.S. by entities linked to the Chinese government, without FARA registration as foreign agents.',
    enforcement_action: false,
    action_type: null,
    action_date: null,
    penalty_amount: null,
    doj_reference: null,
    comparable_no_action_description: null,
    source_url: 'https://www.gao.gov/products/gao-19-278',
    source_label: 'GAO Report — Confucius Institutes and Foreign Funding Disclosure',
    source_date: '2019-02-28',
  },
  {
    country: 'Turkey',
    case_description: 'Following the 2016 coup attempt, Turkey dramatically expanded its U.S. lobbying apparatus, engaging over a dozen firms. Several firms filed initial FARA registrations months after beginning work, and supplemental statements disclosed previously unreported contacts. Despite the Rafiekian conviction for similar Turkish lobbying, registered firms engaged in equivalent activity faced no enforcement action for late filings.',
    activity_description: 'Post-coup lobbying campaign targeting Congress and executive branch on extradition of Fethullah Gulen, arms sales, and sanctions avoidance. Multiple firms filed late registrations covering prior activity.',
    enforcement_action: false,
    action_type: null,
    action_date: null,
    penalty_amount: null,
    doj_reference: null,
    comparable_no_action_description: null,
    source_url: 'https://www.opensecrets.org/fara/countries/Turkey',
    source_label: 'OpenSecrets — Turkey FARA Filings',
    source_date: '2024-01-15',
  },
  {
    country: 'Japan',
    case_description: 'Japan consistently ranks among the top foreign spenders on U.S. lobbying, spending tens of millions annually through registered agents. While Japan maintains a large and active lobbying presence, some firms have disclosed incomplete contact information or filed late supplemental statements without enforcement consequences.',
    activity_description: 'Lobbying on trade agreements, military basing, semiconductor policy, and economic partnerships. Some supplemental statements filed late or with incomplete contact details.',
    enforcement_action: false,
    action_type: null,
    action_date: null,
    penalty_amount: null,
    doj_reference: null,
    comparable_no_action_description: null,
    source_url: 'https://www.opensecrets.org/fara/countries/Japan',
    source_label: 'OpenSecrets — Japan FARA Filings',
    source_date: '2024-01-15',
  },
];

// ---------------------------------------------------------------------------
// Seeding logic
// ---------------------------------------------------------------------------

async function seedEnforcementCases() {
  console.log('=== FARA Enforcement Cases Seeder ===');
  console.log(`Dry run: ${dryRun}`);
  console.log(`Cases to seed: ${ENFORCEMENT_CASES.length}`);
  console.log('');

  let inserted = 0;
  let skipped = 0;

  for (const c of ENFORCEMENT_CASES) {
    if (dryRun) {
      const label = c.enforcement_action ? 'ENFORCED' : 'UNENFORCED';
      console.log(`  [dry-run] [${label}] ${c.country}: ${c.case_description.substring(0, 80)}...`);
      inserted++;
      continue;
    }

    const { rowCount } = await pool.query(
      `INSERT INTO fara_enforcement_cases
         (country, case_description, activity_description,
          enforcement_action, action_type, action_date, penalty_amount,
          doj_reference, comparable_no_action_description,
          source_url, source_label, source_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT DO NOTHING`,
      [
        c.country,
        c.case_description,
        c.activity_description,
        c.enforcement_action,
        c.action_type,
        c.action_date,
        c.penalty_amount,
        c.doj_reference,
        c.comparable_no_action_description,
        c.source_url,
        c.source_label,
        c.source_date,
      ]
    );

    if (rowCount > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (already exist): ${skipped}`);
  console.log(`Enforced cases: ${ENFORCEMENT_CASES.filter(c => c.enforcement_action).length}`);
  console.log(`Unenforced cases: ${ENFORCEMENT_CASES.filter(c => !c.enforcement_action).length}`);
}

seedEnforcementCases()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
