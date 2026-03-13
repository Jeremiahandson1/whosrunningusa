#!/usr/bin/env node

/**
 * Populate Empty Tables
 *
 * Fills tables that are currently empty or thin:
 *   - Town hall questions (for existing town halls)
 *   - Promises (for high-profile candidates)
 *   - Interest groups + ratings
 *   - Endorsements
 *   - Transparency scores
 *   - Positions for candidates that don't have them yet
 *
 * Usage: node scripts/populate-empty-tables.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

const stats = {
  townHallQuestions: 0,
  promises: 0,
  interestGroups: 0,
  interestGroupRatings: 0,
  endorsements: 0,
  transparencyScores: 0,
  positions: 0,
};

async function main() {
  console.log('=== Populating Empty Tables ===\n');

  await seedInterestGroups();
  await seedInterestGroupRatings();
  await seedEndorsements();
  await seedTransparencyScores();
  await seedTownHallQuestions();
  await seedMorePromises();
  await seedPositionsForUncoveredCandidates();

  console.log('\n=== Population Complete ===');
  for (const [key, val] of Object.entries(stats)) {
    console.log(`  ${key}: ${val}`);
  }

  await db.pool.end();
}

// =====================================================
// INTEREST GROUPS
// =====================================================

async function seedInterestGroups() {
  console.log('--- Interest Groups ---');

  const groups = [
    { name: 'National Rifle Association (NRA)', short_name: 'NRA', category: 'Gun Rights', political_lean: 'conservative', website: 'https://www.nra.org' },
    { name: 'Planned Parenthood Action Fund', short_name: 'PPAF', category: 'Reproductive Rights', political_lean: 'liberal', website: 'https://www.plannedparenthoodaction.org' },
    { name: 'League of Conservation Voters', short_name: 'LCV', category: 'Environment', political_lean: 'liberal', website: 'https://www.lcv.org' },
    { name: 'U.S. Chamber of Commerce', short_name: 'USCC', category: 'Business', political_lean: 'conservative', website: 'https://www.uschamber.com' },
    { name: 'American Civil Liberties Union (ACLU)', short_name: 'ACLU', category: 'Civil Liberties', political_lean: 'liberal', website: 'https://www.aclu.org' },
    { name: 'Heritage Action for America', short_name: 'Heritage Action', category: 'Conservative Policy', political_lean: 'conservative', website: 'https://heritageaction.com' },
    { name: 'Sierra Club', short_name: 'Sierra Club', category: 'Environment', political_lean: 'liberal', website: 'https://www.sierraclub.org' },
    { name: 'Americans for Prosperity', short_name: 'AFP', category: 'Economic Freedom', political_lean: 'conservative', website: 'https://americansforprosperity.org' },
    { name: 'AFL-CIO', short_name: 'AFL-CIO', category: 'Labor', political_lean: 'liberal', website: 'https://aflcio.org' },
    { name: 'National Education Association', short_name: 'NEA', category: 'Education', political_lean: 'liberal', website: 'https://www.nea.org' },
    { name: 'FreedomWorks', short_name: 'FreedomWorks', category: 'Limited Government', political_lean: 'conservative', website: 'https://www.freedomworks.org' },
    { name: 'NARAL Pro-Choice America', short_name: 'NARAL', category: 'Reproductive Rights', political_lean: 'liberal', website: 'https://www.prochoiceamerica.org' },
    { name: 'National Right to Life Committee', short_name: 'NRLC', category: 'Pro-Life', political_lean: 'conservative', website: 'https://www.nrlc.org' },
    { name: 'Human Rights Campaign', short_name: 'HRC', category: 'LGBTQ+ Rights', political_lean: 'liberal', website: 'https://www.hrc.org' },
    { name: 'Club for Growth', short_name: 'Club for Growth', category: 'Economic Freedom', political_lean: 'conservative', website: 'https://www.clubforgrowth.org' },
    { name: 'NAACP', short_name: 'NAACP', category: 'Civil Rights', political_lean: 'liberal', website: 'https://naacp.org' },
    { name: 'National Association of Manufacturers', short_name: 'NAM', category: 'Business', political_lean: 'conservative', website: 'https://www.nam.org' },
    { name: 'Everytown for Gun Safety', short_name: 'Everytown', category: 'Gun Control', political_lean: 'liberal', website: 'https://www.everytown.org' },
    { name: 'Americans for Tax Reform', short_name: 'ATR', category: 'Tax Policy', political_lean: 'conservative', website: 'https://www.atr.org' },
    { name: 'Center for American Progress Action Fund', short_name: 'CAP Action', category: 'Progressive Policy', political_lean: 'liberal', website: 'https://www.americanprogressaction.org' },
    { name: 'NumbersUSA', short_name: 'NumbersUSA', category: 'Immigration', political_lean: 'conservative', website: 'https://www.numbersusa.com' },
    { name: 'American Federation of Teachers', short_name: 'AFT', category: 'Education', political_lean: 'liberal', website: 'https://www.aft.org' },
    { name: 'National Federation of Independent Business', short_name: 'NFIB', category: 'Small Business', political_lean: 'conservative', website: 'https://www.nfib.com' },
    { name: 'Sunrise Movement', short_name: 'Sunrise', category: 'Climate', political_lean: 'liberal', website: 'https://www.sunrisemovement.org' },
    { name: 'Susan B. Anthony Pro-Life America', short_name: 'SBA', category: 'Pro-Life', political_lean: 'conservative', website: 'https://sbaprolife.org' },
  ];

  for (const g of groups) {
    try {
      await db.query(
        `INSERT INTO interest_groups (name, short_name, description, category, political_lean, website)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [g.name, g.short_name, `${g.name} - a leading ${g.category.toLowerCase()} organization.`, g.category, g.political_lean, g.website]
      );
      stats.interestGroups++;
    } catch (err) { /* skip */ }
  }

  console.log(`  Created ${stats.interestGroups} interest groups`);
}

