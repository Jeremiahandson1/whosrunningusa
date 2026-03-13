-- Migration 015: Remove duplicate congress_gov profiles that weren't linked to FEC profiles
-- These were created because the congress sync couldn't match FEC name format
-- The next congress sync will properly link to FEC profiles using last name matching

DELETE FROM candidate_profiles
WHERE verification_source = 'congress_gov'
  AND id NOT IN (
    -- Keep any that have candidacies, questions, follows, or other references
    SELECT DISTINCT candidate_id FROM candidacies
    UNION SELECT DISTINCT candidate_id FROM candidate_positions
    UNION SELECT DISTINCT candidate_id FROM follows
  );
