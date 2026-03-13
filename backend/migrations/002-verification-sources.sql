-- =============================================================================
-- VERIFICATION SOURCES MIGRATION
-- =============================================================================
-- Tracks where candidate data came from and when it was last verified

-- Data sources we pull from
CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,  -- 'fec', 'wisconsin_gab', 'california_sos', etc.
    display_name VARCHAR(200) NOT NULL,
    source_type VARCHAR(50) NOT NULL,   -- 'api', 'scraper', 'bulk_download', 'manual'
    base_url VARCHAR(500),
    api_key_env_var VARCHAR(100),       -- Environment variable name for API key
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP,
    last_sync_status VARCHAR(50),       -- 'success', 'partial', 'failed'
    last_sync_error TEXT,
    sync_frequency_hours INTEGER DEFAULT 24,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual sync runs
CREATE TABLE IF NOT EXISTS sync_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'running',  -- 'running', 'success', 'partial', 'failed'
    records_fetched INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_unchanged INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    error_log TEXT,
    metadata JSONB
);

-- Link candidates to their source records
CREATE TABLE IF NOT EXISTS candidate_source_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
    external_id VARCHAR(100) NOT NULL,   -- FEC ID, state filing ID, etc.
    external_data JSONB,                  -- Raw data from source
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verification_status VARCHAR(50) DEFAULT 'verified',  -- 'verified', 'stale', 'mismatch'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(data_source_id, external_id)
);

-- Link offices to their source records
CREATE TABLE IF NOT EXISTS office_source_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
    external_id VARCHAR(100) NOT NULL,
    external_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(data_source_id, external_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_candidate_source_links_candidate ON candidate_source_links(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_source_links_source ON candidate_source_links(data_source_id);
CREATE INDEX IF NOT EXISTS idx_candidate_source_links_external ON candidate_source_links(external_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_source ON sync_runs(data_source_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);

-- Seed initial data sources
INSERT INTO data_sources (id, name, display_name, source_type, base_url, api_key_env_var, sync_frequency_hours)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'fec', 'Federal Election Commission', 'api', 'https://api.open.fec.gov/v1', 'FEC_API_KEY', 24),
    ('00000000-0000-0000-0000-000000000002', 'wisconsin_elections', 'Wisconsin Elections Commission', 'scraper', 'https://elections.wi.gov', NULL, 168),
    ('00000000-0000-0000-0000-000000000003', 'ballotpedia', 'Ballotpedia', 'scraper', 'https://ballotpedia.org', NULL, 168)
ON CONFLICT (name) DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    base_url = EXCLUDED.base_url;

-- Add verification source columns to candidate_profiles if not exists
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS verification_source VARCHAR(100);
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS verification_external_id VARCHAR(100);
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS verification_last_checked TIMESTAMP;
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS fec_candidate_id VARCHAR(20);

SELECT 'Verification sources migration complete!' as status;