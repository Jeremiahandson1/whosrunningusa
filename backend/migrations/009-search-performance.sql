-- Migration 009: Search performance improvements for 20K+ candidates
-- Adds pre-computed FEC fields and full-text search index

-- Add pre-computed columns parsed from fec_candidate_id
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS fec_office_type VARCHAR(1);
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS fec_state VARCHAR(2);
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS fec_district VARCHAR(2);

-- Populate from existing fec_candidate_id values
-- FEC ID format: [office][cycle_start][state][district] e.g. H2TX13, S2CA00, P20000
UPDATE candidate_profiles
SET
  fec_office_type = SUBSTRING(fec_candidate_id FROM 1 FOR 1),
  fec_state = SUBSTRING(fec_candidate_id FROM 3 FOR 2),
  fec_district = CASE
    WHEN SUBSTRING(fec_candidate_id FROM 1 FOR 1) = 'H'
    THEN SUBSTRING(fec_candidate_id FROM 5 FOR 2)
    ELSE NULL
  END
WHERE fec_candidate_id IS NOT NULL
  AND fec_office_type IS NULL;

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_cp_fec_office_type ON candidate_profiles(fec_office_type) WHERE fec_office_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cp_fec_state ON candidate_profiles(fec_state) WHERE fec_state IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cp_fec_state_office ON candidate_profiles(fec_state, fec_office_type) WHERE fec_state IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cp_fec_state_district ON candidate_profiles(fec_state, fec_district) WHERE fec_district IS NOT NULL;

-- Install pg_trgm extension (for fuzzy name search) - may already exist
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text search on display_name
CREATE INDEX IF NOT EXISTS idx_cp_display_name_trgm ON candidate_profiles USING gin (display_name gin_trgm_ops);

-- Composite index for common candidate listing queries
CREATE INDEX IF NOT EXISTS idx_cp_active_shadow ON candidate_profiles(is_active, is_shadow_profile);

-- Index for party filtering
CREATE INDEX IF NOT EXISTS idx_cp_party ON candidate_profiles(party_affiliation) WHERE party_affiliation IS NOT NULL;
