-- Migration 028: Platform Features
-- Adds tables for petitions, candidate self-registration, plain language vote explanations,
-- post-service employment tracking, trading activity monitoring, transparency compliance,
-- and campaign finance source mapping

-- ============================================================
-- PETITIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS petitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(300) NOT NULL,
    description TEXT NOT NULL,
    plain_language_summary TEXT,
    target_type VARCHAR(50) CHECK (target_type IN ('federal', 'state', 'local', 'agency', 'general')),
    target_entity VARCHAR(300),
    target_politician_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
    state VARCHAR(2),
    required_signatures INTEGER NOT NULL DEFAULT 1000,
    current_signatures INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) CHECK (status IN ('draft', 'active', 'delivered', 'closed', 'expired')) DEFAULT 'active',
    identity_verification_required BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deadline DATE,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_petitions_status ON petitions(status);
CREATE INDEX idx_petitions_state ON petitions(state);
CREATE INDEX idx_petitions_target ON petitions(target_type);
CREATE INDEX idx_petitions_created ON petitions(created_at DESC);
CREATE INDEX idx_petitions_signatures ON petitions(current_signatures DESC);

CREATE TABLE IF NOT EXISTS petition_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    petition_id UUID NOT NULL REFERENCES petitions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verified BOOLEAN DEFAULT FALSE,
    verification_method VARCHAR(50),
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(petition_id, user_id)
);

CREATE INDEX idx_petition_signatures_petition ON petition_signatures(petition_id);
CREATE INDEX idx_petition_signatures_user ON petition_signatures(user_id);

CREATE TABLE IF NOT EXISTS petition_volunteers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    petition_id UUID NOT NULL REFERENCES petitions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) CHECK (role IN ('coordinator', 'canvasser', 'social_media', 'general')) DEFAULT 'general',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(petition_id, user_id)
);

CREATE INDEX idx_petition_volunteers_petition ON petition_volunteers(petition_id);

-- State petition requirements (signature thresholds, deadlines, rules)
CREATE TABLE IF NOT EXISTS petition_state_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state VARCHAR(2) NOT NULL,
    petition_type VARCHAR(50) NOT NULL,
    required_signatures INTEGER,
    deadline_description TEXT,
    additional_rules TEXT,
    source_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(state, petition_type)
);

-- ============================================================
-- CANDIDATE SELF-REGISTRATION / CLAIM
-- ============================================================

CREATE TABLE IF NOT EXISTS candidate_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    candidate_profile_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
    claim_type VARCHAR(30) CHECK (claim_type IN ('existing', 'new')) DEFAULT 'existing',
    verification_status VARCHAR(30) CHECK (verification_status IN ('pending', 'approved', 'rejected', 'needs_info')) DEFAULT 'pending',
    verification_documents TEXT[],
    fec_candidate_id VARCHAR(20),
    official_name VARCHAR(300),
    office_sought VARCHAR(200),
    state VARCHAR(2),
    party VARCHAR(100),
    campaign_url TEXT,
    rejection_reason TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_candidate_claims_user ON candidate_claims(user_id);
CREATE INDEX idx_candidate_claims_status ON candidate_claims(verification_status);
CREATE INDEX idx_candidate_claims_profile ON candidate_claims(candidate_profile_id);

-- ============================================================
-- PLAIN LANGUAGE VOTE EXPLANATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS vote_explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vote_event_id UUID REFERENCES vote_events(id) ON DELETE CASCADE,
    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
    plain_language_title VARCHAR(300),
    plain_language_summary TEXT NOT NULL,
    what_it_means TEXT,
    who_it_affects TEXT,
    reading_level DECIMAL(3,1) DEFAULT 8.0,
    generated_by VARCHAR(50) DEFAULT 'ai',
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vote_explanations_vote ON vote_explanations(vote_event_id);
CREATE INDEX idx_vote_explanations_bill ON vote_explanations(bill_id);
CREATE UNIQUE INDEX idx_vote_explanations_unique_vote ON vote_explanations(vote_event_id) WHERE vote_event_id IS NOT NULL;
CREATE UNIQUE INDEX idx_vote_explanations_unique_bill ON vote_explanations(bill_id) WHERE bill_id IS NOT NULL;

-- ============================================================
-- POST-SERVICE EMPLOYMENT (REVOLVING DOOR)
-- ============================================================

CREATE TABLE IF NOT EXISTS post_service_employment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    employer VARCHAR(300) NOT NULL,
    position_title VARCHAR(300),
    industry VARCHAR(200),
    start_date DATE,
    end_date DATE,
    left_office_date DATE,
    compensation_range VARCHAR(50),
    is_lobbying BOOLEAN DEFAULT FALSE,
    is_board_position BOOLEAN DEFAULT FALSE,
    source_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_post_service_politician ON post_service_employment(politician_id);
CREATE INDEX idx_post_service_industry ON post_service_employment(industry);
CREATE INDEX idx_post_service_lobbying ON post_service_employment(is_lobbying) WHERE is_lobbying = TRUE;

