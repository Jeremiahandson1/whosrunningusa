-- Migration 020: Comprehensive candidate deduplication
-- Handles all duplicate patterns:
--   1. Case differences: "Baldwin, Tammy" vs "BALDWIN, TAMMY"
--   2. Middle name differences: "BARCA, PETER" vs "BARCA, PETER WILLIAM"
--   3. Name format differences: "Tammy Baldwin" vs "BALDWIN, TAMMY"
--   4. Suffix differences: "SMITH, JOHN" vs "SMITH, JOHN JR."
--
-- Strategy: normalize to "lastname, firstname" (lowercase, no middle/suffix),
-- group by normalized name + state, keep the profile with the most data.

-- Create a helper function for consistent name normalization
CREATE OR REPLACE FUNCTION normalize_candidate_name(name TEXT) RETURNS TEXT AS $$
DECLARE
  parts TEXT[];
  last_name TEXT;
  first_name TEXT;
  cleaned TEXT;
BEGIN
  IF name IS NULL THEN RETURN NULL; END IF;

  -- Remove common suffixes
  cleaned := REGEXP_REPLACE(LOWER(TRIM(name)), '\s+(jr\.?|sr\.?|ii|iii|iv|md|dr\.?|mr\.?|mrs\.?|ms\.?|esq\.?)$', '', 'gi');
  cleaned := TRIM(cleaned);

  IF cleaned LIKE '%,%' THEN
    -- Already "lastname, firstname [middle]" format
    last_name := TRIM(SPLIT_PART(cleaned, ',', 1));
    -- Take only first word after comma as first name (drop middle names)
    first_name := TRIM(SPLIT_PART(TRIM(SPLIT_PART(cleaned, ',', 2)), ' ', 1));
  ELSE
    -- "firstname [middle] lastname" format
    parts := STRING_TO_ARRAY(cleaned, ' ');
    IF ARRAY_LENGTH(parts, 1) >= 2 THEN
      last_name := parts[ARRAY_LENGTH(parts, 1)];
      first_name := parts[1];
    ELSE
      last_name := cleaned;
      first_name := '';
    END IF;
  END IF;

  RETURN last_name || ',' || first_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 1: Find all duplicate groups