// =====================================================
// INTEREST GROUP RATINGS
// =====================================================

async function seedInterestGroupRatings() {
  console.log('--- Interest Group Ratings ---');

  const groups = await db.query('SELECT id, name, political_lean FROM interest_groups');
  if (groups.rows.length === 0) return;

  // Get incumbents with party info
  const { rows: candidates } = await db.query(`
    SELECT cp.id, cp.display_name, cp.party_affiliation
    FROM candidate_profiles cp
    JOIN candidate_source_links csl ON cp.id = csl.candidate_id
      AND csl.data_source_id = '00000000-0000-0000-0000-000000000001'
    WHERE csl.external_data->>'incumbent_challenge' = 'I'
    LIMIT 600
  `);

  for (const candidate of candidates) {
    // Each candidate gets 3-6 ratings from relevant groups
    const numRatings = 3 + Math.floor(seededRandom(candidate.display_name + 'ratings') * 4);
    const shuffled = shuffleWithSeed(groups.rows, candidate.display_name);

    for (let i = 0; i < Math.min(numRatings, shuffled.length); i++) {
      const group = shuffled[i];
      // Score depends on party alignment
      const isAligned = (candidate.party_affiliation === 'Republican' && group.political_lean === 'conservative') ||
                       (candidate.party_affiliation === 'Democrat' && group.political_lean === 'liberal');
      const baseScore = isAligned ? 70 + Math.floor(seededRandom(candidate.display_name + group.name) * 30) :
                                    5 + Math.floor(seededRandom(candidate.display_name + group.name + 'x') * 30);

      try {
        await db.query(
          `INSERT INTO interest_group_ratings (candidate_id, interest_group_id, rating, rating_score, rating_name, time_span, rating_year, sig_name, sig_category, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'generated')
           ON CONFLICT (candidate_id, interest_group_id, time_span, rating_name) DO NOTHING`,
          [candidate.id, group.id, `${baseScore}%`, baseScore, `${group.name} Scorecard`, '2024', 2024, group.name, group.political_lean]
        );
        stats.interestGroupRatings++;
      } catch (err) { /* skip */ }
    }
  }

  console.log(`  Created ${stats.interestGroupRatings} interest group ratings`);
}

// =====================================================
// ENDORSEMENTS
// =====================================================

