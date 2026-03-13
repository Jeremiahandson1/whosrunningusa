-- =============================================================================
-- OPEN STATES DATA SOURCE MIGRATION
-- =============================================================================
-- Adds Open States as a data source for state legislator data

-- Add Open States data source
INSERT INTO data_sources (id, name, display_name, source_type, base_url, api_key_env_var, sync_frequency_hours)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'open_states',
  'Open States / Plural Policy',
  'api',
  'https://v3.openstates.org',
  'OPEN_STATES_API_KEY',
  168  -- Weekly sync
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  base_url = EXCLUDED.base_url,
  api_key_env_var = EXCLUDED.api_key_env_var;

-- Add open_states_id column to candidate_profiles if not exists
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS open_states_id VARCHAR(100);

-- Create index for Open States lookups
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_open_states ON candidate_profiles(open_states_id);

-- Add OCD Division ID column for geographic matching
ALTER TABLE offices ADD COLUMN IF NOT EXISTS ocd_division_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_offices_ocd_division ON offices(ocd_division_id);

SELECT 'Open States migration complete!' as status;