CREATE TABLE IF NOT EXISTS revolving_door_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id UUID NOT NULL REFERENCES post_service_employment(id) ON DELETE CASCADE,
    flag_type VARCHAR(50) CHECK (flag_type IN ('cooling_period_violation', 'industry_conflict', 'lobbying_restriction', 'committee_overlap')) NOT NULL,
    description TEXT NOT NULL,
    severity INTEGER CHECK (severity BETWEEN 1 AND 10) DEFAULT 5,
    violation_start DATE,
    violation_end DATE,
    related_committee VARCHAR(200),
    related_industry VARCHAR(200),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revolving_flags_employment ON revolving_door_flags(employment_id);
CREATE INDEX idx_revolving_flags_type ON revolving_door_flags(flag_type);
CREATE INDEX idx_revolving_flags_severity ON revolving_door_flags(severity DESC);

-- ============================================================
-- TRADING ACTIVITY MONITOR
-- ============================================================

CREATE TABLE IF NOT EXISTS official_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    filer_name VARCHAR(300),
    ticker VARCHAR(20),
    asset_name VARCHAR(300),
    trade_type VARCHAR(20) CHECK (trade_type IN ('purchase', 'sale', 'exchange')) NOT NULL,
    amount_range_low DECIMAL(14,2),
    amount_range_high DECIMAL(14,2),
    trade_date DATE NOT NULL,
    disclosure_date DATE,
    days_to_disclose INTEGER,
    committee_assignments TEXT[],
    source_url TEXT,
    source VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_official_trades_politician ON official_trades(politician_id);
CREATE INDEX idx_official_trades_ticker ON official_trades(ticker);
CREATE INDEX idx_official_trades_date ON official_trades(trade_date DESC);
CREATE INDEX idx_official_trades_disclosure ON official_trades(disclosure_date DESC);
CREATE INDEX idx_official_trades_type ON official_trades(trade_type);

CREATE TABLE IF NOT EXISTS trade_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID NOT NULL REFERENCES official_trades(id) ON DELETE CASCADE,
    flag_type VARCHAR(50) CHECK (flag_type IN ('timing_suspicious', 'committee_relevant', 'volume_unusual', 'pre_announcement', 'late_disclosure', 'pattern_detected')) NOT NULL,
    description TEXT NOT NULL,
    severity INTEGER CHECK (severity BETWEEN 1 AND 10) DEFAULT 5,
    related_committee VARCHAR(200),
    related_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
    related_event_description TEXT,
    event_date DATE,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trade_flags_trade ON trade_flags(trade_id);
CREATE INDEX idx_trade_flags_type ON trade_flags(flag_type);
CREATE INDEX idx_trade_flags_severity ON trade_flags(severity DESC);

-- ============================================================
-- BODY CAMERA & TRANSPARENCY COMPLIANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS transparency_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction VARCHAR(200) NOT NULL,
    jurisdiction_type VARCHAR(30) CHECK (jurisdiction_type IN ('federal', 'state', 'county', 'city')) NOT NULL,
    state VARCHAR(2),
    requirement_type VARCHAR(50) CHECK (requirement_type IN ('body_camera', 'foia_response', 'meeting_recording', 'financial_disclosure', 'lobbying_disclosure', 'campaign_finance')) NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    enacted_date DATE,
    effective_date DATE,
    statute_reference VARCHAR(200),
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transparency_reqs_jurisdiction ON transparency_requirements(jurisdiction_type, state);
CREATE INDEX idx_transparency_reqs_type ON transparency_requirements(requirement_type);

CREATE TABLE IF NOT EXISTS compliance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    agency_name VARCHAR(300),
    requirement_id UUID NOT NULL REFERENCES transparency_requirements(id) ON DELETE CASCADE,
    compliance_status VARCHAR(30) CHECK (compliance_status IN ('compliant', 'partial', 'non_compliant', 'unknown', 'exempt')) DEFAULT 'unknown',
    compliance_score INTEGER CHECK (compliance_score BETWEEN 0 AND 100),
    last_checked DATE,
    evidence_url TEXT,
    notes TEXT,
    reporting_period_start DATE,
    reporting_period_end DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compliance_politician ON compliance_records(politician_id);
CREATE INDEX idx_compliance_requirement ON compliance_records(requirement_id);
CREATE INDEX idx_compliance_status ON compliance_records(compliance_status);

-- ============================================================
-- CAMPAIGN FINANCE SOURCE MAPPING (donor-to-vote connections)
-- ============================================================

CREATE TABLE IF NOT EXISTS donor_vote_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    donor_industry_id UUID REFERENCES politician_donor_industries(id) ON DELETE SET NULL,
    industry_name VARCHAR(200) NOT NULL,
    donation_total DECIMAL(14,2),
    vote_event_id UUID REFERENCES vote_events(id) ON DELETE SET NULL,
    bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
    vote_cast VARCHAR(10),
    correlation_type VARCHAR(50) CHECK (correlation_type IN ('aligned', 'contradicted', 'neutral')) NOT NULL,
    description TEXT,
    ai_analysis TEXT,
    confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_donor_vote_politician ON donor_vote_connections(politician_id);
CREATE INDEX idx_donor_vote_industry ON donor_vote_connections(industry_name);
CREATE INDEX idx_donor_vote_correlation ON donor_vote_connections(correlation_type);
CREATE INDEX idx_donor_vote_bill ON donor_vote_connections(bill_id);