async function seedEndorsements() {
  console.log('--- Endorsements ---');

  // Real-world-ish endorsing organizations
  const endorsers = [
    { name: 'National Rifle Association', type: 'organization', category: 'Gun Rights', lean: 'conservative' },
    { name: 'Planned Parenthood Action Fund', type: 'organization', category: 'Reproductive Rights', lean: 'liberal' },
    { name: 'AFL-CIO', type: 'organization', category: 'Labor', lean: 'liberal' },
    { name: 'U.S. Chamber of Commerce', type: 'organization', category: 'Business', lean: 'conservative' },
    { name: 'Sierra Club', type: 'organization', category: 'Environment', lean: 'liberal' },
    { name: 'National Education Association', type: 'organization', category: 'Education', lean: 'liberal' },
    { name: 'Heritage Action', type: 'organization', category: 'Conservative Policy', lean: 'conservative' },
    { name: 'Human Rights Campaign', type: 'organization', category: 'LGBTQ+ Rights', lean: 'liberal' },
    { name: 'Club for Growth', type: 'organization', category: 'Fiscal', lean: 'conservative' },
    { name: 'NAACP', type: 'organization', category: 'Civil Rights', lean: 'liberal' },
    { name: 'Americans for Prosperity', type: 'organization', category: 'Economic Freedom', lean: 'conservative' },
    { name: 'League of Conservation Voters', type: 'organization', category: 'Environment', lean: 'liberal' },
    { name: 'National Right to Life', type: 'organization', category: 'Pro-Life', lean: 'conservative' },
    { name: 'Everytown for Gun Safety', type: 'organization', category: 'Gun Control', lean: 'liberal' },
    { name: 'Susan B. Anthony Pro-Life America', type: 'organization', category: 'Pro-Life', lean: 'conservative' },
  ];

  const { rows: candidates } = await db.query(`
    SELECT cp.id, cp.display_name, cp.party_affiliation
    FROM candidate_profiles cp
    JOIN candidate_source_links csl ON cp.id = csl.candidate_id
      AND csl.data_source_id = '00000000-0000-0000-0000-000000000001'
    WHERE csl.external_data->>'incumbent_challenge' = 'I'
    LIMIT 600
  `);

  for (const candidate of candidates) {
    const numEndorsements = 2 + Math.floor(seededRandom(candidate.display_name + 'endorse') * 4);
    const shuffled = shuffleWithSeed(endorsers, candidate.display_name + 'end');

    for (let i = 0; i < Math.min(numEndorsements, shuffled.length); i++) {
      const e = shuffled[i];
      // Only endorse if party-aligned
      const isAligned = (candidate.party_affiliation === 'Republican' && e.lean === 'conservative') ||
                       (candidate.party_affiliation === 'Democrat' && e.lean === 'liberal');
      if (!isAligned) continue;

      try {
        await db.query(
          `INSERT INTO endorsements (candidate_id, endorser_name, endorser_type, endorser_description, endorsement_date, election_cycle, endorser_category, endorser_lean, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'generated')
           ON CONFLICT DO NOTHING`,
          [candidate.id, e.name, e.type, `Leading ${e.category.toLowerCase()} organization`, '2024-06-15', '2024', e.category, e.lean]
        );
        stats.endorsements++;
      } catch (err) { /* skip */ }
    }
  }

  console.log(`  Created ${stats.endorsements} endorsements`);
}

// =====================================================
// TRANSPARENCY SCORES
// =====================================================

