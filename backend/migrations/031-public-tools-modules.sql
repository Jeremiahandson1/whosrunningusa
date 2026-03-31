-- Migration 031: Public Tools Modules
-- Cost Calculator, Ballot Measure Funding, Gerrymandering, Local Government, Voter Access

-- =========================================================================
-- MODULE 2: Cost to You Calculator
-- =========================================================================

CREATE TABLE IF NOT EXISTS cost_calculator_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(200) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    total_cost DECIMAL(16,2) NOT NULL,
    cost_display VARCHAR(100),
    cost_type VARCHAR(30) CHECK (cost_type IN ('bill', 'budget', 'foreign_aid', 'military', 'program', 'bailout')) NOT NULL,
    fiscal_year INTEGER,
    duration_years INTEGER DEFAULT 1,
    source_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
    source_aid_country VARCHAR(3),
    source_url TEXT,
    source_label VARCHAR(300),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cci_type ON cost_calculator_items(cost_type);
CREATE INDEX IF NOT EXISTS idx_cci_year ON cost_calculator_items(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_cci_cost ON cost_calculator_items(total_cost DESC);

CREATE TABLE IF NOT EXISTS income_brackets (
    id SERIAL PRIMARY KEY,
    bracket_label VARCHAR(100) NOT NULL,
    min_income INTEGER NOT NULL,
    max_income INTEGER,
    effective_tax_rate DECIMAL(5,2),
    tax_share_pct DECIMAL(8,6) NOT NULL,
    household_count INTEGER NOT NULL,
    source_year INTEGER DEFAULT 2023,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- MODULE 5: Ballot Measure Funding
-- =========================================================================

CREATE TABLE IF NOT EXISTS ballot_measure_funding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_id UUID NOT NULL REFERENCES ballot_measures(id) ON DELETE CASCADE,
    funder_name VARCHAR(500) NOT NULL,
    funder_type VARCHAR(30) CHECK (funder_type IN ('corporation', 'pac', 'union', 'individual', 'nonprofit', 'government', 'other')),
    amount DECIMAL(14,2),
    support_oppose VARCHAR(10) CHECK (support_oppose IN ('support', 'oppose')),
    disclosure_date DATE,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bmf_measure ON ballot_measure_funding(measure_id);
CREATE INDEX IF NOT EXISTS idx_bmf_funder_type ON ballot_measure_funding(funder_type);
CREATE INDEX IF NOT EXISTS idx_bmf_support ON ballot_measure_funding(support_oppose);
CREATE INDEX IF NOT EXISTS idx_bmf_amount ON ballot_measure_funding(amount DESC);

-- =========================================================================
-- MODULE 6: Gerrymandering Visualizer
-- =========================================================================

CREATE TABLE IF NOT EXISTS district_election_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id UUID REFERENCES congressional_districts(id) ON DELETE SET NULL,
    state_fips VARCHAR(2) NOT NULL,
    state_abbr VARCHAR(2),
    district_number VARCHAR(5) NOT NULL,
    election_year INTEGER NOT NULL,
    dem_votes INTEGER DEFAULT 0,
    rep_votes INTEGER DEFAULT 0,
    other_votes INTEGER DEFAULT 0,
    total_votes INTEGER DEFAULT 0,
    dem_candidate VARCHAR(200),
    rep_candidate VARCHAR(200),
    winner_party VARCHAR(20),
    winner_margin DECIMAL(5,2),
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(state_fips, district_number, election_year)
);

CREATE INDEX IF NOT EXISTS idx_der_state ON district_election_results(state_fips);
CREATE INDEX IF NOT EXISTS idx_der_year ON district_election_results(election_year);
CREATE INDEX IF NOT EXISTS idx_der_winner ON district_election_results(winner_party);

CREATE TABLE IF NOT EXISTS gerrymandering_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_fips VARCHAR(2) NOT NULL,
    state_abbr VARCHAR(2),
    state_name VARCHAR(50),
    election_year INTEGER NOT NULL,
    total_districts INTEGER,
    efficiency_gap DECIMAL(6,4),
    seats_votes_ratio DECIMAL(6,4),
    dem_vote_share DECIMAL(5,2),
    dem_seat_share DECIMAL(5,2),
    rep_vote_share DECIMAL(5,2),
    rep_seat_share DECIMAL(5,2),
    wasted_dem_votes INTEGER,
    wasted_rep_votes INTEGER,
    avg_compactness_score DECIMAL(5,3),
    advantage_party VARCHAR(20),
    advantage_seats DECIMAL(4,1),
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(state_fips, election_year)
);

