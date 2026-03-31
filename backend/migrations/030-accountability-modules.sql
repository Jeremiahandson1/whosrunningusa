-- Migration 030: Accountability Modules
-- Promise Tracker, Conflict of Interest Scanner, Rubber Stamp Score, Corporate PAC Pledge

-- =========================================================================
-- MODULE 1: Promise Tracker — Public Scoreboard
-- =========================================================================

CREATE TABLE IF NOT EXISTS promise_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    total_promises INTEGER DEFAULT 0,
    locked_promises INTEGER DEFAULT 0,
    kept INTEGER DEFAULT 0,
    broken INTEGER DEFAULT 0,
    in_progress INTEGER DEFAULT 0,
    compromised INTEGER DEFAULT 0,
    pending INTEGER DEFAULT 0,
    promise_score DECIMAL(5,2) DEFAULT 0,
    last_computed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(politician_id)
);

CREATE INDEX IF NOT EXISTS idx_ps_score ON promise_scores(promise_score DESC);
CREATE INDEX IF NOT EXISTS idx_ps_politician ON promise_scores(politician_id);

CREATE TABLE IF NOT EXISTS promise_auto_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promise_id UUID NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
    vote_event_id UUID REFERENCES vote_events(id) ON DELETE SET NULL,
    bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
    match_type VARCHAR(20) CHECK (match_type IN ('kept', 'broken', 'partial')),
    confidence DECIMAL(3,2),
    ai_reasoning TEXT,
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pac_promise ON promise_auto_checks(promise_id);
CREATE INDEX IF NOT EXISTS idx_pac_reviewed ON promise_auto_checks(reviewed) WHERE reviewed = FALSE;

-- =========================================================================
-- MODULE 3: Conflict of Interest Scanner
-- =========================================================================

CREATE TABLE IF NOT EXISTS conflict_of_interest_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    trade_id UUID REFERENCES official_trades(id) ON DELETE SET NULL,
    vote_event_id UUID REFERENCES vote_events(id) ON DELETE SET NULL,
    bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
    trade_ticker VARCHAR(20),
    trade_asset_name VARCHAR(300),
    trade_type VARCHAR(20),
    trade_amount_range_low DECIMAL(14,2),
    trade_amount_range_high DECIMAL(14,2),
    trade_date DATE,
    vote_date DATE,
    time_gap_days INTEGER,
    description TEXT,
    severity VARCHAR(10) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    ai_reasoning TEXT,
    confidence DECIMAL(3,2),
    verified BOOLEAN DEFAULT FALSE,
    published BOOLEAN DEFAULT FALSE,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coi_politician ON conflict_of_interest_flags(politician_id);
CREATE INDEX IF NOT EXISTS idx_coi_trade ON conflict_of_interest_flags(trade_id);
CREATE INDEX IF NOT EXISTS idx_coi_bill ON conflict_of_interest_flags(bill_id);
CREATE INDEX IF NOT EXISTS idx_coi_severity ON conflict_of_interest_flags(severity);
CREATE INDEX IF NOT EXISTS idx_coi_published ON conflict_of_interest_flags(published) WHERE published = TRUE;

-- =========================================================================
-- MODULE 4: Rubber Stamp Score
-- =========================================================================

CREATE TABLE IF NOT EXISTS rubber_stamp_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    cycle_year INTEGER NOT NULL,
    party_loyalty_pct DECIMAL(5,2),
    donor_alignment_pct DECIMAL(5,2),
    total_votes INTEGER DEFAULT 0,
    party_line_votes INTEGER DEFAULT 0,
    cross_party_votes INTEGER DEFAULT 0,
    donor_aligned_votes INTEGER DEFAULT 0,
    donor_opposed_votes INTEGER DEFAULT 0,
    independent_votes INTEGER DEFAULT 0,
    last_computed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(politician_id, cycle_year)
);

CREATE INDEX IF NOT EXISTS idx_rss_politician ON rubber_stamp_scores(politician_id);
CREATE INDEX IF NOT EXISTS idx_rss_party_loyalty ON rubber_stamp_scores(party_loyalty_pct DESC);
CREATE INDEX IF NOT EXISTS idx_rss_donor_alignment ON rubber_stamp_scores(donor_alignment_pct DESC);
CREATE INDEX IF NOT EXISTS idx_rss_cycle ON rubber_stamp_scores(cycle_year);

-- =========================================================================
-- MODULE 10: Corporate PAC Rejection Pledge
-- =========================================================================

CREATE TABLE IF NOT EXISTS pac_pledges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL UNIQUE REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    pledge_date DATE NOT NULL,
    pledge_text TEXT,
    pledge_source_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_source TEXT,
    violation_detected BOOLEAN DEFAULT FALSE,
    violation_amount DECIMAL(14,2),
    violation_detected_at TIMESTAMPTZ,
    violation_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pp_candidate ON pac_pledges(candidate_id);
CREATE INDEX IF NOT EXISTS idx_pp_active ON pac_pledges(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_pp_violation ON pac_pledges(violation_detected) WHERE violation_detected = TRUE;
