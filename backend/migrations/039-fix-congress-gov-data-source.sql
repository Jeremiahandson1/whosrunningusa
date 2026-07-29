-- Migration 039: give congress_gov its own data_sources row.
--
-- Migration 007 created id 00000000-0000-0000-0000-000000000005 as
-- 'vote_smart', but sync-congress-gov.js claimed the SAME uuid with
-- ON CONFLICT (id) DO UPDATE SET name = 'congress_gov' — so every nightly
-- congress sync renamed the Vote Smart source, and the Vote Smart ensure-
-- insert (same id, ON CONFLICT (name)) then failed on the primary key.
-- Restore row ...0005 to vote_smart and put congress_gov at ...0008.
-- (sync_runs history attached to ...0005 is mixed and left as-is.)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM data_sources
    WHERE id = '00000000-0000-0000-0000-000000000005' AND name = 'congress_gov'
  ) THEN
    UPDATE data_sources SET
      name = 'vote_smart',
      display_name = 'Vote Smart',
      base_url = 'https://api.votesmart.org',
      api_key_env_var = 'VOTE_SMART_API_KEY'
    WHERE id = '00000000-0000-0000-0000-000000000005';
  END IF;

  INSERT INTO data_sources (id, name, display_name, source_type, base_url, api_key_env_var, sync_frequency_hours)
  VALUES (
    '00000000-0000-0000-0000-000000000008',
    'congress_gov',
    'Congress.gov',
    'api',
    'https://api.congress.gov/v3',
    'CONGRESS_GOV_API_KEY',
    168
  )
  ON CONFLICT (name) DO NOTHING;
END $$;
