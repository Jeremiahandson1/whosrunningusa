#!/usr/bin/env node

/**
 * Seed Voter Access
 *
 * Populates voter_access_state_scores for all 50 states + DC,
 * voter_access_laws for key battleground and notable states,
 * and voter_access_impacts with demographic data where available.
 *
 * Sources: NCSL, Brennan Center for Justice, state legislatures
 *
 * Usage:
 *   node scripts/seed-voter-access.js
 *   node scripts/seed-voter-access.js --dry-run
 *
 * Required env vars:
 *   DATABASE_URL
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const dryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// State Scores (100 = most accessible)
// Based on: voter ID requirements, early voting, mail voting, registration
//           ease, felon re-enfranchisement, same-day registration, etc.
// ---------------------------------------------------------------------------

const STATE_SCORES = [
  { state: 'AL', state_name: 'Alabama', overall_score: 32, voter_id_score: 20, early_voting_score: 30, mail_voting_score: 25, registration_score: 40, felon_voting_score: 15, restrictive_law_count: 5, expansive_law_count: 1 },
  { state: 'AK', state_name: 'Alaska', overall_score: 62, voter_id_score: 55, early_voting_score: 70, mail_voting_score: 65, registration_score: 60, felon_voting_score: 55, restrictive_law_count: 2, expansive_law_count: 3 },
  { state: 'AZ', state_name: 'Arizona', overall_score: 48, voter_id_score: 35, early_voting_score: 60, mail_voting_score: 55, registration_score: 45, felon_voting_score: 30, restrictive_law_count: 6, expansive_law_count: 3 },
  { state: 'AR', state_name: 'Arkansas', overall_score: 28, voter_id_score: 15, early_voting_score: 40, mail_voting_score: 20, registration_score: 30, felon_voting_score: 25, restrictive_law_count: 6, expansive_law_count: 1 },
  { state: 'CA', state_name: 'California', overall_score: 95, voter_id_score: 95, early_voting_score: 90, mail_voting_score: 95, registration_score: 95, felon_voting_score: 90, restrictive_law_count: 0, expansive_law_count: 12 },
  { state: 'CO', state_name: 'Colorado', overall_score: 98, voter_id_score: 90, early_voting_score: 95, mail_voting_score: 100, registration_score: 95, felon_voting_score: 90, restrictive_law_count: 0, expansive_law_count: 11 },
  { state: 'CT', state_name: 'Connecticut', overall_score: 75, voter_id_score: 85, early_voting_score: 70, mail_voting_score: 70, registration_score: 75, felon_voting_score: 65, restrictive_law_count: 1, expansive_law_count: 6 },
  { state: 'DE', state_name: 'Delaware', overall_score: 68, voter_id_score: 80, early_voting_score: 65, mail_voting_score: 60, registration_score: 70, felon_voting_score: 55, restrictive_law_count: 1, expansive_law_count: 4 },
  { state: 'FL', state_name: 'Florida', overall_score: 40, voter_id_score: 30, early_voting_score: 55, mail_voting_score: 35, registration_score: 40, felon_voting_score: 20, restrictive_law_count: 7, expansive_law_count: 2 },
  { state: 'GA', state_name: 'Georgia', overall_score: 45, voter_id_score: 25, early_voting_score: 50, mail_voting_score: 35, registration_score: 45, felon_voting_score: 40, restrictive_law_count: 7, expansive_law_count: 2 },
  { state: 'HI', state_name: 'Hawaii', overall_score: 92, voter_id_score: 90, early_voting_score: 85, mail_voting_score: 100, registration_score: 90, felon_voting_score: 85, restrictive_law_count: 0, expansive_law_count: 9 },
  { state: 'ID', state_name: 'Idaho', overall_score: 55, voter_id_score: 40, early_voting_score: 55, mail_voting_score: 50, registration_score: 70, felon_voting_score: 50, restrictive_law_count: 3, expansive_law_count: 3 },
  { state: 'IL', state_name: 'Illinois', overall_score: 82, voter_id_score: 85, early_voting_score: 80, mail_voting_score: 75, registration_score: 85, felon_voting_score: 80, restrictive_law_count: 1, expansive_law_count: 8 },
  { state: 'IN', state_name: 'Indiana', overall_score: 35, voter_id_score: 15, early_voting_score: 45, mail_voting_score: 25, registration_score: 35, felon_voting_score: 50, restrictive_law_count: 5, expansive_law_count: 1 },
  { state: 'IA', state_name: 'Iowa', overall_score: 42, voter_id_score: 30, early_voting_score: 55, mail_voting_score: 45, registration_score: 55, felon_voting_score: 25, restrictive_law_count: 5, expansive_law_count: 2 },
  { state: 'KS', state_name: 'Kansas', overall_score: 40, voter_id_score: 20, early_voting_score: 50, mail_voting_score: 45, registration_score: 40, felon_voting_score: 40, restrictive_law_count: 5, expansive_law_count: 2 },
  { state: 'KY', state_name: 'Kentucky', overall_score: 33, voter_id_score: 20, early_voting_score: 35, mail_voting_score: 25, registration_score: 35, felon_voting_score: 20, restrictive_law_count: 6, expansive_law_count: 1 },
  { state: 'LA', state_name: 'Louisiana', overall_score: 34, voter_id_score: 25, early_voting_score: 40, mail_voting_score: 25, registration_score: 35, felon_voting_score: 30, restrictive_law_count: 5, expansive_law_count: 1 },
  { state: 'ME', state_name: 'Maine', overall_score: 88, voter_id_score: 90, early_voting_score: 80, mail_voting_score: 85, registration_score: 95, felon_voting_score: 100, restrictive_law_count: 0, expansive_law_count: 8 },
  { state: 'MD', state_name: 'Maryland', overall_score: 85, voter_id_score: 80, early_voting_score: 85, mail_voting_score: 80, registration_score: 90, felon_voting_score: 75, restrictive_law_count: 0, expansive_law_count: 9 },
  { state: 'MA', state_name: 'Massachusetts', overall_score: 80, voter_id_score: 85, early_voting_score: 75, mail_voting_score: 80, registration_score: 80, felon_voting_score: 75, restrictive_law_count: 1, expansive_law_count: 7 },
  { state: 'MI', state_name: 'Michigan', overall_score: 78, voter_id_score: 70, early_voting_score: 80, mail_voting_score: 85, registration_score: 80, felon_voting_score: 65, restrictive_law_count: 1, expansive_law_count: 7 },
  { state: 'MN', state_name: 'Minnesota', overall_score: 87, voter_id_score: 85, early_voting_score: 85, mail_voting_score: 80, registration_score: 95, felon_voting_score: 80, restrictive_law_count: 0, expansive_law_count: 9 },
  { state: 'MS', state_name: 'Mississippi', overall_score: 30, voter_id_score: 20, early_voting_score: 20, mail_voting_score: 20, registration_score: 30, felon_voting_score: 10, restrictive_law_count: 7, expansive_law_count: 0 },
  { state: 'MO', state_name: 'Missouri', overall_score: 38, voter_id_score: 25, early_voting_score: 40, mail_voting_score: 35, registration_score: 40, felon_voting_score: 45, restrictive_law_count: 5, expansive_law_count: 1 },
  { state: 'MT', state_name: 'Montana', overall_score: 52, voter_id_score: 45, early_voting_score: 55, mail_voting_score: 50, registration_score: 60, felon_voting_score: 55, restrictive_law_count: 3, expansive_law_count: 3 },
  { state: 'NE', state_name: 'Nebraska', overall_score: 55, voter_id_score: 40, early_voting_score: 60, mail_voting_score: 55, registration_score: 60, felon_voting_score: 50, restrictive_law_count: 3, expansive_law_count: 3 },
  { state: 'NV', state_name: 'Nevada', overall_score: 82, voter_id_score: 80, early_voting_score: 80, mail_voting_score: 90, registration_score: 85, felon_voting_score: 70, restrictive_law_count: 1, expansive_law_count: 8 },
  { state: 'NH', state_name: 'New Hampshire', overall_score: 65, voter_id_score: 50, early_voting_score: 55, mail_voting_score: 55, registration_score: 90, felon_voting_score: 70, restrictive_law_count: 2, expansive_law_count: 4 },
  { state: 'NJ', state_name: 'New Jersey', overall_score: 78, voter_id_score: 80, early_voting_score: 75, mail_voting_score: 80, registration_score: 80, felon_voting_score: 70, restrictive_law_count: 1, expansive_law_count: 7 },
  { state: 'NM', state_name: 'New Mexico', overall_score: 80, voter_id_score: 85, early_voting_score: 80, mail_voting_score: 75, registration_score: 80, felon_voting_score: 70, restrictive_law_count: 1, expansive_law_count: 7 },
  { state: 'NY', state_name: 'New York', overall_score: 72, voter_id_score: 80, early_voting_score: 65, mail_voting_score: 65, registration_score: 70, felon_voting_score: 75, restrictive_law_count: 2, expansive_law_count: 6 },
  { state: 'NC', state_name: 'North Carolina', overall_score: 43, voter_id_score: 25, early_voting_score: 55, mail_voting_score: 35, registration_score: 50, felon_voting_score: 35, restrictive_law_count: 6, expansive_law_count: 2 },
  { state: 'ND', state_name: 'North Dakota', overall_score: 50, voter_id_score: 30, early_voting_score: 55, mail_voting_score: 50, registration_score: 60, felon_voting_score: 55, restrictive_law_count: 3, expansive_law_count: 2 },
  { state: 'OH', state_name: 'Ohio', overall_score: 42, voter_id_score: 25, early_voting_score: 50, mail_voting_score: 40, registration_score: 45, felon_voting_score: 50, restrictive_law_count: 5, expansive_law_count: 2 },
  { state: 'OK', state_name: 'Oklahoma', overall_score: 36, voter_id_score: 25, early_voting_score: 40, mail_voting_score: 30, registration_score: 40, felon_voting_score: 35, restrictive_law_count: 5, expansive_law_count: 1 },
  { state: 'OR', state_name: 'Oregon', overall_score: 100, voter_id_score: 95, early_voting_score: 95, mail_voting_score: 100, registration_score: 100, felon_voting_score: 95, restrictive_law_count: 0, expansive_law_count: 13 },
  { state: 'PA', state_name: 'Pennsylvania', overall_score: 55, voter_id_score: 60, early_voting_score: 50, mail_voting_score: 60, registration_score: 55, felon_voting_score: 50, restrictive_law_count: 3, expansive_law_count: 4 },
  { state: 'RI', state_name: 'Rhode Island', overall_score: 65, voter_id_score: 50, early_voting_score: 65, mail_voting_score: 70, registration_score: 70, felon_voting_score: 60, restrictive_law_count: 2, expansive_law_count: 4 },
  { state: 'SC', state_name: 'South Carolina', overall_score: 34, voter_id_score: 20, early_voting_score: 35, mail_voting_score: 25, registration_score: 35, felon_voting_score: 40, restrictive_law_count: 5, expansive_law_count: 1 },
  { state: 'SD', state_name: 'South Dakota', overall_score: 48, voter_id_score: 35, early_voting_score: 55, mail_voting_score: 45, registration_score: 50, felon_voting_score: 55, restrictive_law_count: 3, expansive_law_count: 2 },
  { state: 'TN', state_name: 'Tennessee', overall_score: 32, voter_id_score: 15, early_voting_score: 40, mail_voting_score: 20, registration_score: 35, felon_voting_score: 15, restrictive_law_count: 6, expansive_law_count: 1 },
  { state: 'TX', state_name: 'Texas', overall_score: 35, voter_id_score: 20, early_voting_score: 50, mail_voting_score: 20, registration_score: 30, felon_voting_score: 30, restrictive_law_count: 8, expansive_law_count: 1 },
  { state: 'UT', state_name: 'Utah', overall_score: 75, voter_id_score: 65, early_voting_score: 75, mail_voting_score: 90, registration_score: 70, felon_voting_score: 60, restrictive_law_count: 1, expansive_law_count: 6 },
  { state: 'VT', state_name: 'Vermont', overall_score: 92, voter_id_score: 95, early_voting_score: 85, mail_voting_score: 90, registration_score: 95, felon_voting_score: 100, restrictive_law_count: 0, expansive_law_count: 10 },
  { state: 'VA', state_name: 'Virginia', overall_score: 60, voter_id_score: 40, early_voting_score: 65, mail_voting_score: 55, registration_score: 65, felon_voting_score: 55, restrictive_law_count: 3, expansive_law_count: 5 },
  { state: 'WA', state_name: 'Washington', overall_score: 96, voter_id_score: 90, early_voting_score: 95, mail_voting_score: 100, registration_score: 95, felon_voting_score: 85, restrictive_law_count: 0, expansive_law_count: 11 },
  { state: 'WV', state_name: 'West Virginia', overall_score: 38, voter_id_score: 30, early_voting_score: 40, mail_voting_score: 35, registration_score: 40, felon_voting_score: 30, restrictive_law_count: 4, expansive_law_count: 1 },
  { state: 'WI', state_name: 'Wisconsin', overall_score: 50, voter_id_score: 30, early_voting_score: 55, mail_voting_score: 50, registration_score: 80, felon_voting_score: 45, restrictive_law_count: 4, expansive_law_count: 3 },
  { state: 'WY', state_name: 'Wyoming', overall_score: 48, voter_id_score: 40, early_voting_score: 50, mail_voting_score: 45, registration_score: 50, felon_voting_score: 50, restrictive_law_count: 3, expansive_law_count: 2 },
  { state: 'DC', state_name: 'District of Columbia', overall_score: 90, voter_id_score: 90, early_voting_score: 85, mail_voting_score: 85, registration_score: 95, felon_voting_score: 100, restrictive_law_count: 0, expansive_law_count: 9 },
];

// ---------------------------------------------------------------------------
// Voter Access Laws (battleground + notable states)
// ---------------------------------------------------------------------------

const VOTER_ACCESS_LAWS = [
  // Georgia (SB 202, 2021)
  {
    state: 'GA', law_type: 'voter_id', title: 'SB 202 — Absentee Ballot ID Requirement',
    description: 'Requires voters to provide driver\'s license number or state ID number on absentee ballot applications and return envelopes, replacing signature match verification.',
    enacted_date: '2021-03-25', effective_date: '2021-03-25', is_restrictive: true, bill_number: 'SB 202',
    source_url: 'https://www.legis.ga.gov/legislation/59827', source_label: 'Georgia General Assembly',
  },
  {
    state: 'GA', law_type: 'polling_place', title: 'SB 202 — Drop Box Restrictions',
    description: 'Limits absentee ballot drop boxes to one per 100,000 active voters or one per early voting site, whichever is less. Boxes must be inside early voting locations during business hours only.',
    enacted_date: '2021-03-25', effective_date: '2021-03-25', is_restrictive: true, bill_number: 'SB 202',
    source_url: 'https://www.legis.ga.gov/legislation/59827', source_label: 'Georgia General Assembly',
  },
  {
    state: 'GA', law_type: 'early_voting', title: 'SB 202 — Weekend Early Voting Expansion',
    description: 'Requires two mandatory Saturday early voting days (previously one) and makes two optional Sunday early voting days available for counties.',
    enacted_date: '2021-03-25', effective_date: '2021-03-25', is_restrictive: false, bill_number: 'SB 202',
    source_url: 'https://www.legis.ga.gov/legislation/59827', source_label: 'Georgia General Assembly',
  },

  // Texas (SB 1, 2021)
  {
    state: 'TX', law_type: 'mail_voting', title: 'SB 1 — Mail Ballot ID and Rejection',
    description: 'Requires voters to provide driver\'s license or SSN last-4 on mail ballot applications and return envelopes. Ballots rejected if ID numbers don\'t match voter registration records.',
    enacted_date: '2021-09-07', effective_date: '2021-12-02', is_restrictive: true, bill_number: 'SB 1',
    source_url: 'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=872&Bill=SB1', source_label: 'Texas Legislature',
  },
  {
    state: 'TX', law_type: 'early_voting', title: 'SB 1 — Ban on 24-Hour and Drive-Through Voting',
    description: 'Prohibits extended overnight early voting hours and drive-through voting locations that were used in Harris County during 2020.',
    enacted_date: '2021-09-07', effective_date: '2021-12-02', is_restrictive: true, bill_number: 'SB 1',
    source_url: 'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=872&Bill=SB1', source_label: 'Texas Legislature',
  },
  {
    state: 'TX', law_type: 'registration', title: 'SB 1 — Voter Registration Restrictions',
    description: 'Adds new criminal penalties for election officials who proactively send mail ballot applications to voters who did not request them.',
    enacted_date: '2021-09-07', effective_date: '2021-12-02', is_restrictive: true, bill_number: 'SB 1',
    source_url: 'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=872&Bill=SB1', source_label: 'Texas Legislature',
  },

  // Florida (SB 90, 2021 + SB 7050, 2023)
  {
    state: 'FL', law_type: 'mail_voting', title: 'SB 90 — Mail Ballot Request Frequency',
    description: 'Requires voters to request mail ballots every election cycle instead of every two cycles. Adds new ID requirements for drop box usage.',
    enacted_date: '2021-05-06', effective_date: '2021-05-06', is_restrictive: true, bill_number: 'SB 90',
    source_url: 'https://www.flsenate.gov/Session/Bill/2021/90', source_label: 'Florida Senate',
  },
  {
    state: 'FL', law_type: 'registration', title: 'SB 7050 — Third-Party Voter Registration Restrictions',
    description: 'Increases penalties on third-party voter registration organizations and shortens the window to deliver completed registration forms from 14 to 10 days.',
    enacted_date: '2023-05-24', effective_date: '2023-07-01', is_restrictive: true, bill_number: 'SB 7050',
    source_url: 'https://www.flsenate.gov/Session/Bill/2023/7050', source_label: 'Florida Senate',
  },
  {
    state: 'FL', law_type: 'felon_voting', title: 'Amendment 4 Implementation — Fines and Fees Requirement',
    description: 'Despite Amendment 4 restoring felon voting rights, SB 7066 requires all fines, fees, and restitution be paid before registration, affecting an estimated 774,000 Floridians.',
    enacted_date: '2019-06-28', effective_date: '2019-07-01', is_restrictive: true, bill_number: 'SB 7066',
    source_url: 'https://www.flsenate.gov/Session/Bill/2019/7066', source_label: 'Florida Senate',
  },

  // Arizona
  {
    state: 'AZ', law_type: 'mail_voting', title: 'HB 2243 — Active Early Voting List Purge',
    description: 'Removes voters from the permanent early voting list if they fail to vote by mail in two consecutive election cycles and do not respond to a confirmation notice.',
    enacted_date: '2021-05-11', effective_date: '2021-09-29', is_restrictive: true, bill_number: 'HB 2243',
    source_url: 'https://www.azleg.gov/legtext/55leg/1R/bills/HB2243P.htm', source_label: 'Arizona Legislature',
  },
  {
    state: 'AZ', law_type: 'voter_id', title: 'HB 2492 — Proof of Citizenship for Voter Registration',
    description: 'Requires documentary proof of citizenship (birth certificate, passport) for state/local voter registration. Partially blocked by courts.',
    enacted_date: '2022-03-30', effective_date: '2023-01-01', is_restrictive: true, bill_number: 'HB 2492',
    source_url: 'https://www.azleg.gov/legtext/55leg/2R/bills/HB2492P.htm', source_label: 'Arizona Legislature',
  },

  // Pennsylvania
  {
    state: 'PA', law_type: 'mail_voting', title: 'Act 77 — No-Excuse Mail Voting',
    description: 'Established no-excuse mail voting in Pennsylvania, allowing any registered voter to request a mail-in ballot without providing a reason.',
    enacted_date: '2019-10-31', effective_date: '2020-01-01', is_restrictive: false, bill_number: 'Act 77',
    source_url: 'https://www.legis.state.pa.us/cfdocs/billinfo/billinfo.cfm?syear=2019&sind=0&body=H&type=B&bn=0421', source_label: 'Pennsylvania General Assembly',
  },
  {
    state: 'PA', law_type: 'registration', title: 'PA Automatic Voter Registration',
    description: 'Automatic voter registration through PennDOT driver\'s license transactions. Eligible citizens are registered unless they opt out.',
    enacted_date: '2023-09-19', effective_date: '2023-09-19', is_restrictive: false, bill_number: 'Executive Order 2023-15',
    source_url: 'https://www.governor.pa.gov/newsroom/', source_label: 'Pennsylvania Governor\'s Office',
  },

  // Michigan (Prop 2, 2018 + Prop 2, 2022)
  {
    state: 'MI', law_type: 'registration', title: 'Proposal 3 (2018) — Automatic Voter Registration',
    description: 'Constitutional amendment establishing automatic voter registration, same-day registration, no-reason absentee voting, and straight-ticket voting.',
    enacted_date: '2018-11-06', effective_date: '2019-03-29', is_restrictive: false, bill_number: 'Proposal 3',
    source_url: 'https://www.michigan.gov/sos/elections/voting/register-to-vote', source_label: 'Michigan Secretary of State',
  },
  {
    state: 'MI', law_type: 'early_voting', title: 'Proposal 2 (2022) — Nine Days of Early Voting',
    description: 'Constitutional amendment requiring at least 9 days of early in-person voting, ballot drop boxes in every municipality, and state-funded prepaid postage for mail ballots.',
    enacted_date: '2022-11-08', effective_date: '2023-02-13', is_restrictive: false, bill_number: 'Proposal 2',
    source_url: 'https://www.michigan.gov/sos/elections/voting/early-voting', source_label: 'Michigan Secretary of State',
  },

  // Wisconsin
  {
    state: 'WI', law_type: 'voter_id', title: 'Act 23 — Strict Photo ID Requirement',
    description: 'Requires voters to present approved photo identification at the polls. Accepted forms include driver\'s license, state ID, passport, military ID, or certain student IDs.',
    enacted_date: '2011-05-25', effective_date: '2016-04-05', is_restrictive: true, bill_number: '2011 Act 23',
    source_url: 'https://docs.legis.wisconsin.gov/2011/related/acts/23', source_label: 'Wisconsin Legislature',
  },
  {
    state: 'WI', law_type: 'registration', title: 'Same-Day Voter Registration',
    description: 'Wisconsin allows eligible voters to register and vote on the same day at their polling place with proof of residence. One of the earliest SDR states.',
    enacted_date: '1976-01-01', effective_date: '1976-01-01', is_restrictive: false, bill_number: null,
    source_url: 'https://elections.wi.gov/voters/first-time', source_label: 'Wisconsin Elections Commission',
  },
  {
    state: 'WI', law_type: 'mail_voting', title: 'Drop Box Ban (Wisconsin Supreme Court)',
    description: 'Wisconsin Supreme Court ruled absentee ballot drop boxes may not be placed in locations other than staffed clerk offices, effectively banning unstaffed drop boxes statewide.',
    enacted_date: '2022-07-08', effective_date: '2022-07-08', is_restrictive: true, bill_number: 'Teigen v. WEC',
    source_url: 'https://www.wicourts.gov/sc/opinion/DisplayDocument.html?content=html&seqNo=593460', source_label: 'Wisconsin Supreme Court',
  },

  // North Carolina
  {
    state: 'NC', law_type: 'voter_id', title: 'SB 824 — Voter Photo ID Requirement',
    description: 'Requires photo ID to vote in person or by absentee ballot. Accepted forms include driver\'s license, passport, or a free county-issued voter ID card.',
    enacted_date: '2018-12-19', effective_date: '2023-04-01', is_restrictive: true, bill_number: 'SB 824',
    source_url: 'https://www.ncleg.gov/BillLookup/2017/S824', source_label: 'North Carolina General Assembly',
  },
  {
    state: 'NC', law_type: 'registration', title: 'Same-Day Registration During Early Voting',
    description: 'North Carolina allows same-day voter registration during the early voting period. Voters can register and cast a ballot at any early voting site in their county.',
    enacted_date: '2007-01-01', effective_date: '2007-01-01', is_restrictive: false, bill_number: null,
    source_url: 'https://www.ncsbe.gov/registering/how-register', source_label: 'NC State Board of Elections',
  },

  // Ohio
  {
    state: 'OH', law_type: 'voter_id', title: 'HB 458 — Strict Photo ID and Mail Ballot Restrictions',
    description: 'Eliminates most non-photo IDs for in-person voting, reduces early voting by one day, and shortens the window to request and return absentee ballots.',
    enacted_date: '2023-01-06', effective_date: '2023-04-07', is_restrictive: true, bill_number: 'HB 458',
    source_url: 'https://www.legislature.ohio.gov/legislation/134/hb458', source_label: 'Ohio General Assembly',
  },
  {
    state: 'OH', law_type: 'purge', title: 'Supplemental Process for Removing Inactive Voters',
    description: 'Ohio uses a "supplemental process" to remove voters who have not voted in six consecutive years and fail to respond to a confirmation notice.',
    enacted_date: '2015-02-01', effective_date: '2015-02-01', is_restrictive: true, bill_number: null,
    source_url: 'https://www.ohiosos.gov/elections-voting/', source_label: 'Ohio Secretary of State',
  },

  // Nevada
  {
    state: 'NV', law_type: 'mail_voting', title: 'AB 321 — Universal Mail Ballot',
    description: 'All active registered voters are automatically mailed a ballot for every election. Ballots can be returned by mail, drop box, or in person.',
    enacted_date: '2021-06-02', effective_date: '2022-01-01', is_restrictive: false, bill_number: 'AB 321',
    source_url: 'https://www.leg.state.nv.us/App/NELIS/REL/81st2021/Bill/7842/Overview', source_label: 'Nevada Legislature',
  },
  {
    state: 'NV', law_type: 'registration', title: 'Automatic Voter Registration',
    description: 'Nevada automatically registers eligible citizens when they interact with the DMV unless they opt out. Approved by voters via ballot Question 5 in 2018.',
    enacted_date: '2018-11-06', effective_date: '2020-01-01', is_restrictive: false, bill_number: 'Question 5',
    source_url: 'https://www.nvsos.gov/sos/elections/voters/registering-to-vote', source_label: 'Nevada Secretary of State',
  },

  // Oregon (pioneer state)
  {
    state: 'OR', law_type: 'mail_voting', title: 'Vote By Mail (1998)',
    description: 'Oregon became the first state to conduct all elections entirely by mail. Every registered voter receives a ballot by mail approximately 2-3 weeks before Election Day.',
    enacted_date: '1998-11-03', effective_date: '2000-01-01', is_restrictive: false, bill_number: 'Measure 60',
    source_url: 'https://sos.oregon.gov/voting/Pages/voteinor.aspx', source_label: 'Oregon Secretary of State',
  },
  {
    state: 'OR', law_type: 'registration', title: 'Oregon Motor Voter — Automatic Registration',
    description: 'First-in-nation automatic voter registration. Eligible citizens are automatically registered when interacting with the DMV unless they opt out.',
    enacted_date: '2015-03-16', effective_date: '2016-01-01', is_restrictive: false, bill_number: 'HB 2177',
    source_url: 'https://sos.oregon.gov/voting/Pages/registration.aspx', source_label: 'Oregon Secretary of State',
  },

  // Colorado
  {
    state: 'CO', law_type: 'mail_voting', title: 'All-Mail Ballot Elections',
    description: 'Every active registered voter in Colorado receives a mail ballot. Voters can also vote in person at voter service and polling centers.',
    enacted_date: '2013-05-10', effective_date: '2013-06-10', is_restrictive: false, bill_number: 'HB 13-1303',
    source_url: 'https://www.sos.state.co.us/pubs/elections/vote/VoterHome.html', source_label: 'Colorado Secretary of State',
  },
  {
    state: 'CO', law_type: 'registration', title: 'Same-Day Voter Registration',
    description: 'Colorado allows same-day voter registration at any voter service and polling center through and including Election Day.',
    enacted_date: '2013-05-10', effective_date: '2013-06-10', is_restrictive: false, bill_number: 'HB 13-1303',
    source_url: 'https://www.sos.state.co.us/pubs/elections/vote/VoterHome.html', source_label: 'Colorado Secretary of State',
  },
];

// ---------------------------------------------------------------------------
// Voter Access Impacts (demographic data for key laws)
// ---------------------------------------------------------------------------

const VOTER_ACCESS_IMPACTS = [
  // Georgia SB 202
  {
    law_state: 'GA', law_title: 'SB 202 — Absentee Ballot ID Requirement',
    demographic_group: 'Black voters',
    impact_description: 'An estimated 200,000 registered voters in Georgia lack the qualifying photo ID, with Black voters 3x more likely to lack a driver\'s license than white voters according to Brennan Center analysis.',
    affected_population: 200000, percentage_affected: 2.8,
    source_url: 'https://www.brennancenter.org/our-work/research-reports/impact-voter-suppression-communities-color',
  },
  {
    law_state: 'GA', law_title: 'SB 202 — Drop Box Restrictions',
    demographic_group: 'Urban voters (metro Atlanta)',
    impact_description: 'Drop boxes in Fulton County reduced from 38 during 2020 to 8 under SB 202, a 79% reduction disproportionately affecting Atlanta\'s majority-Black population.',
    affected_population: 500000, percentage_affected: 8.5,
    source_url: 'https://www.brennancenter.org/our-work/research-reports/georgias-sb-202',
  },

  // Texas SB 1
  {
    law_state: 'TX', law_title: 'SB 1 — Mail Ballot ID and Rejection',
    demographic_group: 'Latino voters',
    impact_description: 'Mail ballot rejection rates rose to 12.4% in the March 2022 primary (vs. 0.8% in 2020), with rejections concentrated in heavily Latino counties along the Texas-Mexico border.',
    affected_population: 24000, percentage_affected: 12.4,
    source_url: 'https://www.brennancenter.org/our-work/research-reports/texass-mail-ballot-rejection-crisis',
  },
  {
    law_state: 'TX', law_title: 'SB 1 — Ban on 24-Hour and Drive-Through Voting',
    demographic_group: 'Shift workers and disabled voters',
    impact_description: 'In 2020, 127,000 Harris County voters used 24-hour and drive-through voting. These voters were disproportionately Black (53%) and worked non-traditional hours.',
    affected_population: 127000, percentage_affected: null,
    source_url: 'https://www.harrisvotes.com/',
  },

  // Florida felon voting
  {
    law_state: 'FL', law_title: 'Amendment 4 Implementation — Fines and Fees Requirement',
    demographic_group: 'Formerly incarcerated individuals',
    impact_description: 'An estimated 774,000 returning citizens who would be eligible under Amendment 4 still cannot vote due to outstanding fines, fees, or restitution — many of which cannot be determined due to poor state records.',
    affected_population: 774000, percentage_affected: null,
    source_url: 'https://www.brennancenter.org/our-work/research-reports/voting-rights-restoration-florida',
  },

  // Arizona
  {
    law_state: 'AZ', law_title: 'HB 2243 — Active Early Voting List Purge',
    demographic_group: 'Native American voters',
    impact_description: 'Approximately 126,000 voters were at risk of removal from the early voting list, with Native American voters on remote reservations disproportionately affected due to limited mail access.',
    affected_population: 126000, percentage_affected: 3.1,
    source_url: 'https://www.brennancenter.org/our-work/analysis-opinion/arizonas-attack-voting-mail',
  },

  // Wisconsin
  {
    law_state: 'WI', law_title: 'Act 23 — Strict Photo ID Requirement',
    demographic_group: 'Black voters in Milwaukee',
    impact_description: 'A University of Wisconsin study found the voter ID law deterred 11.2% of eligible non-voters in Milwaukee County, with Black respondents deterred at nearly twice the rate of white respondents.',
    affected_population: 23000, percentage_affected: 11.2,
    source_url: 'https://elections.wisc.edu/',
  },

  // Ohio
  {
    law_state: 'OH', law_title: 'Supplemental Process for Removing Inactive Voters',
    demographic_group: 'Low-income and minority voters',
    impact_description: 'Between 2015 and 2020, Ohio purged approximately 460,000 voters through the supplemental process, with purge rates highest in urban counties with larger minority populations.',
    affected_population: 460000, percentage_affected: null,
    source_url: 'https://www.brennancenter.org/our-work/analysis-opinion/ohios-voter-purge',
  },

  // North Carolina
  {
    law_state: 'NC', law_title: 'SB 824 — Voter Photo ID Requirement',
    demographic_group: 'Black voters',
    impact_description: 'NAACP analysis found that 318,000 registered NC voters lack qualifying photo ID, with Black voters constituting 23% of those affected despite being 22% of registered voters.',
    affected_population: 318000, percentage_affected: 4.5,
    source_url: 'https://www.brennancenter.org/our-work/research-reports/new-voter-suppression',
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n=== Seed Voter Access ===`);
  console.log(`State scores to seed: ${STATE_SCORES.length}`);
  console.log(`Laws to seed: ${VOTER_ACCESS_LAWS.length}`);
  console.log(`Impacts to seed: ${VOTER_ACCESS_IMPACTS.length}`);
  console.log(`Dry run: ${dryRun}\n`);

  // -- State scores --
  let scoresInserted = 0;
  let scoresUpdated = 0;

  console.log('--- State Scores ---');
  for (const s of STATE_SCORES) {
    if (dryRun) {
      console.log(`[DRY RUN] Would upsert: ${s.state_name} (${s.state}) — score ${s.overall_score}`);
      continue;
    }

    const { rows } = await pool.query(
      `INSERT INTO voter_access_state_scores
         (state, state_name, overall_score, voter_id_score, early_voting_score,
          mail_voting_score, registration_score, felon_voting_score,
          restrictive_law_count, expansive_law_count, last_computed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (state) DO UPDATE SET
         state_name = EXCLUDED.state_name,
         overall_score = EXCLUDED.overall_score,
         voter_id_score = EXCLUDED.voter_id_score,
         early_voting_score = EXCLUDED.early_voting_score,
         mail_voting_score = EXCLUDED.mail_voting_score,
         registration_score = EXCLUDED.registration_score,
         felon_voting_score = EXCLUDED.felon_voting_score,
         restrictive_law_count = EXCLUDED.restrictive_law_count,
         expansive_law_count = EXCLUDED.expansive_law_count,
         last_computed_at = NOW(),
         updated_at = NOW()
       RETURNING (xmax = 0) AS is_insert`,
      [
        s.state, s.state_name, s.overall_score, s.voter_id_score,
        s.early_voting_score, s.mail_voting_score, s.registration_score,
        s.felon_voting_score, s.restrictive_law_count, s.expansive_law_count,
      ]
    );

    if (rows[0].is_insert) {
      scoresInserted++;
      console.log(`  INSERTED: ${s.state_name} (${s.overall_score})`);
    } else {
      scoresUpdated++;
      console.log(`  UPDATED:  ${s.state_name} (${s.overall_score})`);
    }
  }

  // -- Voter access laws --
  let lawsInserted = 0;
  let lawsUpdated = 0;
  const lawIdMap = {}; // key: "state|title" => law_id

  console.log('\n--- Voter Access Laws ---');
  for (const law of VOTER_ACCESS_LAWS) {
    if (dryRun) {
      console.log(`[DRY RUN] Would upsert: ${law.state} — ${law.title}`);
      continue;
    }

    const { rows } = await pool.query(
      `INSERT INTO voter_access_laws
         (state, law_type, title, description, enacted_date, effective_date,
          is_restrictive, bill_number, source_url, source_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT ON CONSTRAINT voter_access_laws_state_title_key DO UPDATE SET
         law_type = EXCLUDED.law_type,
         description = EXCLUDED.description,
         enacted_date = EXCLUDED.enacted_date,
         effective_date = EXCLUDED.effective_date,
         is_restrictive = EXCLUDED.is_restrictive,
         bill_number = EXCLUDED.bill_number,
         source_url = EXCLUDED.source_url,
         source_label = EXCLUDED.source_label,
         updated_at = NOW()
       RETURNING id, (xmax = 0) AS is_insert`,
      [
        law.state, law.law_type, law.title, law.description,
        law.enacted_date, law.effective_date, law.is_restrictive,
        law.bill_number, law.source_url, law.source_label,
      ]
    );

    lawIdMap[`${law.state}|${law.title}`] = rows[0].id;

    if (rows[0].is_insert) {
      lawsInserted++;
      console.log(`  INSERTED: ${law.state} — ${law.title}`);
    } else {
      lawsUpdated++;
      console.log(`  UPDATED:  ${law.state} — ${law.title}`);
    }
  }

  // -- Voter access impacts --
  let impactsInserted = 0;
  let impactsUpdated = 0;

  console.log('\n--- Voter Access Impacts ---');
  for (const impact of VOTER_ACCESS_IMPACTS) {
    if (dryRun) {
      console.log(`[DRY RUN] Would upsert: ${impact.law_state} — ${impact.demographic_group}`);
      continue;
    }

    // Look up the law_id
    const lawKey = `${impact.law_state}|${impact.law_title}`;
    let lawId = lawIdMap[lawKey];

    if (!lawId) {
      // Try to find it in the database
      const { rows: lawRows } = await pool.query(
        `SELECT id FROM voter_access_laws WHERE state = $1 AND title = $2`,
        [impact.law_state, impact.law_title]
      );
      if (lawRows.length > 0) {
        lawId = lawRows[0].id;
      } else {
        console.log(`  SKIPPED: No matching law for ${impact.law_state} — ${impact.law_title}`);
        continue;
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO voter_access_impacts
         (law_id, demographic_group, impact_description, affected_population,
          percentage_affected, source_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ON CONSTRAINT voter_access_impacts_law_id_demographic_key DO UPDATE SET
         impact_description = EXCLUDED.impact_description,
         affected_population = EXCLUDED.affected_population,
         percentage_affected = EXCLUDED.percentage_affected,
         source_url = EXCLUDED.source_url
       RETURNING (xmax = 0) AS is_insert`,
      [
        lawId, impact.demographic_group, impact.impact_description,
        impact.affected_population, impact.percentage_affected,
        impact.source_url,
      ]
    );

    if (rows[0].is_insert) {
      impactsInserted++;
      console.log(`  INSERTED: ${impact.law_state} — ${impact.demographic_group}`);
    } else {
      impactsUpdated++;
      console.log(`  UPDATED:  ${impact.law_state} — ${impact.demographic_group}`);
    }
  }

  if (!dryRun) {
    console.log(`\n=== Seed Complete ===`);
    console.log(`Scores  — Inserted: ${scoresInserted}  Updated: ${scoresUpdated}  Total: ${STATE_SCORES.length}`);
    console.log(`Laws    — Inserted: ${lawsInserted}  Updated: ${lawsUpdated}  Total: ${VOTER_ACCESS_LAWS.length}`);
    console.log(`Impacts — Inserted: ${impactsInserted}  Updated: ${impactsUpdated}  Total: ${VOTER_ACCESS_IMPACTS.length}`);
  } else {
    console.log(`\n[DRY RUN] Would process ${STATE_SCORES.length} scores, ${VOTER_ACCESS_LAWS.length} laws, ${VOTER_ACCESS_IMPACTS.length} impacts`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
