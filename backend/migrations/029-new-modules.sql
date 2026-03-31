-- Migration 029: Foreign Aid, Hypocrisy Index, Dark Money, FARA, Think Tanks, Revenue Violations
-- Adds tables for 6 new accountability/transparency modules

-- =========================================================================
-- MODULE 1: Foreign Aid Tracker
-- =========================================================================

CREATE TABLE IF NOT EXISTS foreign_aid_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usaspending_award_id VARCHAR(100) UNIQUE,
    country_code VARCHAR(3) NOT NULL,
    country_name VARCHAR(200) NOT NULL,
    fiscal_year INTEGER NOT NULL,
    agency_name VARCHAR(300),
    program_name VARCHAR(500),
    program_description TEXT,
    category VARCHAR(50) CHECK (category IN ('military', 'economic', 'humanitarian', 'democracy_promotion', 'health', 'other')) NOT NULL,
    obligation_amount DECIMAL(16,2) DEFAULT 0,
    disbursement_amount DECIMAL(16,2) DEFAULT 0,
    award_type VARCHAR(50),
    recipient_name VARCHAR(500),
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fat_country ON foreign_aid_transactions(country_code);
CREATE INDEX IF NOT EXISTS idx_fat_year ON foreign_aid_transactions(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_fat_category ON foreign_aid_transactions(category);
CREATE INDEX IF NOT EXISTS idx_fat_country_year ON foreign_aid_transactions(country_code, fiscal_year);

CREATE TABLE IF NOT EXISTS foreign_aid_country_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(3) NOT NULL,
    country_name VARCHAR(200) NOT NULL,
    fiscal_year INTEGER NOT NULL,
    total_obligation DECIMAL(16,2) DEFAULT 0,
    total_disbursement DECIMAL(16,2) DEFAULT 0,
    military_amount DECIMAL(16,2) DEFAULT 0,
    economic_amount DECIMAL(16,2) DEFAULT 0,
    humanitarian_amount DECIMAL(16,2) DEFAULT 0,
    democracy_amount DECIMAL(16,2) DEFAULT 0,
    health_amount DECIMAL(16,2) DEFAULT 0,
    other_amount DECIMAL(16,2) DEFAULT 0,
    program_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(country_code, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_facs_country ON foreign_aid_country_summaries(country_code);
CREATE INDEX IF NOT EXISTS idx_facs_year ON foreign_aid_country_summaries(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_facs_total ON foreign_aid_country_summaries(total_obligation DESC);

CREATE TABLE IF NOT EXISTS foreign_aid_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(3) NOT NULL,
    country_name VARCHAR(200) NOT NULL,
    fiscal_year INTEGER NOT NULL,
    program_name VARCHAR(500) NOT NULL,
    agency_name VARCHAR(300),
    category VARCHAR(50) CHECK (category IN ('military', 'economic', 'humanitarian', 'democracy_promotion', 'health', 'other')),
    total_obligation DECIMAL(16,2) DEFAULT 0,
    total_disbursement DECIMAL(16,2) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(country_code, fiscal_year, program_name, agency_name)
);

CREATE INDEX IF NOT EXISTS idx_fap_country ON foreign_aid_programs(country_code);
CREATE INDEX IF NOT EXISTS idx_fap_year ON foreign_aid_programs(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_fap_category ON foreign_aid_programs(category);

-- =========================================================================
-- MODULE 2: Hypocrisy Index
-- =========================================================================

CREATE TABLE IF NOT EXISTS hypocrisy_index_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(3) NOT NULL,
    country_name VARCHAR(200) NOT NULL,
    policy_name VARCHAR(200) NOT NULL,
    policy_category VARCHAR(100),
    country_has_it BOOLEAN NOT NULL,
    us_has_it BOOLEAN NOT NULL,
    country_detail TEXT,
    us_detail TEXT,
    source_url TEXT,
    last_verified DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(country_code, policy_name)
);

CREATE INDEX IF NOT EXISTS idx_hid_country ON hypocrisy_index_data(country_code);
CREATE INDEX IF NOT EXISTS idx_hid_policy ON hypocrisy_index_data(policy_name);

-- =========================================================================
-- MODULE 3: Dark Money Gap
-- =========================================================================

CREATE TABLE IF NOT EXISTS outside_spending_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fec_committee_id VARCHAR(20) UNIQUE,
    name VARCHAR(500) NOT NULL,
    organization_type VARCHAR(50),
    designation VARCHAR(50),
    filing_frequency VARCHAR(50),
    is_501c4 BOOLEAN DEFAULT FALSE,
    is_super_pac BOOLEAN DEFAULT FALSE,
    total_spent DECIMAL(16,2) DEFAULT 0,
    total_disclosed_donors DECIMAL(16,2) DEFAULT 0,
    donor_disclosure_percentage DECIMAL(5,2) DEFAULT 0,
    cycle_year INTEGER,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_osg_fec_id ON outside_spending_groups(fec_committee_id);
CREATE INDEX IF NOT EXISTS idx_osg_501c4 ON outside_spending_groups(is_501c4) WHERE is_501c4 = TRUE;
CREATE INDEX IF NOT EXISTS idx_osg_total_spent ON outside_spending_groups(total_spent DESC);
CREATE INDEX IF NOT EXISTS idx_osg_cycle ON outside_spending_groups(cycle_year);

CREATE TABLE IF NOT EXISTS outside_spending_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES outside_spending_groups(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
    fec_candidate_id VARCHAR(20),
    fec_filing_id VARCHAR(50),
    amount DECIMAL(14,2) NOT NULL,
    expenditure_date DATE,
    support_oppose VARCHAR(10) CHECK (support_oppose IN ('support', 'oppose')),
    expenditure_description TEXT,
    payee_name VARCHAR(500),
    state VARCHAR(2),
    office VARCHAR(50),
    cycle_year INTEGER,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ost_group ON outside_spending_transactions(group_id);
CREATE INDEX IF NOT EXISTS idx_ost_candidate ON outside_spending_transactions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ost_date ON outside_spending_transactions(expenditure_date DESC);
CREATE INDEX IF NOT EXISTS idx_ost_cycle ON outside_spending_transactions(cycle_year);

CREATE TABLE IF NOT EXISTS dark_money_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    cycle_year INTEGER NOT NULL,
    total_outside_spending DECIMAL(16,2) DEFAULT 0,
    total_supporting DECIMAL(16,2) DEFAULT 0,
    total_opposing DECIMAL(16,2) DEFAULT 0,
    disclosed_amount DECIMAL(16,2) DEFAULT 0,
    unaccounted_amount DECIMAL(16,2) DEFAULT 0,
    dark_money_percentage DECIMAL(5,2) DEFAULT 0,
    group_count INTEGER DEFAULT 0,
    c4_group_count INTEGER DEFAULT 0,
    c4_total_spent DECIMAL(16,2) DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(candidate_id, cycle_year)
);

CREATE INDEX IF NOT EXISTS idx_dms_candidate ON dark_money_summaries(candidate_id);
CREATE INDEX IF NOT EXISTS idx_dms_cycle ON dark_money_summaries(cycle_year);
CREATE INDEX IF NOT EXISTS idx_dms_unaccounted ON dark_money_summaries(unaccounted_amount DESC);
CREATE INDEX IF NOT EXISTS idx_dms_percentage ON dark_money_summaries(dark_money_percentage DESC);

-- =========================================================================
-- MODULE 4: FARA Tracker
-- =========================================================================

CREATE TABLE IF NOT EXISTS fara_registrants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_number VARCHAR(20) UNIQUE NOT NULL,
    registrant_name VARCHAR(500) NOT NULL,
    address TEXT,
    state VARCHAR(2),
    registration_date DATE,
    termination_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fr_name ON fara_registrants(registrant_name);
CREATE INDEX IF NOT EXISTS idx_fr_active ON fara_registrants(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_fr_state ON fara_registrants(state);

CREATE TABLE IF NOT EXISTS fara_principals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_name VARCHAR(500) NOT NULL,
    country VARCHAR(100) NOT NULL,
    country_code VARCHAR(3),
    government_entity VARCHAR(500),
    is_government BOOLEAN DEFAULT FALSE,
    total_us_lobbying_spend DECIMAL(14,2) DEFAULT 0,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fp_country ON fara_principals(country);
CREATE INDEX IF NOT EXISTS idx_fp_country_code ON fara_principals(country_code);
CREATE INDEX IF NOT EXISTS idx_fp_government ON fara_principals(is_government) WHERE is_government = TRUE;
CREATE INDEX IF NOT EXISTS idx_fp_spend ON fara_principals(total_us_lobbying_spend DESC);

CREATE TABLE IF NOT EXISTS fara_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registrant_id UUID NOT NULL REFERENCES fara_registrants(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES fara_principals(id) ON DELETE CASCADE,
    contract_date DATE,
    contract_amount DECIMAL(14,2),
    contract_description TEXT,
    services_description TEXT,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fc_registrant ON fara_contracts(registrant_id);
CREATE INDEX IF NOT EXISTS idx_fc_principal ON fara_contracts(principal_id);
CREATE INDEX IF NOT EXISTS idx_fc_amount ON fara_contracts(contract_amount DESC);

CREATE TABLE IF NOT EXISTS fara_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registrant_id UUID NOT NULL REFERENCES fara_registrants(id) ON DELETE CASCADE,
    principal_id UUID REFERENCES fara_principals(id) ON DELETE SET NULL,
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
    contact_date DATE,
    contact_type VARCHAR(50),
    contact_office VARCHAR(300),
    contact_name VARCHAR(300),
    contact_title VARCHAR(300),
    description TEXT,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fcon_registrant ON fara_contacts(registrant_id);
CREATE INDEX IF NOT EXISTS idx_fcon_candidate ON fara_contacts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_fcon_date ON fara_contacts(contact_date DESC);
CREATE INDEX IF NOT EXISTS idx_fcon_principal ON fara_contacts(principal_id);

CREATE TABLE IF NOT EXISTS fara_disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registrant_id UUID NOT NULL REFERENCES fara_registrants(id) ON DELETE CASCADE,
    principal_id UUID REFERENCES fara_principals(id) ON DELETE SET NULL,
    recipient VARCHAR(500),
    amount DECIMAL(14,2),
    disbursement_date DATE,
    purpose VARCHAR(500),
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fd_registrant ON fara_disbursements(registrant_id);
CREATE INDEX IF NOT EXISTS idx_fd_principal ON fara_disbursements(principal_id);
CREATE INDEX IF NOT EXISTS idx_fd_date ON fara_disbursements(disbursement_date DESC);

CREATE TABLE IF NOT EXISTS fara_enforcement_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registrant_id UUID REFERENCES fara_registrants(id) ON DELETE SET NULL,
    principal_id UUID REFERENCES fara_principals(id) ON DELETE SET NULL,
    country VARCHAR(100),
    case_description TEXT NOT NULL,
    activity_description TEXT,
    enforcement_action BOOLEAN DEFAULT FALSE,
    action_type VARCHAR(100),
    action_date DATE,
    penalty_amount DECIMAL(14,2),
    doj_reference TEXT,
    comparable_no_action_description TEXT,
    source_url TEXT,
    source_label VARCHAR(300),
    source_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fec_country ON fara_enforcement_cases(country);
CREATE INDEX IF NOT EXISTS idx_fec_action ON fara_enforcement_cases(enforcement_action);

-- =========================================================================
-- MODULE 5: Think Tank Foreign Funding
-- =========================================================================

CREATE TABLE IF NOT EXISTS think_tanks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    ein VARCHAR(20) UNIQUE,
    propublica_id VARCHAR(50),
    address TEXT,
    city VARCHAR(100) DEFAULT 'Washington',
    state VARCHAR(2) DEFAULT 'DC',
    website TEXT,
    founded_year INTEGER,
    total_revenue DECIMAL(14,2),
    total_foreign_funding DECIMAL(14,2) DEFAULT 0,
    total_corporate_funding DECIMAL(14,2) DEFAULT 0,
    policy_focus TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tt_name ON think_tanks(name);
CREATE INDEX IF NOT EXISTS idx_tt_ein ON think_tanks(ein);
CREATE INDEX IF NOT EXISTS idx_tt_foreign ON think_tanks(total_foreign_funding DESC);

CREATE TABLE IF NOT EXISTS think_tank_funding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    think_tank_id UUID NOT NULL REFERENCES think_tanks(id) ON DELETE CASCADE,
    donor_name VARCHAR(500) NOT NULL,
    donor_type VARCHAR(50) CHECK (donor_type IN ('foreign_government', 'foreign_corporate', 'domestic_corporate', 'foundation', 'individual', 'unknown')),
    donor_country VARCHAR(100),
    amount DECIMAL(14,2),
    fiscal_year INTEGER,
    source_type VARCHAR(50) DEFAULT '990_filing',
    source_url TEXT,
    source_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ttf_think_tank ON think_tank_funding(think_tank_id);
CREATE INDEX IF NOT EXISTS idx_ttf_donor_type ON think_tank_funding(donor_type);
CREATE INDEX IF NOT EXISTS idx_ttf_country ON think_tank_funding(donor_country);
CREATE INDEX IF NOT EXISTS idx_ttf_year ON think_tank_funding(fiscal_year);

CREATE TABLE IF NOT EXISTS think_tank_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    think_tank_id UUID NOT NULL REFERENCES think_tanks(id) ON DELETE CASCADE,
    person_name VARCHAR(300) NOT NULL,
    title VARCHAR(300),
    start_date DATE,
    end_date DATE,
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
    employment_id UUID REFERENCES post_service_employment(id) ON DELETE SET NULL,
    is_revolving_door BOOLEAN DEFAULT FALSE,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tts_think_tank ON think_tank_staff(think_tank_id);
CREATE INDEX IF NOT EXISTS idx_tts_candidate ON think_tank_staff(candidate_id);
CREATE INDEX IF NOT EXISTS idx_tts_revolving ON think_tank_staff(is_revolving_door) WHERE is_revolving_door = TRUE;

CREATE TABLE IF NOT EXISTS think_tank_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    think_tank_id UUID NOT NULL REFERENCES think_tanks(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    publication_date DATE,
    url TEXT,
    topic_tags TEXT[],
    cited_by_politician_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
    cited_in_congressional_record BOOLEAN DEFAULT FALSE,
    congressional_record_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ttp_think_tank ON think_tank_publications(think_tank_id);
CREATE INDEX IF NOT EXISTS idx_ttp_date ON think_tank_publications(publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_ttp_cited ON think_tank_publications(cited_by_politician_id);
CREATE INDEX IF NOT EXISTS idx_ttp_congress ON think_tank_publications(cited_in_congressional_record) WHERE cited_in_congressional_record = TRUE;

-- =========================================================================
-- MODULE 6: Revenue Violations
-- =========================================================================

CREATE TABLE IF NOT EXISTS revenue_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(200) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('trust_fund_raid', 'corporate_bailout', 'pension_failure')) NOT NULL,
    description TEXT NOT NULL,
    what_was_taken TEXT,
    amount_dollars DECIMAL(16,2),
    amount_display VARCHAR(100),
    who_did_it TEXT,
    consequences_for_responsible TEXT,
    consequences_for_harmed TEXT,
    harmed_parties TEXT,
    current_status TEXT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rv_category ON revenue_violations(category);
CREATE INDEX IF NOT EXISTS idx_rv_amount ON revenue_violations(amount_dollars DESC);
CREATE INDEX IF NOT EXISTS idx_rv_date ON revenue_violations(start_date);

CREATE TABLE IF NOT EXISTS revenue_violation_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    violation_id UUID NOT NULL REFERENCES revenue_violations(id) ON DELETE CASCADE,
    source_label VARCHAR(300) NOT NULL,
    source_url TEXT NOT NULL,
    source_date DATE,
    source_type VARCHAR(50) CHECK (source_type IN ('government_report', 'court_record', 'news', 'academic', 'audit')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rvs_violation ON revenue_violation_sources(violation_id);

CREATE TABLE IF NOT EXISTS revenue_violation_actors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    violation_id UUID NOT NULL REFERENCES revenue_violations(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
    actor_name VARCHAR(300) NOT NULL,
    role VARCHAR(200),
    accountability_gap_id UUID REFERENCES accountability_gaps(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rva_violation ON revenue_violation_actors(violation_id);
CREATE INDEX IF NOT EXISTS idx_rva_candidate ON revenue_violation_actors(candidate_id);