async function seedTransparencyScores() {
  console.log('--- Transparency Scores ---');

  // Get all incumbents that have finance data + voting records
  const { rows: candidates } = await db.query(`
    SELECT cp.id, cp.display_name, cp.party_affiliation,
      (SELECT COUNT(*) FROM candidate_positions WHERE candidate_id = cp.id) as position_count,
      (SELECT COUNT(*) FROM voting_records WHERE candidate_id = cp.id) as vote_count,
      (SELECT total_raised FROM campaign_finance_summaries WHERE candidate_id = cp.id LIMIT 1) as total_raised
    FROM candidate_profiles cp
    JOIN campaign_finance_summaries cfs ON cp.id = cfs.candidate_id
    LIMIT 700
  `);

  for (const c of candidates) {
    const hasPositions = parseInt(c.position_count) > 0;
    const hasVotes = parseInt(c.vote_count) > 0;
    const hasFinance = parseFloat(c.total_raised) > 0;

    // Calculate component scores
    const positionScore = hasPositions ? 60 + Math.floor(seededRandom(c.display_name + 'pos') * 40) : 20 + Math.floor(seededRandom(c.display_name + 'pos2') * 30);
    const votingScore = hasVotes ? 65 + Math.floor(seededRandom(c.display_name + 'vote') * 35) : 30 + Math.floor(seededRandom(c.display_name + 'vote2') * 20);
    const financeScore = hasFinance ? 50 + Math.floor(seededRandom(c.display_name + 'fin') * 50) : 15;
    const consistencyScore = hasPositions && hasVotes ? 55 + Math.floor(seededRandom(c.display_name + 'con') * 45) : 40;
    const overallScore = (positionScore * 0.3 + votingScore * 0.3 + financeScore * 0.2 + consistencyScore * 0.2);

    try {
      await db.query(
        `INSERT INTO transparency_scores (candidate_id, overall_score, voting_transparency, position_transparency, finance_transparency, consistency_score, calculation_date)
         VALUES ($1, $2, $3, $4, $5, $6, '2024-12-01')
         ON CONFLICT (candidate_id, calculation_date) DO NOTHING`,
        [c.id, overallScore.toFixed(2), votingScore, positionScore, financeScore, consistencyScore]
      );
      stats.transparencyScores++;
    } catch (err) { /* skip */ }
  }

  console.log(`  Created ${stats.transparencyScores} transparency scores`);
}

// =====================================================
// TOWN HALL QUESTIONS
// =====================================================

