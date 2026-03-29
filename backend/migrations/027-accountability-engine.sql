-- Migration 027: Accountability Gap Engine
-- Adds tables for tracking politician inconsistencies between statements, votes, and donors

-- Public statements made by politicians
CREATE TABLE IF NOT EXISTS public_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    statement_text TEXT NOT NULL,
    statement_date DATE,
    source_url TEXT,
    topic_tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_statements_politician ON public_statements(politician_id);
CREATE INDEX IF NOT EXISTS idx_public_statements_date ON public_statements(statement_date);
CREATE INDEX IF NOT EXISTS idx_public_statements_topics ON public_statements USING GIN(topic_tags);

-- Identified gaps between what politicians say and what they do
CREATE TABLE IF NOT EXISTS accountability_gaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    gap_type VARCHAR(50) CHECK (gap_type IN ('donor_vote', 'statement_vote', 'statement_donor')),
    stated_position TEXT,
    actual_action TEXT,
    supporting_vote_ids UUID[],
    supporting_donor_ids UUID[],
    gap_severity INTEGER CHECK (gap_severity BETWEEN 1 AND 10),
    ai_analysis TEXT,
    topic_tag VARCHAR(100),
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accountability_gaps_politician ON accountability_gaps(politician_id);
CREATE INDEX IF NOT EXISTS idx_accountability_gaps_type ON accountability_gaps(gap_type);
CREATE INDEX IF NOT EXISTS idx_accountability_gaps_severity ON accountability_gaps(gap_severity DESC);
CREATE INDEX IF NOT EXISTS idx_accountability_gaps_published ON accountability_gaps(published) WHERE published = TRUE;
CREATE INDEX IF NOT EXISTS idx_accountability_gaps_topic ON accountability_gaps(topic_tag);

-- Aggregate accountability scores per politician
CREATE TABLE IF NOT EXISTS accountability_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE UNIQUE,
    consistency_score INTEGER CHECK (consistency_score BETWEEN 0 AND 100),
    donor_influence_score INTEGER CHECK (donor_influence_score BETWEEN 0 AND 100),
    total_gaps_found INTEGER DEFAULT 0,
    last_computed TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accountability_scores_consistency ON accountability_scores(consistency_score DESC);
CREATE INDEX IF NOT EXISTS idx_accountability_scores_donor ON accountability_scores(donor_influence_score DESC);

-- Donor industry aggregation for politician donor breakdowns
CREATE TABLE IF NOT EXISTS politician_donor_industries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    industry_name VARCHAR(200) NOT NULL,
    total_amount DECIMAL(12, 2) DEFAULT 0,
    donor_count INTEGER DEFAULT 0,
    cycle_year INTEGER,
    source VARCHAR(50),
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(politician_id, industry_name, cycle_year)
);

CREATE INDEX IF NOT EXISTS idx_politician_donor_industries_politician ON politician_donor_industries(politician_id);
CREATE INDEX IF NOT EXISTS idx_politician_donor_industries_amount ON politician_donor_industries(total_amount DESC);
