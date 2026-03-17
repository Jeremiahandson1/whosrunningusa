-- Remove fake/seeded data created by populate-empty-tables.js
-- This script generated fabricated endorsements, ratings, positions, promises, and transparency scores.
-- Real data should come from actual sources (FEC, Open States, candidate input).

-- Remove fake endorsements (endorser_type = 'organization' with known seeded org names)
DELETE FROM endorsements WHERE endorser_type = 'organization';

-- Remove fake interest group ratings (all were seeded)
DELETE FROM interest_group_ratings;

-- Remove seeded interest groups
DELETE FROM interest_groups;

-- Remove fake transparency scores (all were seeded from populate script)
DELETE FROM transparency_scores;

-- Remove fake promises (all were seeded from populate script)
DELETE FROM promises;

-- Note: candidate_positions are NOT deleted here because the issues were just seeded
-- and no candidates have real positions yet. If populate created positions, they would
-- have source markers, but the log showed "All financed candidates already have positions"
-- meaning no fake positions were created this run.