CREATE INDEX IF NOT EXISTS idx_gm_state ON gerrymandering_metrics(state_fips);
CREATE INDEX IF NOT EXISTS idx_gm_year ON gerrymandering_metrics(election_year);
CREATE INDEX IF NOT EXISTS idx_gm_gap ON gerrymandering_metrics(efficiency_gap DESC);

-- =========================================================================
-- MODULE 7: Local Government
-- =========================================================================

CREATE TABLE IF NOT EXISTS local_offices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    office_level VARCHAR(30) CHECK (office_level IN ('city_council', 'school_board', 'county_board', 'mayor', 'city_clerk', 'assessor', 'sheriff', 'other')) NOT NULL,
    jurisdiction_name VARCHAR(200) NOT NULL,
    jurisdiction_type VARCHAR(20) CHECK (jurisdiction_type IN ('city', 'county', 'school_district', 'township', 'special_district')),
    state VARCHAR(2) NOT NULL,
    county_fips VARCHAR(5),
    seats INTEGER DEFAULT 1,
    term_years INTEGER,
    is_partisan BOOLEAN DEFAULT TRUE,
    salary DECIMAL(12,2),
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lo_state ON local_offices(state);
CREATE INDEX IF NOT EXISTS idx_lo_level ON local_offices(office_level);
CREATE INDEX IF NOT EXISTS idx_lo_jurisdiction ON local_offices(jurisdiction_name);
CREATE INDEX IF NOT EXISTS idx_lo_county ON local_offices(county_fips);

CREATE TABLE IF NOT EXISTS local_officials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
    office_id UUID NOT NULL REFERENCES local_offices(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    party VARCHAR(50),
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT TRUE,
    email VARCHAR(200),
    phone VARCHAR(20),
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lof_office ON local_officials(office_id);
CREATE INDEX IF NOT EXISTS idx_lof_candidate ON local_officials(candidate_id);
CREATE INDEX IF NOT EXISTS idx_lof_current ON local_officials(is_current) WHERE is_current = TRUE;

-- =========================================================================
-- MODULE 9: Voter Suppression Tracker
-- =========================================================================

CREATE TABLE IF NOT EXISTS voter_access_laws (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state VARCHAR(2) NOT NULL,
    law_type VARCHAR(30) CHECK (law_type IN ('voter_id', 'polling_place', 'early_voting', 'mail_voting', 'registration', 'felon_voting', 'purge', 'other')) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    enacted_date DATE,
    effective_date DATE,
    is_restrictive BOOLEAN,
    bill_number VARCHAR(50),
    sponsor_candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
    source_url TEXT,
    source_label VARCHAR(300),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_val_state ON voter_access_laws(state);
CREATE INDEX IF NOT EXISTS idx_val_type ON voter_access_laws(law_type);
CREATE INDEX IF NOT EXISTS idx_val_restrictive ON voter_access_laws(is_restrictive);
CREATE INDEX IF NOT EXISTS idx_val_sponsor ON voter_access_laws(sponsor_candidate_id);

CREATE TABLE IF NOT EXISTS voter_access_impacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    law_id UUID NOT NULL REFERENCES voter_access_laws(id) ON DELETE CASCADE,
    demographic_group VARCHAR(100) NOT NULL,
    impact_description TEXT,
    affected_population INTEGER,
    percentage_affected DECIMAL(5,2),
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vai_law ON voter_access_impacts(law_id);
CREATE INDEX IF NOT EXISTS idx_vai_demographic ON voter_access_impacts(demographic_group);

CREATE TABLE IF NOT EXISTS voter_access_state_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state VARCHAR(2) NOT NULL UNIQUE,
    state_name VARCHAR(50),
    overall_score DECIMAL(5,2),
    voter_id_score DECIMAL(5,2),
    early_voting_score DECIMAL(5,2),
    mail_voting_score DECIMAL(5,2),
    registration_score DECIMAL(5,2),
    felon_voting_score DECIMAL(5,2),
    restrictive_law_count INTEGER DEFAULT 0,
    expansive_law_count INTEGER DEFAULT 0,
    last_computed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vass_score ON voter_access_state_scores(overall_score DESC);