async function seedTownHallQuestions() {
  console.log('--- Town Hall Questions ---');

  const { rows: townHalls } = await db.query('SELECT id, candidate_id FROM town_halls');
  if (townHalls.length === 0) {
    console.log('  No town halls found');
    return;
  }

  // Get voter user IDs
  const { rows: voters } = await db.query("SELECT id FROM users WHERE user_type = 'voter' LIMIT 5");
  if (voters.length === 0) {
    console.log('  No voter users found');
    return;
  }

  const questions = [
    'What is your plan to address the rising cost of living for middle-class families?',
    'How do you plan to improve healthcare access in rural communities?',
    'What is your position on federal student loan forgiveness programs?',
    'How will you work across the aisle to reduce political polarization?',
    'What specific steps will you take to address climate change?',
    'How do you plan to strengthen Social Security for future generations?',
    'What is your approach to reducing gun violence while respecting the Second Amendment?',
    'How will you support small businesses in your district?',
    'What are your priorities for immigration reform?',
    'How do you plan to address the national debt?',
    'What is your position on term limits for members of Congress?',
    'How will you ensure affordable housing in growing communities?',
    'What steps will you take to improve public education?',
    'How do you plan to address the opioid and fentanyl crisis?',
    'What is your vision for America\'s role in the world?',
    'Do you support expanding broadband access to underserved areas?',
    'What is your plan for protecting voting rights?',
    'How will you address income inequality in America?',
    'What is your stance on cryptocurrency regulation?',
    'How will you protect Social Security and Medicare from cuts?',
  ];

  for (const th of townHalls) {
    const numQuestions = 5 + Math.floor(seededRandom(th.id) * 8);
    for (let i = 0; i < numQuestions; i++) {
      const qIdx = Math.floor(seededRandom(th.id + String(i)) * questions.length);
      const voterId = voters[i % voters.length].id;
      const upvotes = Math.floor(seededRandom(th.id + String(i) + 'up') * 50);

      try {
        await db.query(
          `INSERT INTO town_hall_questions (town_hall_id, asked_by_user_id, question_text, is_presubmitted, was_answered, upvote_count)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [th.id, voterId, questions[qIdx], i < 3, i === 0, upvotes]
        );
        stats.townHallQuestions++;
      } catch (err) { /* skip */ }
    }
  }

  console.log(`  Created ${stats.townHallQuestions} town hall questions`);
}

// =====================================================
// MORE PROMISES
// =====================================================

async function seedMorePromises() {
  console.log('--- Promises ---');

  const { rows: categories } = await db.query('SELECT id, name FROM issue_categories');
  if (categories.length === 0) return;

  const catMap = {};
  for (const c of categories) catMap[c.name] = c.id;

  const promisesByCategory = {
    'Economy & Jobs': [
      'Create 500,000 new manufacturing jobs by investing in domestic production',
      'Cut taxes for families earning under $100,000 per year',
      'Raise the federal minimum wage to $15 per hour',
      'Reduce small business regulations to spur economic growth',
      'Bring back American supply chains from overseas',
    ],
    'Healthcare': [
      'Lower prescription drug costs by allowing Medicare to negotiate prices',
      'Protect coverage for pre-existing conditions',
      'Expand access to mental health services in underserved communities',
      'Cap insulin costs at $35 per month for all Americans',
      'Increase funding for rural hospitals and clinics',
    ],
    'Education': [
      'Make community college tuition-free for all Americans',
      'Increase teacher salaries to be competitive with the private sector',
      'Expand school choice and charter school options',
      'Forgive up to $20,000 in student loan debt for public servants',
      'Fund universal pre-K for all 3 and 4 year olds',
    ],
    'Environment & Energy': [
      'Achieve 100% clean electricity by 2035',
      'Rejoin the Paris Climate Agreement and meet emissions targets',
      'Invest $500 billion in renewable energy infrastructure',
      'Protect public lands from drilling and mining',
      'Create a civilian climate corps for environmental restoration',
    ],
    'Public Safety & Justice': [
      'Fund 100,000 new police officers for community policing',
      'End cash bail for nonviolent offenses',
      'Pass universal background checks for all gun purchases',
      'Reform qualified immunity for law enforcement',
      'Invest in mental health crisis response teams',
    ],
    'Immigration': [
      'Secure the border with modern technology and increased personnel',
      'Create a pathway to citizenship for DACA recipients',
      'Reform the legal immigration system to reduce backlogs',
      'End family separation at the border',
      'Implement mandatory E-Verify for all employers',
    ],
    'Government Reform': [
      'Pass a constitutional amendment for congressional term limits',
      'Ban stock trading by members of Congress',
      'Require all campaign donations over $200 to be disclosed within 24 hours',
      'Implement ranked-choice voting for federal elections',
      'Reduce the federal deficit by 25% within 4 years',
    ],
    'National Security & Foreign Policy': [
      'Maintain strong support for NATO allies',
      'Invest in cybersecurity to protect critical infrastructure',
      'Bring our troops home from endless wars',
      'Strengthen alliances in the Indo-Pacific region',
      'Increase military pay and benefits for service members',
    ],
  };

  // Get top fundraising incumbents
  const { rows: candidates } = await db.query(`
    SELECT cp.id, cp.display_name, cp.party_affiliation
    FROM candidate_profiles cp
    JOIN campaign_finance_summaries cfs ON cp.id = cfs.candidate_id
    ORDER BY cfs.total_raised DESC
    LIMIT 200
  `);

  for (const candidate of candidates) {
    const numPromises = 2 + Math.floor(seededRandom(candidate.display_name + 'prom') * 4);
    const catNames = Object.keys(promisesByCategory);
    const shuffledCats = shuffleWithSeed(catNames, candidate.display_name + 'promcat');

    for (let i = 0; i < numPromises; i++) {
      const catName = shuffledCats[i % shuffledCats.length];
      const catId = catMap[catName];
      if (!catId) continue;

      const promises = promisesByCategory[catName];
      const promiseIdx = Math.floor(seededRandom(candidate.display_name + catName) * promises.length);
      const statuses = ['pending', 'pending', 'pending', 'in_progress', 'in_progress', 'kept'];
      const status = statuses[Math.floor(seededRandom(candidate.display_name + String(i)) * statuses.length)];

      try {
        await db.query(
          `INSERT INTO promises (candidate_id, promise_text, category_id, status)
           VALUES ($1, $2, $3, $4)`,
          [candidate.id, promises[promiseIdx], catId, status]
        );
        stats.promises++;
      } catch (err) { /* skip */ }
    }
  }

  console.log(`  Created ${stats.promises} promises`);
}

// =====================================================
// POSITIONS FOR UNCOVERED CANDIDATES
// =====================================================

async function seedPositionsForUncoveredCandidates() {
  console.log('--- Positions for uncovered candidates ---');

  const { rows: issues } = await db.query('SELECT id, name FROM issues');
  const issueMap = {};
  for (const i of issues) issueMap[i.name] = i.id;

  // Get candidates with finance data but no positions
  const { rows: candidates } = await db.query(`
    SELECT cp.id, cp.display_name, cp.party_affiliation
    FROM candidate_profiles cp
    JOIN campaign_finance_summaries cfs ON cp.id = cfs.candidate_id
    WHERE NOT EXISTS (
      SELECT 1 FROM candidate_positions WHERE candidate_id = cp.id
    )
    LIMIT 700
  `);

  if (candidates.length === 0) {
    console.log('  All financed candidates already have positions');
    return;
  }

  const partyStances = {
    'Republican': {
      'Federal Minimum Wage Increase': 'oppose',
      'Tax Reform': 'support',
      'Labor Union Rights': 'oppose',
      'Student Loan Forgiveness': 'oppose',
      'National Debt Reduction': 'support',
      'School Choice & Vouchers': 'support',
      'Public Health Insurance Option': 'oppose',
      'Abortion Access': 'oppose',
      'Carbon Emissions Reduction': 'oppose',
      'Renewable Energy Investment': 'complicated',
      'Fossil Fuel Production': 'support',
      'Gun Background Checks': 'complicated',
      'Assault Weapons Ban': 'oppose',
      'Police Reform': 'oppose',
      'Border Security': 'support',
      'Pathway to Citizenship': 'oppose',
      'Congressional Term Limits': 'support',
      'Campaign Finance Reform': 'complicated',
      'Defense Spending': 'support',
      'Broadband Internet Access': 'support',
    },
    'Democrat': {
      'Federal Minimum Wage Increase': 'support',
      'Tax Reform': 'complicated',
      'Labor Union Rights': 'support',
      'Student Loan Forgiveness': 'support',
      'National Debt Reduction': 'complicated',
      'School Choice & Vouchers': 'oppose',
      'Public Health Insurance Option': 'support',
      'Abortion Access': 'support',
      'Carbon Emissions Reduction': 'support',
      'Renewable Energy Investment': 'support',
      'Fossil Fuel Production': 'oppose',
      'Gun Background Checks': 'support',
      'Assault Weapons Ban': 'support',
      'Police Reform': 'support',
      'Border Security': 'complicated',
      'Pathway to Citizenship': 'support',
      'Congressional Term Limits': 'complicated',
      'Campaign Finance Reform': 'support',
      'Defense Spending': 'complicated',
      'Broadband Internet Access': 'support',
    },
  };

  for (const candidate of candidates) {
    const party = candidate.party_affiliation || 'Independent';
    const stances = partyStances[party] || partyStances['Democrat'];
    const stanceIssues = Object.keys(stances).filter(name => issueMap[name]);

    const numPositions = 8 + Math.floor(seededRandom(candidate.display_name) * 8);
    const shuffled = shuffleWithSeed(stanceIssues, candidate.display_name);
    const selected = shuffled.slice(0, Math.min(numPositions, shuffled.length));

    for (let i = 0; i < selected.length; i++) {
      const issueName = selected[i];
      const issueId = issueMap[issueName];
      const stance = stances[issueName] || 'complicated';

      try {
        await db.query(
          `INSERT INTO candidate_positions (candidate_id, issue_id, stance, priority_rank)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (candidate_id, issue_id) DO NOTHING`,
          [candidate.id, issueId, stance, i < 5 ? i + 1 : null]
        );
        stats.positions++;
      } catch (err) { /* skip */ }
    }
  }

  console.log(`  Created ${stats.positions} positions for ${candidates.length} candidates`);
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

main().catch(e => { console.error(e); process.exit(1); });
