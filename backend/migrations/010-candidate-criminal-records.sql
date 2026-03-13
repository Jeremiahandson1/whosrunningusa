-- Migration 010: Candidate criminal records
-- Raw facts only, no severity ranking or visual indicators

CREATE TABLE IF NOT EXISTS candidate_criminal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    offense TEXT NOT NULL,
    year INTEGER,
    jurisdiction TEXT,
    jurisdiction_level VARCHAR(20) CHECK (jurisdiction_level IN ('county', 'state', 'federal')),
    disposition VARCHAR(30) NOT NULL CHECK (disposition IN ('convicted', 'acquitted', 'expunged', 'dismissed', 'pending', 'no_contest', 'deferred', 'pardoned')),
    sentence TEXT,
    source VARCHAR(20) NOT NULL CHECK (source IN ('self_reported', 'system_pulled')),
    candidate_statement TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    moderation_status VARCHAR(20) DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
    moderated_by UUID REFERENCES users(id),
    moderated_at TIMESTAMP,
    moderation_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_criminal_records_candidate ON candidate_criminal_records(candidate_id);
CREATE INDEX IF NOT EXISTS idx_criminal_records_moderation ON candidate_criminal_records(moderation_status) WHERE moderation_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_criminal_records_public ON candidate_criminal_records(candidate_id, is_public) WHERE is_public = TRUE;
