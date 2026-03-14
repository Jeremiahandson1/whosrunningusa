-- Migration 018: Remove duplicate Open States profiles that have a matching FEC profile
-- FEC names: "LASTNAME, FIRSTNAME M." — Open States names: "Firstname Lastname"
-- Match by: last name from each format + same state

-- Helper: extract last name from Open States "Firstname Lastname" format
-- We use substring with reverse to get the last word
-- For FEC "LASTNAME, FIRSTNAME" format, split on comma and take first part

-- Step 1: Update FEC profiles with social media/contact from their Open States duplicates
WITH matches AS (
  SELECT fec.id AS fec_id, os.id AS os_id
  FROM candidate_profiles fec
  JOIN candidate_profiles os ON os.verification_source = 'open_states' AND os.id != fec.id
  WHERE fec.verification_source = 'fec'
    AND fec.fec_state IS NOT NULL
    AND fec.fec_state = os.fec_state
    AND LOWER(TRIM(SPLIT_PART(fec.display_name, ',', 1))) =
        LOWER(TRIM(SUBSTRING(os.display_name FROM '\S+$')))
    AND LENGTH(TRIM(SPLIT_PART(fec.display_name, ',', 1))) > 1
)
UPDATE candidate_profiles fec
SET
  twitter_handle = COALESCE(fec.twitter_handle, os.twitter_handle),
  facebook_handle = COALESCE(fec.facebook_handle, os.facebook_handle),
  campaign_website = COALESCE(fec.campaign_website, os.campaign_website),
  campaign_email = COALESCE(fec.campaign_email, os.campaign_email),
  campaign_phone = COALESCE(fec.campaign_phone, os.campaign_phone),
  official_title = COALESCE(fec.official_title, os.official_title),
  open_states_id = COALESCE(fec.open_states_id, os.open_states_id),
  updated_at = NOW()
FROM candidate_profiles os
JOIN matches m ON m.os_id = os.id
WHERE fec.id = m.fec_id;

-- Step 2: Move candidacies from Open States dupes to FEC profiles
WITH matches AS (
  SELECT fec.id AS fec_id, os.id AS os_id
  FROM candidate_profiles fec
  JOIN candidate_profiles os ON os.verification_source = 'open_states' AND os.id != fec.id
  WHERE fec.verification_source = 'fec'
    AND fec.fec_state IS NOT NULL
    AND fec.fec_state = os.fec_state
    AND LOWER(TRIM(SPLIT_PART(fec.display_name, ',', 1))) =
        LOWER(TRIM(SUBSTRING(os.display_name FROM '\S+$')))
    AND LENGTH(TRIM(SPLIT_PART(fec.display_name, ',', 1))) > 1
)
UPDATE candidacies SET candidate_id = m.fec_id
FROM matches m
WHERE candidacies.candidate_id = m.os_id
  AND NOT EXISTS (
    SELECT 1 FROM candidacies c2 WHERE c2.candidate_id = m.fec_id AND c2.race_id = candidacies.race_id
  );

-- Step 3: Move source links
WITH matches AS (
  SELECT fec.id AS fec_id, os.id AS os_id
  FROM candidate_profiles fec
  JOIN candidate_profiles os ON os.verification_source = 'open_states' AND os.id != fec.id
  WHERE fec.verification_source = 'fec'
    AND fec.fec_state IS NOT NULL
    AND fec.fec_state = os.fec_state
    AND LOWER(TRIM(SPLIT_PART(fec.display_name, ',', 1))) =
        LOWER(TRIM(SUBSTRING(os.display_name FROM '\S+$')))
    AND LENGTH(TRIM(SPLIT_PART(fec.display_name, ',', 1))) > 1
)
UPDATE candidate_source_links SET candidate_id = m.fec_id
FROM matches m
WHERE candidate_source_links.candidate_id = m.os_id
  AND NOT EXISTS (
    SELECT 1 FROM candidate_source_links c2
    WHERE c2.candidate_id = m.fec_id
      AND c2.data_source_id = candidate_source_links.data_source_id
      AND c2.external_id = candidate_source_links.external_id
  );

-- Step 4: Delete the matched Open States duplicates
WITH matches AS (
  SELECT fec.id AS fec_id, os.id AS os_id
  FROM candidate_profiles fec
  JOIN candidate_profiles os ON os.verification_source = 'open_states' AND os.id != fec.id
  WHERE fec.verification_source = 'fec'
    AND fec.fec_state IS NOT NULL
    AND fec.fec_state = os.fec_state
    AND LOWER(TRIM(SPLIT_PART(fec.display_name, ',', 1))) =
        LOWER(TRIM(SUBSTRING(os.display_name FROM '\S+$')))
    AND LENGTH(TRIM(SPLIT_PART(fec.display_name, ',', 1))) > 1
)
DELETE FROM candidate_profiles
WHERE id IN (SELECT os_id FROM matches);
