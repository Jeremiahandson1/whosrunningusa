#!/usr/bin/env node

/**
 * Seed Transparency Requirements & Compliance Records
 *
 * Populates transparency_requirements with known federal and state
 * requirements for body cameras, FOIA response times, financial
 * disclosures, meeting recordings, and lobbying disclosures.
 * Then creates baseline compliance_records for tracked politicians.
 *
 * Usage:
 *   node scripts/seed-transparency-requirements.js
 *   node scripts/seed-transparency-requirements.js --dry-run
 *
 * Required env vars:
 *   DATABASE_URL
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const dryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Federal Transparency Requirements
// ---------------------------------------------------------------------------

const FEDERAL_REQUIREMENTS = [
  {
    jurisdiction: 'United States Federal Government',
    jurisdiction_type: 'federal',
    state: null,
    requirement_type: 'financial_disclosure',
    title: 'STOCK Act Financial Disclosure',
    description: 'Members of Congress must report stock transactions exceeding $1,000 within 45 days under the Stop Trading on Congressional Knowledge Act of 2012.',
    enacted_date: '2012-04-04',
    effective_date: '2012-04-04',
    statute_reference: 'Pub.L. 112-105',
  },
  {
    jurisdiction: 'United States Federal Government',
    jurisdiction_type: 'federal',
    state: null,
    requirement_type: 'financial_disclosure',
    title: 'Ethics in Government Act Annual Disclosure',
    description: 'Senior federal officials must file annual financial disclosure reports listing assets, income, liabilities, and outside positions.',
    enacted_date: '1978-10-26',
    effective_date: '1979-01-01',
    statute_reference: '5 U.S.C. App. 101-111',
  },
  {
    jurisdiction: 'United States Federal Government',
    jurisdiction_type: 'federal',
    state: null,
    requirement_type: 'lobbying_disclosure',
    title: 'Lobbying Disclosure Act Registration',
    description: 'Lobbyists must register within 45 days of making contact and file quarterly activity reports. Former officials face a 2-year cooling period.',
    enacted_date: '1995-12-19',
    effective_date: '1996-01-01',
    statute_reference: '2 U.S.C. 1601-1614',
  },
  {
    jurisdiction: 'United States Federal Government',
    jurisdiction_type: 'federal',
    state: null,
    requirement_type: 'foia_response',
    title: 'Freedom of Information Act Response Requirement',
    description: 'Federal agencies must respond to FOIA requests within 20 business days. Complex requests may be extended by 10 additional days.',
    enacted_date: '1966-07-04',
    effective_date: '1967-07-04',
    statute_reference: '5 U.S.C. 552',
  },
  {
    jurisdiction: 'United States Federal Government',
    jurisdiction_type: 'federal',
    state: null,
    requirement_type: 'campaign_finance',
    title: 'FEC Campaign Finance Reporting',
    description: 'Federal candidates must file quarterly campaign finance reports with the FEC disclosing all contributions over $200 and all expenditures.',
    enacted_date: '1971-02-07',
    effective_date: '1972-04-07',
    statute_reference: '52 U.S.C. 30101-30146',
  },
  {
    jurisdiction: 'United States Federal Government',
    jurisdiction_type: 'federal',
    state: null,
    requirement_type: 'meeting_recording',
    title: 'Government in the Sunshine Act',
    description: 'Multi-member federal agencies must conduct business in meetings open to public observation, with limited exceptions.',
    enacted_date: '1976-09-13',
    effective_date: '1977-03-12',
    statute_reference: '5 U.S.C. 552b',
  },
];

// ---------------------------------------------------------------------------
// State-level body camera requirements (selected major states)
// ---------------------------------------------------------------------------

const STATE_BODY_CAMERA_REQUIREMENTS = [
  { state: 'CA', title: 'California Body Camera Mandate', description: 'AB 748 requires law enforcement agencies to release body camera footage within 45 days of critical incidents.', enacted_date: '2018-09-30', statute_reference: 'CA Penal Code 832.7' },
  { state: 'IL', title: 'Illinois Law Enforcement Body Camera Act', description: 'All law enforcement officers must wear body cameras during encounters. Footage retained minimum 90 days.', enacted_date: '2015-08-19', statute_reference: '50 ILCS 706' },
  { state: 'NJ', title: 'New Jersey Body Camera Policy', description: 'Attorney General directive requires body cameras for all uniformed patrol officers in New Jersey.', enacted_date: '2021-01-01', statute_reference: 'AG Directive 2021-4' },
  { state: 'CO', title: 'Colorado SB20-217 Body Camera Mandate', description: 'All law enforcement must wear body cameras by 2023. Failure to activate creates presumption against officer.', enacted_date: '2020-06-19', statute_reference: 'CRS 24-31-902' },
  { state: 'NM', title: 'New Mexico Body Camera Act', description: 'All law enforcement agencies must implement body camera programs. Video is public record.', enacted_date: '2020-03-01', statute_reference: 'NMSA 29-1-18' },
  { state: 'CT', title: 'Connecticut Body Camera Mandate', description: 'All police departments must implement body camera programs by July 2022.', enacted_date: '2020-07-31', statute_reference: 'PA 20-1 Sec. 20' },
  { state: 'MD', title: 'Maryland Body Camera Requirements', description: 'State law enforcement must use body cameras. Footage subject to public records requests.', enacted_date: '2021-04-10', statute_reference: 'MD Public Safety 3-511' },
  { state: 'VA', title: 'Virginia Body Camera Policy', description: 'Law enforcement agencies using body cameras must adopt written policies on usage and footage retention.', enacted_date: '2020-10-01', statute_reference: 'VA Code 9.1-174' },
  { state: 'NY', title: 'New York Body Camera Transparency', description: 'NYPD required to use body cameras. All agencies must establish policies for camera activation and footage retention.', enacted_date: '2017-04-27', statute_reference: 'Executive Order 2017-1' },
  { state: 'TX', title: 'Texas Body Camera Requirements', description: 'Agencies receiving state grants must implement body camera programs. Sandra Bland Act expanded requirements.', enacted_date: '2017-09-01', statute_reference: 'TX Occupations Code 1701.655' },
  { state: 'FL', title: 'Florida Body Camera Statute', description: 'Law enforcement body camera recordings exempt from public records for specified period. Agencies set usage policies.', enacted_date: '2015-10-01', statute_reference: 'FL Stat 119.071(2)(l)' },
  { state: 'WA', title: 'Washington Body Camera & Community Trust', description: 'Police departments must establish body camera programs with community input on usage policies.', enacted_date: '2021-07-25', statute_reference: 'RCW 10.109' },
];

// ---------------------------------------------------------------------------
// State petition requirements
// ---------------------------------------------------------------------------

const PETITION_STATE_REQUIREMENTS = [
  { state: 'CA', petition_type: 'initiative_statute', required_signatures: 546651, deadline_description: 'Must be submitted 131 days before election', additional_rules: '5% of votes cast for Governor in last election' },
  { state: 'CA', petition_type: 'initiative_constitutional', required_signatures: 874641, deadline_description: 'Must be submitted 131 days before election', additional_rules: '8% of votes cast for Governor in last election' },
  { state: 'FL', petition_type: 'initiative_constitutional', required_signatures: 891589, deadline_description: 'February 1 of election year', additional_rules: '8% of votes in last presidential election, from at least 14 of 28 congressional districts' },
  { state: 'OH', petition_type: 'initiative_statute', required_signatures: 132887, deadline_description: '90 days before election', additional_rules: '3% of total votes in last gubernatorial election' },
  { state: 'CO', petition_type: 'initiative_statute', required_signatures: 124632, deadline_description: '3 months before election', additional_rules: '5% of votes for Secretary of State in last election' },
  { state: 'OR', petition_type: 'initiative_statute', required_signatures: 112020, deadline_description: '4 months before election', additional_rules: '6% of votes for Governor in last election' },
  { state: 'AZ', petition_type: 'initiative_statute', required_signatures: 237645, deadline_description: '4 months before election', additional_rules: '10% of votes for Governor in last election' },
  { state: 'WA', petition_type: 'initiative_statute', required_signatures: 324516, deadline_description: '10 months before election', additional_rules: '8% of votes for Governor in last election' },
  { state: 'MI', petition_type: 'initiative_statute', required_signatures: 340047, deadline_description: '160 days before election', additional_rules: '8% of votes for Governor in last election' },
  { state: 'MO', petition_type: 'initiative_statute', required_signatures: 107370, deadline_description: '18 weeks before election', additional_rules: '5% of legal voters in 6 of 8 congressional districts' },
  { state: 'NV', petition_type: 'initiative_statute', required_signatures: 97598, deadline_description: '4th Tuesday in November preceding session', additional_rules: '10% of voters in last election' },
  { state: 'MT', petition_type: 'initiative_statute', required_signatures: 29358, deadline_description: '1 year before election', additional_rules: '5% of qualified electors including from 1/3 of legislative districts' },
  { state: 'SD', petition_type: 'initiative_statute', required_signatures: 17508, deadline_description: '1 year before election', additional_rules: '5% of votes for Governor in last election' },
  { state: 'ND', petition_type: 'initiative_statute', required_signatures: 15582, deadline_description: '1 year before election', additional_rules: '2% of resident population' },
  { state: 'NE', petition_type: 'initiative_statute', required_signatures: 87000, deadline_description: '4 months before election', additional_rules: '7% of registered voters including 5% in 2/5 of counties' },
  { state: 'MA', petition_type: 'initiative_statute', required_signatures: 74574, deadline_description: 'First Wednesday of December before session', additional_rules: '3% of votes for Governor' },
  { state: 'IL', petition_type: 'initiative_constitutional', required_signatures: 363813, deadline_description: '6 months before election', additional_rules: '8% of votes for Governor in last election' },
  { state: 'OK', petition_type: 'initiative_statute', required_signatures: 94911, deadline_description: '90 days before election', additional_rules: '8% of votes for office receiving most votes in last election' },
  { state: 'AR', petition_type: 'initiative_statute', required_signatures: 78133, deadline_description: '4 months before election', additional_rules: '8% of votes for Governor in last election' },
  { state: 'ME', petition_type: 'initiative_statute', required_signatures: 67682, deadline_description: 'Before first Wednesday of January of legislative session', additional_rules: '10% of votes for Governor in last election' },
];

// ---------------------------------------------------------------------------
// Seeding logic
// ---------------------------------------------------------------------------

async function seedRequirements() {
  let inserted = 0;

  // Federal requirements
  for (const req of FEDERAL_REQUIREMENTS) {
    if (dryRun) {
      console.log(`  [dry-run] ${req.title}`);
      inserted++;
      continue;
    }

    await pool.query(
      `INSERT INTO transparency_requirements
         (jurisdiction, jurisdiction_type, state, requirement_type, title,
          description, enacted_date, effective_date, statute_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT DO NOTHING`,
      [req.jurisdiction, req.jurisdiction_type, req.state, req.requirement_type,
       req.title, req.description, req.enacted_date, req.effective_date || null, req.statute_reference]
    );
    inserted++;
  }

  // State body camera requirements
  for (const req of STATE_BODY_CAMERA_REQUIREMENTS) {
    if (dryRun) {
      console.log(`  [dry-run] ${req.state}: ${req.title}`);
      inserted++;
      continue;
    }

    await pool.query(
      `INSERT INTO transparency_requirements
         (jurisdiction, jurisdiction_type, state, requirement_type, title,
          description, enacted_date, statute_reference)
       VALUES ($1, 'state', $2, 'body_camera', $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [`State of ${req.state}`, req.state, req.title, req.description,
       req.enacted_date, req.statute_reference]
    );
    inserted++;
  }

  console.log(`  Inserted ${inserted} transparency requirements`);
  return inserted;
}

async function seedPetitionRequirements() {
  let inserted = 0;

  for (const req of PETITION_STATE_REQUIREMENTS) {
    if (dryRun) {
      console.log(`  [dry-run] ${req.state}: ${req.petition_type} — ${req.required_signatures} signatures`);
      inserted++;
      continue;
    }

    await pool.query(
      `INSERT INTO petition_state_requirements
         (state, petition_type, required_signatures, deadline_description, additional_rules)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (state, petition_type) DO UPDATE SET
         required_signatures = EXCLUDED.required_signatures,
         deadline_description = EXCLUDED.deadline_description,
         additional_rules = EXCLUDED.additional_rules,
         updated_at = NOW()`,
      [req.state, req.petition_type, req.required_signatures,
       req.deadline_description, req.additional_rules]
    );
    inserted++;
  }

  console.log(`  Inserted ${inserted} petition state requirements`);
  return inserted;
}

async function seedBaselineComplianceRecords() {
  // Previously this looped politicians × requirements in JS doing one INSERT
  // per pair. With ~6k federal-office filers and ~6 federal requirements
  // that's ~37k sequential round-trips, which exceeded the 30-min step
  // timeout. One CROSS JOIN inserts everything in a single query.
  if (dryRun) {
    const { rows: [stats] } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM candidate_profiles WHERE fec_office_type IN ('H','S')) AS pols,
         (SELECT COUNT(*) FROM transparency_requirements WHERE jurisdiction_type = 'federal') AS reqs`
    );
    console.log(`  [dry-run] Would create up to ${Number(stats.pols) * Number(stats.reqs)} baseline records`);
    return;
  }

  const result = await pool.query(
    `INSERT INTO compliance_records
       (politician_id, requirement_id, compliance_status, compliance_score, last_checked)
     SELECT cp.id, tr.id, 'unknown', NULL, NULL
     FROM candidate_profiles cp
     CROSS JOIN transparency_requirements tr
     WHERE cp.fec_office_type IN ('H', 'S')
       AND tr.jurisdiction_type = 'federal'
     ON CONFLICT DO NOTHING`
  );
  console.log(`  Created ${result.rowCount} baseline compliance records`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Transparency & Petition Requirements Seeder ===');
  console.log(`Dry run: ${dryRun}\n`);

  console.log('Step 1: Seeding transparency requirements...');
  await seedRequirements();

  console.log('\nStep 2: Seeding petition state requirements...');
  await seedPetitionRequirements();

  console.log('\nStep 3: Creating baseline compliance records...');
  await seedBaselineComplianceRecords();

  console.log('\nDone.');
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
