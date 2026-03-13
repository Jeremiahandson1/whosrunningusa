-- =============================================================================
-- WHOSRUNNINGUSA COMPREHENSIVE TRANSPARENCY SCHEMA
-- =============================================================================
-- Clean migration that handles existing tables properly
-- Run this INSTEAD of 007-comprehensive-transparency.sql
-- =============================================================================

-- =============================================================================
-- PART 1: FIX EXISTING ENDORSEMENTS TABLE
-- =============================================================================

-- Add missing columns to existing endorsements table
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS candidate_id UUID REFERENCES candidate_profiles(id);
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS endorser_name VARCHAR(500);
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS endorser_type VARCHAR(50);
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS endorser_description TEXT;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS endorsement_date DATE;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS endorsement_url TEXT;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS election_cycle VARCHAR(10);
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS race_description VARCHAR(200);
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS endorser_category VARCHAR(100);
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS endorser_lean VARCHAR(20);
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS source VARCHAR(50);
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS vote_smart_id VARCHAR(50);

-- Copy endorsed_id to candidate_id if needed
UPDATE endorsements SET candidate_id = endorsed_id WHERE candidate_id IS NULL AND endorsed_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_endorsements_candidate ON endorsements(candidate_id);
CREATE INDEX IF NOT EXISTS idx_endorsements_type ON endorsements(endorser_type);
CREATE INDEX IF NOT EXISTS idx_endorsements_category ON endorsements(endorser_category);


-- =============================================================================
-- PART 2: CAMPAIGN FINANCE
-- =============================================================================

CREATE TABLE IF NOT EXISTS contributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  contributor_type VARCHAR(50) NOT NULL,
  employer VARCHAR(500),
  occupation VARCHAR(500),
  industry VARCHAR(200),
  industry_code VARCHAR(20),
  parent_organization VARCHAR(500),
  city VARCHAR(200),
  state VARCHAR(2),
  zip VARCHAR(10),
  fec_committee_id VARCHAR(20),
  crp_id VARCHAR(20),
  vote_smart_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contributors_name ON contributors(name);
CREATE INDEX IF NOT EXISTS idx_contributors_type ON contributors(contributor_type);
CREATE INDEX IF NOT EXISTS idx_contributors_industry ON contributors(industry);

CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  contributor_id UUID REFERENCES contributors(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  contribution_date DATE,
  contribution_type VARCHAR(50),
  election_cycle VARCHAR(10),
  contributor_name VARCHAR(500),
  contributor_type VARCHAR(50),
  contributor_employer VARCHAR(500),
  contributor_occupation VARCHAR(500),
  source VARCHAR(50) NOT NULL,
  source_url TEXT,
  external_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contributions_candidate ON contributions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_contributions_contributor ON contributions(contributor_id);
CREATE INDEX IF NOT EXISTS idx_contributions_amount ON contributions(amount DESC);
CREATE INDEX IF NOT EXISTS idx_contributions_date ON contributions(contribution_date);
CREATE INDEX IF NOT EXISTS idx_contributions_cycle ON contributions(election_cycle);

CREATE TABLE IF NOT EXISTS campaign_finance_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  election_cycle VARCHAR(10) NOT NULL,
  total_raised DECIMAL(14,2),
  total_spent DECIMAL(14,2),
  cash_on_hand DECIMAL(14,2),
  debt DECIMAL(14,2),
  individual_contributions DECIMAL(14,2),
  pac_contributions DECIMAL(14,2),
  party_contributions DECIMAL(14,2),
  self_financing DECIMAL(14,2),
  other_contributions DECIMAL(14,2),
  small_donor_total DECIMAL(14,2),
  large_donor_total DECIMAL(14,2),
  small_donor_percent DECIMAL(5,2),
  total_contributors INT,
  total_transactions INT,
  coverage_start_date DATE,
  coverage_end_date DATE,
  last_filed_date DATE,
  source VARCHAR(50),
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, election_cycle)
);

CREATE INDEX IF NOT EXISTS idx_finance_summaries_candidate ON campaign_finance_summaries(candidate_id);

CREATE TABLE IF NOT EXISTS candidate_top_donors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  election_cycle VARCHAR(10) NOT NULL,
  donor_name VARCHAR(500) NOT NULL,
  donor_type VARCHAR(50),
  industry VARCHAR(200),
  total_amount DECIMAL(12,2) NOT NULL,
  contribution_count INT,
  rank_overall INT,
  rank_in_type INT,
  contributor_id UUID REFERENCES contributors(id),
  source VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, election_cycle, donor_name)
);

