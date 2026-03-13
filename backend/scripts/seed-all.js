#!/usr/bin/env node

/**
 * Comprehensive Database Seed Script
 *
 * Populates the database with:
 * - Issues under all 12 categories
 * - 2024 & 2026 federal elections + state elections
 * - Federal offices (President, Senate, House) + Governor offices
 * - Races linking elections to offices
 * - All current officials as shadow candidate profiles
 * - Candidacies linking candidates to races
 * - Issue positions for candidates
 * - Sample engagement data (town halls, questions, posts)
 *
 * Usage: node seed-all.js [--clean] [--skip-engagement]
 *   --clean            Drop and re-seed all seeded data
 *   --skip-engagement  Skip sample engagement data
 *   --only-structure   Only seed issues, elections, offices, races (no candidates)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

// Data files
const issueData = require('./seed-data/issues');
const senators = require('./seed-data/senators');
const governors = require('./seed-data/governors');
const representatives = require('./seed-data/representatives');
const states = require('./seed-data/states');

const args = process.argv.slice(2);
const CLEAN = args.includes('--clean');
const SKIP_ENGAGEMENT = args.includes('--skip-engagement');
const ONLY_STRUCTURE = args.includes('--only-structure');

const stats = {
  issues: 0,
  elections: 0,
  offices: 0,
  races: 0,
  candidates: 0,
  candidacies: 0,
  positions: 0,
  townHalls: 0,
  questions: 0,
  posts: 0,
};

async function main() {
  const client = await db.getClient();

  try {
    console.log('=== WhosRunningUSA Database Seed ===\n');

    if (CLEAN) {
      console.log('Cleaning existing seeded data...');
      await cleanData(client);
    }

    // 1. Seed issues
    console.log('\n--- Seeding Issues ---');
    const issueMap = await seedIssues(client);

    // 2. Seed elections
    console.log('\n--- Seeding Elections ---');
    const electionMap = await seedElections(client);

    // 3. Seed offices
    console.log('\n--- Seeding Offices ---');
    const officeMap = await seedOffices(client);

    // 4. Seed races
    console.log('\n--- Seeding Races ---');
    const raceMap = await seedRaces(client, electionMap, officeMap);

    if (!ONLY_STRUCTURE) {
      // 5. Seed candidates
      console.log('\n--- Seeding Candidates ---');
      const candidateMap = await seedCandidates(client);

      // 6. Link candidates to races
      console.log('\n--- Seeding Candidacies ---');
      await seedCandidacies(client, candidateMap, raceMap);

      // 7. Seed positions
      console.log('\n--- Seeding Issue Positions ---');
      await seedPositions(client, candidateMap, issueMap);

      if (!SKIP_ENGAGEMENT) {
        // 8. Sample engagement data
        console.log('\n--- Seeding Engagement Data ---');
        await seedEngagementData(client, candidateMap, issueMap);
      }
    }

    // Report
    console.log('\n=== Seed Complete ===');
    console.log(`  Issues:      ${stats.issues}`);
    console.log(`  Elections:   ${stats.elections}`);
    console.log(`  Offices:     ${stats.offices}`);
    console.log(`  Races:       ${stats.races}`);
    console.log(`  Candidates:  ${stats.candidates}`);
    console.log(`  Candidacies: ${stats.candidacies}`);
    console.log(`  Positions:   ${stats.positions}`);
    console.log(`  Town Halls:  ${stats.townHalls}`);
    console.log(`  Questions:   ${stats.questions}`);
    console.log(`  Posts:       ${stats.posts}`);
    console.log('');

  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await db.pool.end();
  }
}

// =====================================================
// CLEAN
// =====================================================

async function cleanData(client) {
  await client.query('BEGIN');
  try {
    // Delete in dependency order
    await client.query('DELETE FROM voting_guide_picks');
    await client.query('DELETE FROM voting_guides');
    await client.query('DELETE FROM town_hall_question_upvotes');
    await client.query('DELETE FROM town_hall_questions');
    await client.query('DELETE FROM town_hall_rsvps');
    await client.query('DELETE FROM town_halls');
    await client.query('DELETE FROM question_upvotes');
    await client.query('DELETE FROM answers');
    await client.query('DELETE FROM questions');
    await client.query('DELETE FROM posts');
    await client.query('DELETE FROM candidate_positions');
    await client.query('DELETE FROM endorsements');
    await client.query('DELETE FROM follows');
    await client.query('DELETE FROM promises');
    await client.query('DELETE FROM candidacies');
    await client.query('DELETE FROM races');
    await client.query('DELETE FROM offices');
    await client.query('DELETE FROM elections');
    await client.query('DELETE FROM candidate_source_links');
    await client.query('DELETE FROM candidate_profiles');
    await client.query('DELETE FROM issues');
    // Don't delete issue_categories — those are from schema.sql
    // Don't delete users — those are real accounts
    await client.query('COMMIT');
    console.log('  Cleaned all seeded data.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

// =====================================================
// ISSUES
// =====================================================

async function seedIssues(client) {
  const issueMap = {}; // name -> id

  // Get existing category IDs
  const { rows: categories } = await client.query('SELECT id, name FROM issue_categories');
  const catMap = {};
  for (const cat of categories) {
    catMap[cat.name] = cat.id;
  }

  for (const [categoryName, issues] of Object.entries(issueData)) {
    const categoryId = catMap[categoryName];
    if (!categoryId) {
      console.log(`  WARNING: Category "${categoryName}" not found, skipping`);
      continue;
    }

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const { rows } = await client.query(
        `INSERT INTO issues (category_id, name, description, question_text, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [categoryId, issue.name, issue.description, issue.question_text, i + 1]
      );

      if (rows.length > 0) {
        issueMap[issue.name] = rows[0].id;
        stats.issues++;
      } else {
        // Already exists, get the id
        const existing = await client.query('SELECT id FROM issues WHERE name = $1', [issue.name]);
        if (existing.rows.length > 0) issueMap[issue.name] = existing.rows[0].id;
      }
    }
  }

  console.log(`  Seeded ${stats.issues} issues across ${Object.keys(issueData).length} categories`);
  return issueMap;
}

// =====================================================
// ELECTIONS
// =====================================================

async function seedElections(client) {
  const electionMap = {}; // key -> id

  const elections = [
    // Federal elections
    { key: 'federal_2024_general', name: '2024 General Election', date: '2024-11-05', type: 'general', scope: 'federal', state: null, regDeadline: '2024-10-07', earlyStart: '2024-10-21', earlyEnd: '2024-11-04' },
    { key: 'federal_2026_general', name: '2026 General Election', date: '2026-11-03', type: 'general', scope: 'federal', state: null, regDeadline: '2026-10-05', earlyStart: '2026-10-19', earlyEnd: '2026-11-02' },
    { key: 'federal_2026_primary', name: '2026 Primary Elections', date: '2026-06-09', type: 'primary', scope: 'federal', state: null, regDeadline: '2026-05-11' },
  ];

  // Add state-level elections for every state (2026 gubernatorial where applicable)
  const govStates2026 = ['AK', 'HI', 'NJ', 'VA']; // States with 2025-2026 governor races
  for (const st of states) {
    elections.push({
      key: `state_2026_${st.abbr}`,
      name: `${st.name} 2026 General Election`,
      date: '2026-11-03',
      type: 'general',
      scope: 'state',
      state: st.abbr,
      regDeadline: '2026-10-05',
    });
  }

  for (const el of elections) {
    const { rows } = await client.query(
      `INSERT INTO elections (name, election_date, election_type, scope, state, registration_deadline, early_voting_start, early_voting_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [el.name, el.date, el.type, el.scope, el.state, el.regDeadline || null, el.earlyStart || null, el.earlyEnd || null]
    );

    if (rows.length > 0) {
      electionMap[el.key] = rows[0].id;
      stats.elections++;
    } else {
      const existing = await client.query('SELECT id FROM elections WHERE name = $1', [el.name]);
      if (existing.rows.length > 0) electionMap[el.key] = existing.rows[0].id;
    }
  }

  console.log(`  Seeded ${stats.elections} elections`);
  return electionMap;
}

// =====================================================
// OFFICES
// =====================================================

async function seedOffices(client) {
  const officeMap = {}; // key -> id

  // President
  const presResult = await upsertOffice(client, {
    key: 'president',
    name: 'President of the United States',
    level: 'federal',
    term: 4,
    sort: 1,
  });
  officeMap.president = presResult;

  // Vice President
  const vpResult = await upsertOffice(client, {
    key: 'vice_president',
    name: 'Vice President of the United States',
    level: 'federal',
    term: 4,
    sort: 2,
  });
  officeMap.vice_president = vpResult;

  // Senate seats (100 total, 2 per state)
  for (const st of states) {
    for (let seat = 1; seat <= 2; seat++) {
      const key = `senate_${st.abbr}_${seat}`;
      const result = await upsertOffice(client, {
        key,
        name: `U.S. Senator - ${st.name}${seat === 2 ? ' (Class ' + (seat) + ')' : ''}`,
        level: 'federal',
        state: st.abbr,
        term: 6,
        sort: 10,
      });
      officeMap[key] = result;
    }
  }

  // House seats (435 total)
  for (const st of states) {
    for (let d = 1; d <= st.districts; d++) {
      const distLabel = st.districts === 1 ? 'At-Large' : `District ${d}`;
      const key = `house_${st.abbr}_${d}`;
      const result = await upsertOffice(client, {
        key,
        name: `U.S. Representative - ${st.name} ${distLabel}`,
        level: 'federal',
        state: st.abbr,
        district: st.districts === 1 ? 'At-Large' : String(d),
        term: 2,
        sort: 20,
      });
      officeMap[key] = result;
    }
  }

  // Governor offices (50)
  for (const st of states) {
    const key = `governor_${st.abbr}`;
    const result = await upsertOffice(client, {
      key,
      name: `Governor of ${st.name}`,
      level: 'state',
      state: st.abbr,
      term: 4,
      sort: 5,
    });
    officeMap[key] = result;
  }

  console.log(`  Seeded ${stats.offices} offices`);
  return officeMap;
}

async function upsertOffice(client, { name, level, state, county, city, district, term, sort }) {
  // Try to find existing
  let query = 'SELECT id FROM offices WHERE name = $1';
  let params = [name];

  const existing = await client.query(query, params);
  if (existing.rows.length > 0) return existing.rows[0].id;

  const { rows } = await client.query(
    `INSERT INTO offices (name, office_level, state, county, city, district, term_length_years, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [name, level, state || null, county || null, city || null, district || null, term, sort]
  );
  stats.offices++;
  return rows[0].id;
}

// =====================================================
// RACES
// =====================================================

async function seedRaces(client, electionMap, officeMap) {
  const raceMap = {}; // key -> id

  const federalElection2026 = electionMap.federal_2026_general;
  const federalElection2024 = electionMap.federal_2024_general;

  // Senate races for 2026 (Class 2 seats — up in 2026)
  const class2States = senators.filter(s => s[3] === 2).map(s => s[0]);
  const uniqueClass2 = [...new Set(class2States)];

  for (const st of uniqueClass2) {
    // Find the senate office for this state's class 2 seat
    const officeKey = `senate_${st}_2`;
    const officeId = officeMap[officeKey] || officeMap[`senate_${st}_1`];
    if (!officeId || !federalElection2026) continue;

    const stateName = states.find(s => s.abbr === st)?.name || st;
    const key = `senate_2026_${st}`;
    const result = await upsertRace(client, {
      name: `${stateName} U.S. Senate Race 2026`,
      electionId: federalElection2026,
      officeId,
      filingDeadline: '2026-06-01',
    });
    raceMap[key] = result;
  }

  // All 435 House races for 2026
  for (const st of states) {
    for (let d = 1; d <= st.districts; d++) {
      const distLabel = st.districts === 1 ? 'At-Large' : `District ${d}`;
      const officeKey = `house_${st.abbr}_${d}`;
      const officeId = officeMap[officeKey];
      if (!officeId || !federalElection2026) continue;

      const key = `house_2026_${st.abbr}_${d}`;
      const result = await upsertRace(client, {
        name: `${st.name} ${distLabel} U.S. House Race 2026`,
        electionId: federalElection2026,
        officeId,
        filingDeadline: '2026-03-01',
      });
      raceMap[key] = result;
    }
  }

  // Governor races for states with 2026 elections
  // Most governors serve 4-year terms; NH/VT serve 2-year terms
  const govStates2026 = ['NH', 'VT']; // 2-year term states always up
  for (const st of govStates2026) {
    const officeKey = `governor_${st}`;
    const officeId = officeMap[officeKey];
    const stateElection = electionMap[`state_2026_${st}`];
    if (!officeId || !stateElection) continue;

    const stateName = states.find(s => s.abbr === st)?.name || st;
    const key = `governor_2026_${st}`;
    const result = await upsertRace(client, {
      name: `${stateName} Governor Race 2026`,
      electionId: stateElection,
      officeId,
      filingDeadline: '2026-06-01',
    });
    raceMap[key] = result;
  }

  // Create "current term" races for all current office holders (2024 results)
  // Senate Class 1 (won 2024)
  const class1States = senators.filter(s => s[3] === 1).map(s => s[0]);
  const uniqueClass1 = [...new Set(class1States)];

  for (const st of uniqueClass1) {
    const officeKey = `senate_${st}_1`;
    const officeId = officeMap[officeKey] || officeMap[`senate_${st}_2`];
    if (!officeId || !federalElection2024) continue;

    const stateName = states.find(s => s.abbr === st)?.name || st;
    const key = `senate_2024_${st}`;
    const result = await upsertRace(client, {
      name: `${stateName} U.S. Senate Race 2024`,
      electionId: federalElection2024,
      officeId,
    });
    raceMap[key] = result;
  }

  // House races 2024
  for (const st of states) {
    for (let d = 1; d <= st.districts; d++) {
      const distLabel = st.districts === 1 ? 'At-Large' : `District ${d}`;
      const officeKey = `house_${st.abbr}_${d}`;
      const officeId = officeMap[officeKey];
      if (!officeId || !federalElection2024) continue;

      const key = `house_2024_${st.abbr}_${d}`;
      const result = await upsertRace(client, {
        name: `${st.name} ${distLabel} U.S. House Race 2024`,
        electionId: federalElection2024,
        officeId,
      });
      raceMap[key] = result;
    }
  }

  console.log(`  Seeded ${stats.races} races`);
  return raceMap;
}

async function upsertRace(client, { name, electionId, officeId, filingDeadline }) {
  const existing = await client.query(
    'SELECT id FROM races WHERE name = $1 AND election_id = $2',
    [name, electionId]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const { rows } = await client.query(
    `INSERT INTO races (name, election_id, office_id, filing_deadline)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, electionId, officeId, filingDeadline || null]
  );
  stats.races++;
  return rows[0].id;
}

// =====================================================
// CANDIDATES
// =====================================================

async function seedCandidates(client) {
  const candidateMap = {}; // "type_STATE_detail" -> { id, name, party, state }

  // Seed senators
  for (const [state, name, party, senClass] of senators) {
    const key = `senator_${state}_${senClass}`;
    const nameParts = name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    const id = await upsertCandidate(client, {
      displayName: name,
      firstName,
      lastName,
      party,
      state,
      title: `U.S. Senator from ${states.find(s => s.abbr === state)?.name || state}`,
      isIncumbent: true,
    });
    candidateMap[key] = { id, name, party, state, type: 'senator', class: senClass };
  }

  // Seed governors
  for (const [state, name, party, termEnds] of governors) {
    const key = `governor_${state}`;
    const nameParts = name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    const id = await upsertCandidate(client, {
      displayName: name,
      firstName,
      lastName,
      party,
      state,
      title: `Governor of ${states.find(s => s.abbr === state)?.name || state}`,
      isIncumbent: true,
    });
    candidateMap[key] = { id, name, party, state, type: 'governor' };
  }

  // Seed representatives
  for (const [state, district, name, party] of representatives) {
    const d = district === 0 ? 1 : district;
    const key = `rep_${state}_${d}`;
    const nameParts = name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    const stateName = states.find(s => s.abbr === state)?.name || state;
    const distLabel = states.find(s => s.abbr === state)?.districts === 1
      ? 'At-Large'
      : `District ${district}`;

    const id = await upsertCandidate(client, {
      displayName: name,
      firstName,
      lastName,
      party,
      state,
      title: `U.S. Representative - ${stateName} ${distLabel}`,
      isIncumbent: true,
    });
    candidateMap[key] = { id, name, party, state, type: 'representative', district: d };
  }

  console.log(`  Seeded ${stats.candidates} candidates (${senators.length} senators, ${governors.length} governors, ${representatives.length} representatives)`);
  return candidateMap;
}

async function upsertCandidate(client, { displayName, firstName, lastName, party, state, title, isIncumbent }) {
  // Check if already exists by display_name + state
  const existing = await client.query(
    `SELECT id FROM candidate_profiles
     WHERE display_name = $1 AND EXISTS (
       SELECT 1 FROM candidate_profiles cp2
       WHERE cp2.id = candidate_profiles.id
     )`,
    [displayName]
  );

  if (existing.rows.length > 0) return existing.rows[0].id;

  const { rows } = await client.query(
    `INSERT INTO candidate_profiles (
       display_name, party_affiliation, official_title,
       is_shadow_profile, is_active, candidate_verified, candidate_verified_at,
       incumbent_verified, incumbent_verified_at
     ) VALUES ($1, $2, $3, TRUE, TRUE, $4, $5, $6, $7)
     RETURNING id`,
    [
      displayName, party, title,
      isIncumbent, isIncumbent ? new Date() : null,
      isIncumbent, isIncumbent ? new Date() : null,
    ]
  );
  stats.candidates++;
  return rows[0].id;
}

// =====================================================
// CANDIDACIES
// =====================================================

async function seedCandidacies(client, candidateMap, raceMap) {
  // Link senators to their races
  for (const [key, candidate] of Object.entries(candidateMap)) {
    if (candidate.type === 'senator') {
      // Class 1 senators won in 2024
      if (candidate.class === 1) {
        const raceKey = `senate_2024_${candidate.state}`;
        const raceId = raceMap[raceKey];
        if (raceId) {
          await upsertCandidacy(client, candidate.id, raceId, 'certified', 'won');
        }
      }
      // Class 2 senators are up in 2026 (incumbents)
      if (candidate.class === 2) {
        const raceKey = `senate_2026_${candidate.state}`;
        const raceId = raceMap[raceKey];
        if (raceId) {
          await upsertCandidacy(client, candidate.id, raceId, 'filed', 'pending');
        }
      }
      // Class 3 senators are not up until 2028 — no race to link
    }

    if (candidate.type === 'representative') {
      // Link to 2024 race (won)
      const d = candidate.district;
      const raceKey2024 = `house_2024_${candidate.state}_${d}`;
      const raceId2024 = raceMap[raceKey2024];
      if (raceId2024) {
        await upsertCandidacy(client, candidate.id, raceId2024, 'certified', 'won');
      }
      // Link to 2026 race (running)
      const raceKey2026 = `house_2026_${candidate.state}_${d}`;
      const raceId2026 = raceMap[raceKey2026];
      if (raceId2026) {
        await upsertCandidacy(client, candidate.id, raceId2026, 'exploring', 'pending');
      }
    }

    if (candidate.type === 'governor') {
      // Link to 2026 race if their state has one
      const raceKey = `governor_2026_${candidate.state}`;
      const raceId = raceMap[raceKey];
      if (raceId) {
        await upsertCandidacy(client, candidate.id, raceId, 'filed', 'pending');
      }
    }
  }

  console.log(`  Seeded ${stats.candidacies} candidacies`);
}

async function upsertCandidacy(client, candidateId, raceId, filingStatus, result) {
  const existing = await client.query(
    'SELECT id FROM candidacies WHERE candidate_id = $1 AND race_id = $2',
    [candidateId, raceId]
  );
  if (existing.rows.length > 0) return;

  await client.query(
    `INSERT INTO candidacies (candidate_id, race_id, filing_status, result)
     VALUES ($1, $2, $3, $4)`,
    [candidateId, raceId, filingStatus, result]
  );
  stats.candidacies++;
}

// =====================================================
// POSITIONS
// =====================================================

async function seedPositions(client, candidateMap, issueMap) {
  const issueNames = Object.keys(issueMap);
  if (issueNames.length === 0) {
    console.log('  No issues found, skipping positions');
    return;
  }

  // Deterministic but varied position assignment based on party
  const partyStances = {
    'Republican': {
      'Federal Minimum Wage Increase': 'oppose',
      'Tax Reform': 'support',
      'Labor Union Rights': 'oppose',
      'Student Loan Forgiveness': 'oppose',
      'National Debt Reduction': 'support',
      'Social Security Reform': 'complicated',
      'Trade Policy': 'support',
      'School Choice & Vouchers': 'support',
      'Public School Funding': 'complicated',
      'Public Health Insurance Option': 'oppose',
      'Abortion Access': 'oppose',
      'Prescription Drug Pricing': 'complicated',
      'ACA Protections': 'oppose',
      'Carbon Emissions Reduction': 'oppose',
      'Renewable Energy Investment': 'complicated',
      'Fossil Fuel Production': 'support',
      'Paris Climate Agreement': 'oppose',
      'Gun Background Checks': 'complicated',
      'Assault Weapons Ban': 'oppose',
      'Police Reform': 'oppose',
      'Criminal Justice Reform': 'complicated',
      'Death Penalty': 'support',
      'Fentanyl & Drug Policy': 'support',
      'Voting Rights Protections': 'complicated',
      'LGBTQ+ Equality': 'oppose',
      'Border Security': 'support',
      'Pathway to Citizenship': 'oppose',
      'DACA Protections': 'complicated',
      'Congressional Term Limits': 'support',
      'Campaign Finance Reform': 'complicated',
      'Supreme Court Reform': 'oppose',
      'Congressional Stock Trading Ban': 'support',
      'Ukraine Support': 'complicated',
      'China Relations': 'support',
      'NATO Commitment': 'complicated',
      'Defense Spending': 'support',
      'Broadband Internet Access': 'support',
      'Affordable Housing Construction': 'complicated',
      'First-Time Homebuyer Assistance': 'support',
    },
    'Democrat': {
      'Federal Minimum Wage Increase': 'support',
      'Tax Reform': 'complicated',
      'Labor Union Rights': 'support',
      'Student Loan Forgiveness': 'support',
      'National Debt Reduction': 'complicated',
      'Social Security Reform': 'support',
      'Trade Policy': 'complicated',
      'School Choice & Vouchers': 'oppose',
      'Public School Funding': 'support',
      'Public Health Insurance Option': 'support',
      'Abortion Access': 'support',
      'Prescription Drug Pricing': 'support',
      'ACA Protections': 'support',
      'Carbon Emissions Reduction': 'support',
      'Renewable Energy Investment': 'support',
      'Fossil Fuel Production': 'oppose',
      'Paris Climate Agreement': 'support',
      'Gun Background Checks': 'support',
      'Assault Weapons Ban': 'support',
      'Police Reform': 'support',
      'Criminal Justice Reform': 'support',
      'Death Penalty': 'oppose',
      'Fentanyl & Drug Policy': 'support',
      'Voting Rights Protections': 'support',
      'LGBTQ+ Equality': 'support',
      'Border Security': 'complicated',
      'Pathway to Citizenship': 'support',
      'DACA Protections': 'support',
      'Congressional Term Limits': 'complicated',
      'Campaign Finance Reform': 'support',
      'Supreme Court Reform': 'support',
      'Congressional Stock Trading Ban': 'support',
      'Ukraine Support': 'support',
      'China Relations': 'support',
      'NATO Commitment': 'support',
      'Defense Spending': 'complicated',
      'Broadband Internet Access': 'support',
      'Affordable Housing Construction': 'support',
      'First-Time Homebuyer Assistance': 'support',
    },
    'Independent': {
      'Federal Minimum Wage Increase': 'support',
      'Tax Reform': 'complicated',
      'Labor Union Rights': 'support',
      'National Debt Reduction': 'support',
      'Carbon Emissions Reduction': 'support',
      'Gun Background Checks': 'support',
      'Congressional Term Limits': 'support',
      'Campaign Finance Reform': 'support',
      'Congressional Stock Trading Ban': 'support',
    },
  };

  // Seed positions for all candidates — pick 8-15 random issues per candidate
  const candidates = Object.values(candidateMap);

  for (const candidate of candidates) {
    const party = candidate.party;
    const stances = partyStances[party] || partyStances['Independent'];
    const stanceIssues = Object.keys(stances).filter(name => issueMap[name]);

    // Each candidate gets positions on 8-15 issues
    const numPositions = 8 + Math.floor(seededRandom(candidate.name) * 8);
    const shuffled = shuffleWithSeed(stanceIssues, candidate.name);
    const selected = shuffled.slice(0, Math.min(numPositions, shuffled.length));

    for (let i = 0; i < selected.length; i++) {
      const issueName = selected[i];
      const issueId = issueMap[issueName];
      const stance = stances[issueName] || 'complicated';

      try {
        await client.query(
          `INSERT INTO candidate_positions (candidate_id, issue_id, stance, priority_rank)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (candidate_id, issue_id) DO NOTHING`,
          [candidate.id, issueId, stance, i < 5 ? i + 1 : null]
        );
        stats.positions++;
      } catch (err) {
        // Skip constraint violations
      }
    }
  }

  console.log(`  Seeded ${stats.positions} issue positions`);
}

// =====================================================
// ENGAGEMENT DATA
// =====================================================

async function seedEngagementData(client, candidateMap, issueMap) {
  // Create an admin user for seeding (if doesn't exist)
  let adminId;
  const adminCheck = await client.query("SELECT id FROM users WHERE email = 'admin@whosrunningusa.com'");
  if (adminCheck.rows.length > 0) {
    adminId = adminCheck.rows[0].id;
  } else {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('admin123!', 12);
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, username, user_type, first_name, last_name, email_verified, state)
       VALUES ('admin@whosrunningusa.com', $1, 'admin', 'admin', 'System', 'Admin', TRUE, 'DC')
       RETURNING id`,
      [hash]
    );
    adminId = rows[0].id;
  }

  // Create some sample voter users
  const voterIds = [];
  const sampleVoters = [
    { email: 'voter1@example.com', username: 'engaged_voter_1', first: 'Alex', last: 'Johnson', state: 'VA' },
    { email: 'voter2@example.com', username: 'engaged_voter_2', first: 'Jordan', last: 'Williams', state: 'OH' },
    { email: 'voter3@example.com', username: 'engaged_voter_3', first: 'Taylor', last: 'Chen', state: 'CA' },
    { email: 'voter4@example.com', username: 'engaged_voter_4', first: 'Morgan', last: 'Davis', state: 'TX' },
    { email: 'voter5@example.com', username: 'engaged_voter_5', first: 'Casey', last: 'Martinez', state: 'FL' },
  ];

  for (const v of sampleVoters) {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [v.email]);
    if (existing.rows.length > 0) {
      voterIds.push(existing.rows[0].id);
    } else {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('voter123!', 12);
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, username, user_type, first_name, last_name, email_verified, state)
         VALUES ($1, $2, $3, 'voter', $4, $5, TRUE, $6)
         RETURNING id`,
        [v.email, hash, v.username, v.first, v.last, v.state]
      );
      voterIds.push(rows[0].id);
    }
  }

  // Pick some high-profile candidates for engagement data
  const highProfile = [
    candidateMap['senator_NY_3'],   // Schumer
    candidateMap['senator_KY_2'],   // McConnell
    candidateMap['senator_VT_1'],   // Sanders
    candidateMap['senator_TX_1'],   // Cruz
    candidateMap['senator_MA_1'],   // Warren
    candidateMap['senator_FL_1'],   // Scott
    candidateMap['senator_PA_3'],   // Fetterman
    candidateMap['governor_CA'],    // Newsom
    candidateMap['governor_FL'],    // DeSantis
    candidateMap['governor_TX'],    // Abbott
  ].filter(Boolean);

  // Town Halls
  const townHallTemplates = [
    { title: 'Open Forum: Economy & Jobs', desc: 'Join us for an open discussion about economic policy and job creation in America.', format: 'video' },
    { title: 'Healthcare Town Hall', desc: 'A community discussion about healthcare access, costs, and coverage.', format: 'video' },
    { title: 'Ask Me Anything: Education Policy', desc: 'Submit your questions about education funding, school choice, and student debt.', format: 'text_ama' },
    { title: 'Climate & Energy Policy Discussion', desc: 'Let\'s discuss our approach to climate change, energy independence, and environmental protection.', format: 'text_ama' },
    { title: 'Immigration & Border Security Forum', desc: 'An open conversation about immigration reform, border security, and the pathway forward.', format: 'video' },
  ];

  for (let i = 0; i < highProfile.length && i < townHallTemplates.length; i++) {
    const candidate = highProfile[i];
    const template = townHallTemplates[i];
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + 7 + (i * 3));

    const existing = await client.query(
      'SELECT id FROM town_halls WHERE candidate_id = $1 AND title = $2',
      [candidate.id, template.title]
    );
    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO town_halls (candidate_id, title, description, format, scheduled_at, duration_minutes, status)
         VALUES ($1, $2, $3, $4, $5, 60, 'scheduled')`,
        [candidate.id, template.title, template.desc, template.format, scheduledAt]
      );
      stats.townHalls++;
    }
  }

  // Questions
  const questionTemplates = [
    'What is your plan to address the rising cost of living for middle-class families?',
    'How do you plan to improve healthcare access in rural communities?',
    'What is your position on federal student loan forgiveness programs?',
    'How will you work across the aisle to reduce political polarization?',
    'What specific steps will you take to address climate change?',
    'How do you plan to strengthen Social Security for future generations?',
    'What is your approach to reducing gun violence while respecting Second Amendment rights?',
    'How will you support small businesses in your state?',
    'What are your priorities for immigration reform?',
    'How do you plan to address the national debt?',
    'What is your position on term limits for members of Congress?',
    'How will you ensure affordable housing in growing communities?',
    'What steps will you take to improve public education?',
    'How do you plan to address the opioid and fentanyl crisis?',
    'What is your vision for America\'s role in the world?',
  ];

  for (let i = 0; i < highProfile.length; i++) {
    const candidate = highProfile[i];
    // 2-3 questions per high-profile candidate
    const numQuestions = 2 + (i % 2);
    for (let q = 0; q < numQuestions; q++) {
      const qIdx = (i * 3 + q) % questionTemplates.length;
      const voterId = voterIds[q % voterIds.length];

      try {
        const { rows } = await client.query(
          `INSERT INTO questions (candidate_id, asked_by_user_id, question_text, status, upvote_count)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [candidate.id, voterId, questionTemplates[qIdx], q === 0 ? 'answered' : 'pending', Math.floor(Math.random() * 50)]
        );
        if (rows.length > 0) {
          stats.questions++;
          // Add an answer for the first question
          if (q === 0) {
            await client.query(
              `INSERT INTO answers (question_id, candidate_id, answer_text)
               VALUES ($1, $2, $3)
               ON CONFLICT (question_id) DO NOTHING`,
              [rows[0].id, candidate.id, `Thank you for this important question. This is a priority for me and I'm committed to working on solutions that benefit all Americans. I believe we need a balanced approach that considers both the immediate needs and long-term implications of our policy decisions.`]
            );
          }
        }
      } catch (err) {
        // Skip duplicates
      }
    }
  }

  // Posts
  const postTemplates = [
    { title: 'Standing Up for Working Families', content: 'Today I introduced new legislation to support working families across America. This bill would expand access to affordable childcare and increase tax credits for middle-income households.', type: 'announcement' },
    { title: 'Bipartisan Infrastructure Progress', content: 'Proud to report that our bipartisan infrastructure bill is making real progress. New road and bridge projects are already underway in communities across our state.', type: 'update' },
    { title: 'My Position on Education Funding', content: 'Every child deserves access to quality education regardless of their zip code. Here\'s my comprehensive plan to increase federal education funding while ensuring local communities maintain control.', type: 'position' },
    { title: 'Town Hall Recap', content: 'Thank you to everyone who joined our town hall last week. We discussed healthcare, jobs, and the economy. Your voices matter and I\'m taking your concerns back to Washington.', type: 'update' },
    { title: 'Fighting for Veterans', content: 'Our veterans deserve the best care and support we can provide. I\'m working on legislation to expand VA healthcare access and reduce wait times for appointments.', type: 'announcement' },
  ];

  for (let i = 0; i < highProfile.length && i < postTemplates.length; i++) {
    const candidate = highProfile[i];
    const template = postTemplates[i];

    try {
      await client.query(
        `INSERT INTO posts (candidate_id, title, content, post_type, is_published)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [candidate.id, template.title, template.content, template.type]
      );
      stats.posts++;
    } catch (err) {
      // Skip duplicates
    }
  }

  // Promises for some candidates
  const issueCategories = await client.query('SELECT id, name FROM issue_categories LIMIT 6');
  const promiseTemplates = [
    'Reduce prescription drug costs by 30% within my first term',
    'Create 100,000 new clean energy jobs in our state',
    'Pass comprehensive immigration reform with bipartisan support',
    'Secure funding for rural broadband expansion to 95% coverage',
    'Reduce the federal deficit by eliminating wasteful spending',
    'Increase teacher pay to be competitive with private sector salaries',
  ];

  for (let i = 0; i < Math.min(highProfile.length, 6); i++) {
    const candidate = highProfile[i];
    const catId = issueCategories.rows[i % issueCategories.rows.length]?.id;
    if (!catId) continue;

    try {
      await client.query(
        `INSERT INTO promises (candidate_id, promise_text, category_id, status)
         VALUES ($1, $2, $3, 'pending')`,
        [candidate.id, promiseTemplates[i], catId]
      );
    } catch (err) {
      // Skip
    }
  }

  console.log(`  Seeded ${stats.townHalls} town halls, ${stats.questions} questions, ${stats.posts} posts`);
}

// =====================================================
// HELPERS
// =====================================================

function seededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 1000) / 1000;
}

function shuffleWithSeed(arr, seed) {
  const shuffled = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h) + seed.charCodeAt(i);
    h = h & h;
  }
  for (let i = shuffled.length - 1; i > 0; i--) {
    h = ((h << 5) - h) + i;
    h = h & h;
    const j = Math.abs(h) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// =====================================================
// RUN
// =====================================================

main();
