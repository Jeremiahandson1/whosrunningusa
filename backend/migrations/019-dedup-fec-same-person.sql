-- Migration 019: Merge FEC duplicate profiles for the same person
-- The FEC assigns different candidate IDs when someone runs for a different office
-- (e.g. House vs Senate) or in different cycles with a different party.
-- We keep the profile with the most recent FEC ID and merge the others into it.

-- Step 1: Identify duplicates — same display_name and fec_state, different id
-- Keep the one with the "newest" fec_candidate_id (highest cycle digit)
WITH dupes AS (
  SELECT
    display_name,
    fec_state,
    COUNT(*) AS cnt,
    -- Keep the profile with the most recent FEC candidate ID
    (ARRAY_AGG(id ORDER BY fec_candidate_id DESC))[1] AS keep_id,
    ARRAY_AGG(id ORDER BY fec_candidate_id DESC) AS all_ids
  FROM candidate_profiles
  WHERE verification_source = 'fec'
    AND fec_state IS NOT NULL
    AND display_name IS NOT NULL
  GROUP BY LOWER(display_name), display_name, fec_state
  HAVING COUNT(*) > 1
),
-- Flatten to keep_id + remove_id pairs
removals AS (
  SELECT keep_id, UNNEST(all_ids[2:]) AS remove_id
  FROM dupes
)
-- Step 2: Transfer candidacies
UPDATE candidacies SET candidate_id = r.keep_id
FROM removals r
WHERE candidacies.candidate_id = r.remove_id
  AND NOT EXISTS (
    SELECT 1 FROM candidacies c2
    WHERE c2.candidate_id = r.keep_id AND c2.race_id = candidacies.race_id
  );

-- Step 3: Transfer source links
WITH dupes AS (
  SELECT
    display_name,
    fec_state,
    (ARRAY_AGG(id ORDER BY fec_candidate_id DESC))[1] AS keep_id,
    ARRAY_AGG(id ORDER BY fec_candidate_id DESC) AS all_ids
  FROM candidate_profiles
  WHERE verification_source = 'fec'
    AND fec_state IS NOT NULL
    AND display_name IS NOT NULL
  GROUP BY LOWER(display_name), display_name, fec_state
  HAVING COUNT(*) > 1
),
removals AS (
  SELECT keep_id, UNNEST(all_ids[2:]) AS remove_id
  FROM dupes
)
UPDATE candidate_source_links SET candidate_id = r.keep_id
FROM removals r
WHERE candidate_source_links.candidate_id = r.remove_id
  AND NOT EXISTS (
    SELECT 1 FROM candidate_source_links c2
    WHERE c2.candidate_id = r.keep_id
      AND c2.data_source_id = candidate_source_links.data_source_id
      AND c2.external_id = candidate_source_links.external_id
  );

-- Step 4: Transfer any enrichment data (education, experience, etc.)
WITH dupes AS (
  SELECT
    display_name,
    fec_state,
    (ARRAY_AGG(id ORDER BY fec_candidate_id DESC))[1] AS keep_id,
    ARRAY_AGG(id ORDER BY fec_candidate_id DESC) AS all_ids
  FROM candidate_profiles
  WHERE verification_source = 'fec'
    AND fec_state IS NOT NULL
    AND display_name IS NOT NULL
  GROUP BY LOWER(display_name), display_name, fec_state
  HAVING COUNT(*) > 1
),
removals AS (
  SELECT keep_id, UNNEST(all_ids[2:]) AS remove_id
  FROM dupes
)
UPDATE candidate_education SET candidate_id = r.keep_id
FROM removals r
WHERE candidate_education.candidate_id = r.remove_id;

-- Step 5: Delete duplicate profiles (keep the one with the newest FEC ID)
WITH dupes AS (
  SELECT
    display_name,
    fec_state,
    (ARRAY_AGG(id ORDER BY fec_candidate_id DESC))[1] AS keep_id,
    ARRAY_AGG(id ORDER BY fec_candidate_id DESC) AS all_ids
  FROM candidate_profiles
  WHERE verification_source = 'fec'
    AND fec_state IS NOT NULL
    AND display_name IS NOT NULL
  GROUP BY LOWER(display_name), display_name, fec_state
  HAVING COUNT(*) > 1
),
removals AS (
  SELECT UNNEST(all_ids[2:]) AS remove_id
  FROM dupes
)
DELETE FROM candidate_profiles
WHERE id IN (SELECT remove_id FROM removals);