CREATE INDEX IF NOT EXISTS idx_top_donors_candidate ON candidate_top_donors(candidate_id);
CREATE INDEX IF NOT EXISTS idx_top_donors_amount ON candidate_top_donors(total_amount DESC);


-- =============================================================================
-- PART 3: INTEREST GROUPS & RATINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS interest_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(300) NOT NULL,
  short_name VARCHAR(100),
  description TEXT,
  category VARCHAR(100),
  political_lean VARCHAR(20),
  website TEXT,
  vote_smart_sig_id VARCHAR(50) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interest_groups_category ON interest_groups(category);

-- Drop and recreate interest_group_ratings if it exists with wrong schema
DROP TABLE IF EXISTS interest_group_ratings CASCADE;

CREATE TABLE interest_group_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  interest_group_id UUID REFERENCES interest_groups(id) ON DELETE SET NULL,
  rating VARCHAR(50) NOT NULL,
  rating_score DECIMAL(5,2),
  rating_name VARCHAR(300),
  rating_text TEXT,
  time_span VARCHAR(100),
  rating_year INT,
  sig_name VARCHAR(300),
  sig_category VARCHAR(100),
  source VARCHAR(50) DEFAULT 'vote_smart',
  source_url TEXT,
  vote_smart_rating_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, interest_group_id, time_span, rating_name)
);

CREATE INDEX IF NOT EXISTS idx_ig_ratings_candidate ON interest_group_ratings(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ig_ratings_group ON interest_group_ratings(interest_group_id);
CREATE INDEX IF NOT EXISTS idx_ig_ratings_score ON interest_group_ratings(rating_score);


-- =============================================================================
-- PART 4: COMMITTEES
-- =============================================================================

CREATE TABLE IF NOT EXISTS legislative_committees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(300) NOT NULL,
  short_name VARCHAR(100),
  chamber VARCHAR(20),
  committee_type VARCHAR(50),
  parent_committee_id UUID REFERENCES legislative_committees(id),
  jurisdiction_level VARCHAR(20),
  state VARCHAR(2),
  description TEXT,
  jurisdiction_text TEXT,
  vote_smart_id VARCHAR(50),
  congress_id VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_committees_chamber ON legislative_committees(chamber);
CREATE INDEX IF NOT EXISTS idx_committees_state ON legislative_committees(state);

CREATE TABLE IF NOT EXISTS committee_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  committee_id UUID NOT NULL REFERENCES legislative_committees(id) ON DELETE CASCADE,
  role VARCHAR(100),
  is_chair BOOLEAN DEFAULT FALSE,
  is_ranking_member BOOLEAN DEFAULT FALSE,
  start_date DATE,
  end_date DATE,
  congress_number INT,
  session VARCHAR(50),
  is_current BOOLEAN DEFAULT TRUE,
  source VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, committee_id, start_date)
);

CREATE INDEX IF NOT EXISTS idx_memberships_candidate ON committee_memberships(candidate_id);
CREATE INDEX IF NOT EXISTS idx_memberships_committee ON committee_memberships(committee_id);
CREATE INDEX IF NOT EXISTS idx_memberships_current ON committee_memberships(is_current);


-- =============================================================================
-- PART 5: BILLS & SPONSORSHIPS
-- =============================================================================

-- Create bills table if not exists (may exist from voting records migration)
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(100),
  bill_number VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  summary TEXT,
  state VARCHAR(2),
  chamber VARCHAR(20),
  session VARCHAR(50),
  categories TEXT[],
  status VARCHAR(50),
  introduced_date DATE,
  last_action_date DATE,
  source VARCHAR(50),
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_state ON bills(state);
CREATE INDEX IF NOT EXISTS idx_bills_external_id ON bills(external_id);
CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills(bill_number, state);

CREATE TABLE IF NOT EXISTS bill_sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  sponsorship_type VARCHAR(50) NOT NULL,
  bill_number VARCHAR(50),
  bill_title TEXT,
  bill_state VARCHAR(2),
  bill_session VARCHAR(50),
  sponsorship_date DATE,
  withdrawn_date DATE,
  source VARCHAR(50),
  vote_smart_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, bill_id, sponsorship_type)
);

