-- Remove fake/seeded data created by populate-empty-tables.js
-- This script generated fabricated endorsements, ratings, positions, promises, and transparency scores.
-- Real data should come from actual sources (FEC, Open States, candidate input).

-- Remove fake endorsements (endorser_type = 'organization' with known seeded org names)
-- Only if endorser_type column exists (added by migration 007)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'endorsements' AND column_name = 'endorser_type') THEN
    DELETE FROM endorsements WHERE endorser_type = 'organization';
  END IF;
END $$;

-- Remove fake interest group ratings (all were seeded) — table from migration 007
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'interest_group_ratings') THEN
    DELETE FROM interest_group_ratings;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'interest_groups') THEN
    DELETE FROM interest_groups;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transparency_scores') THEN
    DELETE FROM transparency_scores;
  END IF;
END $$;

-- Remove fake promises (all were seeded from populate script)
DELETE FROM promises;

-- Remove fake candidate positions (all were seeded from populate script)
DELETE FROM candidate_positions;