-- Keep the profile that has the most useful data (prefer one with open_states_id, then fec_candidate_id)
CREATE TEMP TABLE dedup_keep AS
WITH ranked AS (
  SELECT
    id,
    display_name,
    fec_state,
    normalize_candidate_name(display_name) AS norm_name,
    ROW_NUMBER() OVER (
      PARTITION BY normalize_candidate_name(display_name), COALESCE(fec_state, '')
      ORDER BY
        -- Prefer profiles with more linked data
        (CASE WHEN open_states_id IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN congress_gov_id IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN twitter_handle IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN campaign_website IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN fec_candidate_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
        created_at ASC
    ) AS rn
  FROM candidate_profiles
  WHERE normalize_candidate_name(display_name) IS NOT NULL
    AND LENGTH(normalize_candidate_name(display_name)) > 2
)
SELECT
  norm_name,
  fec_state,
  id AS keep_id
FROM ranked
WHERE rn = 1;

CREATE TEMP TABLE dedup_remove AS
WITH ranked AS (
  SELECT
    id,
    normalize_candidate_name(display_name) AS norm_name,
    fec_state,
    ROW_NUMBER() OVER (
      PARTITION BY normalize_candidate_name(display_name), COALESCE(fec_state, '')
      ORDER BY
        (CASE WHEN open_states_id IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN congress_gov_id IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN twitter_handle IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN campaign_website IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN fec_candidate_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
        created_at ASC
    ) AS rn
  FROM candidate_profiles
  WHERE normalize_candidate_name(display_name) IS NOT NULL
    AND LENGTH(normalize_candidate_name(display_name)) > 2
)
SELECT r.id AS remove_id, dk.keep_id
FROM ranked r
JOIN dedup_keep dk ON dk.norm_name = r.norm_name AND COALESCE(dk.fec_state, '') = COALESCE(r.fec_state, '')
WHERE r.rn > 1;

-- Step 2: Merge data from duplicates into the keeper
UPDATE candidate_profiles keep SET
  twitter_handle = COALESCE(keep.twitter_handle, rm.twitter_handle),
  facebook_handle = COALESCE(keep.facebook_handle, rm.facebook_handle),
  instagram_handle = COALESCE(keep.instagram_handle, rm.instagram_handle),
  youtube_handle = COALESCE(keep.youtube_handle, rm.youtube_handle),
  campaign_website = COALESCE(keep.campaign_website, rm.campaign_website),
  campaign_email = COALESCE(keep.campaign_email, rm.campaign_email),
  campaign_phone = COALESCE(keep.campaign_phone, rm.campaign_phone),
  official_title = COALESCE(keep.official_title, rm.official_title),
  open_states_id = COALESCE(keep.open_states_id, rm.open_states_id),
  congress_gov_id = COALESCE(keep.congress_gov_id, rm.congress_gov_id),
  vote_smart_candidate_id = COALESCE(keep.vote_smart_candidate_id, rm.vote_smart_candidate_id),
  profile_photo_url = COALESCE(keep.profile_photo_url, rm.profile_photo_url),
  updated_at = NOW()
FROM candidate_profiles rm
JOIN dedup_remove dr ON dr.remove_id = rm.id
WHERE keep.id = dr.keep_id;

-- Step 3: Transfer candidacies
UPDATE candidacies SET candidate_id = dr.keep_id
FROM dedup_remove dr
WHERE candidacies.candidate_id = dr.remove_id
  AND NOT EXISTS (
    SELECT 1 FROM candidacies c2
    WHERE c2.candidate_id = dr.keep_id AND c2.race_id = candidacies.race_id
  );

-- Step 4: Transfer source links
UPDATE candidate_source_links SET candidate_id = dr.keep_id
FROM dedup_remove dr
WHERE candidate_source_links.candidate_id = dr.remove_id
  AND NOT EXISTS (
    SELECT 1 FROM candidate_source_links c2
    WHERE c2.candidate_id = dr.keep_id
      AND c2.data_source_id = candidate_source_links.data_source_id
      AND c2.external_id = candidate_source_links.external_id
  );

-- Step 5: Transfer education records
UPDATE candidate_education SET candidate_id = dr.keep_id
FROM dedup_remove dr
WHERE candidate_education.candidate_id = dr.remove_id;

-- Step 6: Transfer interest group ratings
UPDATE interest_group_ratings SET candidate_id = dr.keep_id
FROM dedup_remove dr
WHERE interest_group_ratings.candidate_id = dr.remove_id
  AND NOT EXISTS (
    SELECT 1 FROM interest_group_ratings r2
    WHERE r2.candidate_id = dr.keep_id
      AND r2.interest_group_id = interest_group_ratings.interest_group_id
      AND r2.time_span = interest_group_ratings.time_span
  );

-- Step 7: Delete orphaned references to removed profiles
DELETE FROM candidate_source_links WHERE candidate_id IN (SELECT remove_id FROM dedup_remove);
DELETE FROM candidacies WHERE candidate_id IN (SELECT remove_id FROM dedup_remove);
DELETE FROM candidate_education WHERE candidate_id IN (SELECT remove_id FROM dedup_remove);
DELETE FROM interest_group_ratings WHERE candidate_id IN (SELECT remove_id FROM dedup_remove);

-- Step 8: Delete the duplicate profiles
DELETE FROM candidate_profiles WHERE id IN (SELECT remove_id FROM dedup_remove);

-- Cleanup
DROP TABLE dedup_keep;
DROP TABLE dedup_remove;

-- Keep the function for future use in upsert matching
-- DROP FUNCTION normalize_candidate_name;