CREATE INDEX IF NOT EXISTS idx_sponsorships_candidate ON bill_sponsorships(candidate_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_bill ON bill_sponsorships(bill_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_type ON bill_sponsorships(sponsorship_type);


-- =============================================================================
-- PART 6: VOTE EVENTS & VOTING RECORDS
-- =============================================================================

CREATE TABLE IF NOT EXISTS vote_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  external_id VARCHAR(100),
  motion_text TEXT,
  motion_classification VARCHAR(50),
  chamber VARCHAR(20),
  vote_date DATE NOT NULL,
  result VARCHAR(20),
  yes_count INT,
  no_count INT,
  abstain_count INT,
  absent_count INT,
  source VARCHAR(50),
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vote_events_bill ON vote_events(bill_id);
CREATE INDEX IF NOT EXISTS idx_vote_events_date ON vote_events(vote_date);

CREATE TABLE IF NOT EXISTS voting_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  vote_event_id UUID NOT NULL REFERENCES vote_events(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  vote VARCHAR(20) NOT NULL,
  source VARCHAR(50) NOT NULL,
  source_url TEXT,
  external_voter_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, vote_event_id)
);

CREATE INDEX IF NOT EXISTS idx_voting_records_candidate ON voting_records(candidate_id);
CREATE INDEX IF NOT EXISTS idx_voting_records_bill ON voting_records(bill_id);
CREATE INDEX IF NOT EXISTS idx_voting_records_vote ON voting_records(vote);

CREATE TABLE IF NOT EXISTS vote_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voting_record_id UUID NOT NULL REFERENCES voting_records(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  explanation_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  UNIQUE(voting_record_id)
);

CREATE INDEX IF NOT EXISTS idx_vote_explanations_candidate ON vote_explanations(candidate_id);


-- =============================================================================
-- PART 7: BALLOT MEASURES
-- =============================================================================

CREATE TABLE IF NOT EXISTS ballot_measures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measure_number VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  state VARCHAR(2) NOT NULL,
  jurisdiction_level VARCHAR(20),
  jurisdiction_name VARCHAR(200),
  election_id UUID REFERENCES elections(id),
  election_date DATE,
  election_type VARCHAR(50),
  summary TEXT,
  full_text TEXT,
  fiscal_impact TEXT,
  measure_type VARCHAR(50),
  categories TEXT[],
  status VARCHAR(50),
  yes_votes INT,
  no_votes INT,
  yes_percent DECIMAL(5,2),
  total_votes INT,
  pro_argument TEXT,
  con_argument TEXT,
  source VARCHAR(50),
  source_url TEXT,
  vote_smart_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_measures_state ON ballot_measures(state);
CREATE INDEX IF NOT EXISTS idx_measures_date ON ballot_measures(election_date);
CREATE INDEX IF NOT EXISTS idx_measures_status ON ballot_measures(status);

CREATE TABLE IF NOT EXISTS candidate_measure_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  measure_id UUID NOT NULL REFERENCES ballot_measures(id) ON DELETE CASCADE,
  position VARCHAR(20) NOT NULL,
  position_statement TEXT,
  source VARCHAR(50),
  source_url TEXT,
  source_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, measure_id)
);


-- =============================================================================
-- PART 8: CANDIDATE BIO ENRICHMENT
-- =============================================================================

CREATE TABLE IF NOT EXISTS candidate_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  institution_name VARCHAR(300) NOT NULL,
  institution_type VARCHAR(50),
  institution_state VARCHAR(2),
  degree VARCHAR(200),
  field_of_study VARCHAR(200),
  graduation_year INT,
  start_year INT,
  honors TEXT,
  notes TEXT,
  source VARCHAR(50),
  vote_smart_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_education_candidate ON candidate_education(candidate_id);

CREATE TABLE IF NOT EXISTS candidate_professional_experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  title VARCHAR(300),
  organization VARCHAR(300) NOT NULL,
  organization_type VARCHAR(50),
  industry VARCHAR(200),
  city VARCHAR(200),
  state VARCHAR(2),
  start_year INT,
  end_year INT,
  is_current BOOLEAN DEFAULT FALSE,
  description TEXT,
  source VARCHAR(50),
  vote_smart_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experience_candidate ON candidate_professional_experience(candidate_id);

CREATE TABLE IF NOT EXISTS candidate_political_experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  office_name VARCHAR(300),
  office_level VARCHAR(20),
  state VARCHAR(2),
  district VARCHAR(100),
  jurisdiction_name VARCHAR(200),
  start_year INT,
  end_year INT,
  is_current BOOLEAN DEFAULT FALSE,
  election_type VARCHAR(50),
  description TEXT,
  source VARCHAR(50),
  vote_smart_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_political_exp_candidate ON candidate_political_experience(candidate_id);

