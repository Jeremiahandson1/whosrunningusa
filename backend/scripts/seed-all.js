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
 *
 * Usage: node seed-all.js [--clean] [--only-structure]
 *   --clean            Drop and re-seed all seeded data
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
const ONLY_STRUCTURE = args.includes('--only-structure');

const stats = {
  issues: 0,
  elections: 0,
  offices: 0,
  races: 0,
  candidates: 0,
  candidacies: 0,
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
    }

    // Report
    console.log('\n=== Seed Complete ===');
    console.log(`  Issues:      ${stats.issues}`);
    console.log(`  Elections:   ${stats.elections}`);
    console.log(`  Offices:     ${stats.offices}`);
    console.log(`  Races:       ${stats.races}`);
    console.log(`  Candidates:  ${stats.candidates}`);
    console.log(`  Candidacies: ${stats.candidacies}`);
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
// RUN
// =====================================================

main();
