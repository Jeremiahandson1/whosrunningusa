-- Comprehensive purge of ALL fabricated/seeded data.
-- Only real data from actual sources (FEC, Congress, Open States, candidate input) should exist.
-- This is a safety net in case populate-empty-tables.js or seed-all.js was re-run.

-- Fake positions (generated from hardcoded partyStances maps)
DELETE FROM candidate_positions;

-- Fake endorsements (seeded from populate script)
DELETE FROM endorsements;

-- Fake interest group ratings + groups
DELETE FROM interest_group_ratings;
DELETE FROM interest_groups;

-- Fake transparency scores (entirely fabricated)
DELETE FROM transparency_scores;

-- Fake promises (seeded with template text)
DELETE FROM promises;

-- Fake town hall questions from populate script
-- (Real questions come from actual users, not seed scripts)
DELETE FROM town_hall_questions WHERE asked_by_user_id IN (
  SELECT id FROM users WHERE email LIKE 'voter%@example.com'
);

-- Fake posts from seed script
DELETE FROM posts WHERE title IN (
  'Standing Up for Working Families',
  'Bipartisan Infrastructure Progress',
  'My Position on Education Funding',
  'Town Hall Recap',
  'Fighting for Veterans'
);

-- Fake Q&A from seed script
DELETE FROM answers WHERE answer_text LIKE 'Thank you for this important question. This is a priority%';
DELETE FROM questions WHERE asked_by_user_id IN (
  SELECT id FROM users WHERE email LIKE 'voter%@example.com'
);

-- Fake town halls from seed script
DELETE FROM town_halls WHERE title IN (
  'Open Forum: Economy & Jobs',
  'Healthcare Town Hall',
  'Ask Me Anything: Education Policy',
  'Climate & Energy Policy Discussion',
  'Immigration & Border Security Forum'
);

-- Remove fake voter accounts created by seed script
DELETE FROM users WHERE email LIKE 'voter%@example.com' AND username LIKE 'engaged_voter_%';