CREATE TABLE IF NOT EXISTS candidate_org_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  organization_name VARCHAR(300) NOT NULL,
  organization_type VARCHAR(50),
  role VARCHAR(200),
  is_leadership BOOLEAN DEFAULT FALSE,
  start_year INT,
  end_year INT,
  is_current BOOLEAN DEFAULT FALSE,
  source VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_candidate ON candidate_org_memberships(candidate_id);


-- =============================================================================
-- PART 9: POLITICAL COURAGE TEST (PCT/NPAT)
-- =============================================================================

CREATE TABLE IF NOT EXISTS pct_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  survey_year INT NOT NULL,
  survey_name VARCHAR(200),
  completed BOOLEAN DEFAULT FALSE,
  refused BOOLEAN DEFAULT FALSE,
  refused_message TEXT,
  response_date DATE,
  source VARCHAR(50) DEFAULT 'vote_smart',
  vote_smart_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, survey_year)
);

CREATE TABLE IF NOT EXISTS pct_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES pct_surveys(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  section_name VARCHAR(200),
  question_text TEXT NOT NULL,
  response_option VARCHAR(200),
  response_text TEXT,
  position VARCHAR(20),
  vote_smart_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pct_responses_candidate ON pct_responses(candidate_id);
CREATE INDEX IF NOT EXISTS idx_pct_responses_section ON pct_responses(section_name);

CREATE TABLE IF NOT EXISTS policy_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  issue_category VARCHAR(100) NOT NULL,
  issue_name VARCHAR(200),
  position VARCHAR(50),
  position_text TEXT,
  source VARCHAR(50) NOT NULL,
  source_url TEXT,
  source_date DATE,
  survey_question TEXT,
  survey_response TEXT,
  is_self_reported BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_positions_candidate ON policy_positions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_policy_positions_category ON policy_positions(issue_category);


-- =============================================================================
-- PART 10: TRANSPARENCY SCORES
-- =============================================================================

CREATE TABLE IF NOT EXISTS transparency_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  overall_score DECIMAL(5,2),
  voting_transparency DECIMAL(5,2),
  position_transparency DECIMAL(5,2),
  finance_transparency DECIMAL(5,2),
  consistency_score DECIMAL(5,2),
  votes_cast_percent DECIMAL(5,2),
  pct_completion_percent DECIMAL(5,2),
  vote_position_match_percent DECIMAL(5,2),
  total_votes_possible INT,
  total_votes_cast INT,
  total_positions_stated INT,
  total_positions_with_votes INT,
  positions_matching_votes INT,
  calculation_date DATE NOT NULL,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, calculation_date)
);

CREATE INDEX IF NOT EXISTS idx_transparency_scores_candidate ON transparency_scores(candidate_id);
CREATE INDEX IF NOT EXISTS idx_transparency_scores_overall ON transparency_scores(overall_score DESC);


-- =============================================================================
-- PART 11: ENHANCE OFFICES FOR LOCAL COVERAGE
-- =============================================================================

ALTER TABLE offices ADD COLUMN IF NOT EXISTS locality_type VARCHAR(50);
ALTER TABLE offices ADD COLUMN IF NOT EXISTS locality_name VARCHAR(200);
ALTER TABLE offices ADD COLUMN IF NOT EXISTS parent_jurisdiction VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_offices_locality ON offices(locality_type, locality_name);


-- =============================================================================
-- PART 12: DATA SOURCES
-- =============================================================================

INSERT INTO data_sources (id, name, display_name, source_type, base_url, api_key_env_var, sync_frequency_hours)
VALUES 
  ('00000000-0000-0000-0000-000000000005', 'vote_smart', 'Vote Smart', 'api', 'https://api.votesmart.org', 'VOTE_SMART_API_KEY', 168),
  ('00000000-0000-0000-0000-000000000006', 'propublica', 'ProPublica Congress', 'api', 'https://api.propublica.org/congress', 'PROPUBLICA_API_KEY', 24),
  ('00000000-0000-0000-0000-000000000007', 'opensecrets', 'OpenSecrets/CRP', 'api', 'https://www.opensecrets.org/api', 'OPENSECRETS_API_KEY', 168)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  base_url = EXCLUDED.base_url;


-- =============================================================================
-- DONE
-- =============================================================================

SELECT 'Comprehensive transparency schema created successfully!' as status;