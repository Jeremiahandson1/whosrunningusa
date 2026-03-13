-- WhosRunningUSA Database Schema
-- Version 1.0

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('voter', 'candidate', 'admin')),
    
    -- Profile info
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    profile_pic_url VARCHAR(500),
    bio TEXT,
    
    -- Location
    state VARCHAR(2),
    county VARCHAR(100),
    city VARCHAR(100),
    zip_code VARCHAR(10),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Verification
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP,
    phone VARCHAR(20),
    phone_verified BOOLEAN DEFAULT FALSE,
    phone_verified_at TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    banned_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_location ON users(state, county, city);

-- =====================================================
-- CANDIDATE PROFILES
-- =====================================================

CREATE TABLE candidate_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Verification tiers
    identity_verified BOOLEAN DEFAULT FALSE,
    identity_verified_at TIMESTAMP,
    candidate_verified BOOLEAN DEFAULT FALSE,
    candidate_verified_at TIMESTAMP,
    incumbent_verified BOOLEAN DEFAULT FALSE,
    incumbent_verified_at TIMESTAMP,
    
    -- Shadow profile flag (for incumbents who haven't claimed)
    is_shadow_profile BOOLEAN DEFAULT FALSE,
    
    -- Profile content
    display_name VARCHAR(200),
    official_title VARCHAR(200),
    party_affiliation VARCHAR(100),
    campaign_website VARCHAR(500),
    campaign_email VARCHAR(255),
    campaign_phone VARCHAR(20),
    
    -- Extended bio
    full_bio TEXT,
    education TEXT,
    professional_background TEXT,
    
    -- Social links (display only, not clickable)
    twitter_handle VARCHAR(100),
    facebook_handle VARCHAR(100),
    
    -- Engagement metrics (calculated)
    qa_response_rate DECIMAL(5,2) DEFAULT 0,
    avg_response_time_hours DECIMAL(10,2),
    total_questions_received INTEGER DEFAULT 0,
    total_questions_answered INTEGER DEFAULT 0,
    town_halls_held INTEGER DEFAULT 0,
    
    -- Verification & external IDs
    verification_source VARCHAR(100),
    verification_external_id VARCHAR(100),
    verification_last_checked TIMESTAMP,
    fec_candidate_id VARCHAR(20),
    open_states_id VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    profile_complete BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_candidate_profiles_user ON candidate_profiles(user_id);
CREATE INDEX idx_candidate_profiles_shadow ON candidate_profiles(is_shadow_profile);
CREATE INDEX idx_candidate_profiles_fec ON candidate_profiles(fec_candidate_id);
CREATE INDEX idx_candidate_profiles_open_states ON candidate_profiles(open_states_id);

-- =====================================================
-- ELECTIONS & RACES
-- =====================================================

CREATE TABLE elections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    election_date DATE NOT NULL,
    election_type VARCHAR(50) CHECK (election_type IN ('general', 'primary', 'special', 'runoff')),
    
    -- Registration deadlines
    registration_deadline DATE,
    early_voting_start DATE,
    early_voting_end DATE,
    
    -- Scope
    scope VARCHAR(20) CHECK (scope IN ('federal', 'state', 'county', 'city', 'township', 'district')),
    state VARCHAR(2),
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_elections_date ON elections(election_date);
CREATE INDEX idx_elections_state ON elections(state);

CREATE TABLE offices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    office_level VARCHAR(20) CHECK (office_level IN ('federal', 'state', 'county', 'city', 'township', 'district')),
    
    -- Location scope
    state VARCHAR(2),
    county VARCHAR(100),
    city VARCHAR(100),
    district VARCHAR(100),
    
    -- Term info
    term_length_years INTEGER,
    
    -- For sorting/display
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_offices_level ON offices(office_level);
CREATE INDEX idx_offices_location ON offices(state, county, city);

CREATE TABLE races (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID REFERENCES elections(id) ON DELETE CASCADE,
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    
    -- Race details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Seat info
    seat_number INTEGER DEFAULT 1,
    total_seats INTEGER DEFAULT 1,
    seats_available INTEGER DEFAULT 1,
    is_special_election BOOLEAN DEFAULT FALSE,
    
    -- Filing info
    filing_deadline DATE,
    
    -- Current holder (for reference)
    incumbent_id UUID REFERENCES candidate_profiles(id),
    is_open_seat BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_races_election ON races(election_id);
CREATE INDEX idx_races_office ON races(office_id);

-- =====================================================
-- CANDIDATE-RACE RELATIONSHIP
-- =====================================================

CREATE TABLE candidacies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    race_id UUID REFERENCES races(id) ON DELETE CASCADE,
    
    -- Filing status
    filing_status VARCHAR(20) CHECK (filing_status IN ('exploring', 'filed', 'certified', 'withdrawn')),
    filed_at DATE,
    
    -- Results (after election)
    votes_received INTEGER,
    vote_percentage DECIMAL(5,2),
    result VARCHAR(20) CHECK (result IN ('won', 'lost', 'runoff', 'pending')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(candidate_id, race_id)
);

CREATE INDEX idx_candidacies_candidate ON candidacies(candidate_id);
CREATE INDEX idx_candidacies_race ON candidacies(race_id);

-- =====================================================
-- ISSUE POSITIONS
-- =====================================================

CREATE TABLE issue_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    
    -- Which office levels this applies to
    applies_to_federal BOOLEAN DEFAULT TRUE,
    applies_to_state BOOLEAN DEFAULT TRUE,
    applies_to_local BOOLEAN DEFAULT TRUE,
    
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES issue_categories(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    question_text TEXT,
    
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_issues_category ON issues(category_id);

CREATE TABLE candidate_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    
    -- Position
    stance VARCHAR(20) CHECK (stance IN ('support', 'oppose', 'complicated')),
    explanation VARCHAR(500),
    
    -- Priority (1-5, NULL if not prioritized)
    priority_rank INTEGER CHECK (priority_rank BETWEEN 1 AND 5),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(candidate_id, issue_id)
);

CREATE INDEX idx_candidate_positions_candidate ON candidate_positions(candidate_id);
CREATE INDEX idx_candidate_positions_issue ON candidate_positions(issue_id);

-- =====================================================
-- Q&A SYSTEM
-- =====================================================

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    asked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    question_text TEXT NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'rejected', 'flagged')),
    
    -- Engagement
    upvote_count INTEGER DEFAULT 0,
    
    -- Moderation
    is_flagged BOOLEAN DEFAULT FALSE,
    flagged_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP
);

CREATE INDEX idx_questions_candidate ON questions(candidate_id);
CREATE INDEX idx_questions_status ON questions(status);
CREATE INDEX idx_questions_upvotes ON questions(upvote_count DESC);

CREATE TABLE question_upvotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(question_id, user_id)
);

CREATE TABLE answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    
    answer_text TEXT NOT NULL,
    
    -- Moderation
    is_flagged BOOLEAN DEFAULT FALSE,
    flagged_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_answers_question ON answers(question_id);

-- =====================================================
-- POSTS & UPDATES
-- =====================================================

CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    
    title VARCHAR(255),
    content TEXT NOT NULL,
    
    -- Type
    post_type VARCHAR(20) DEFAULT 'update' CHECK (post_type IN ('update', 'announcement', 'position')),
    
    -- Media (stored in S3)
    media_urls TEXT[], -- Array of URLs
    
    -- Engagement
    view_count INTEGER DEFAULT 0,
    
    -- Moderation
    is_flagged BOOLEAN DEFAULT FALSE,
    flagged_reason TEXT,
    is_published BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_posts_candidate ON posts(candidate_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);

-- =====================================================
-- TOWN HALLS
-- =====================================================

CREATE TABLE town_halls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Type
    format VARCHAR(20) CHECK (format IN ('video', 'text_ama')),
    
    -- Scheduling
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    
    -- Status
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
    
    -- Video details (if video format)
    stream_url VARCHAR(500),
    
    -- Archive
    recording_url VARCHAR(500),
    transcript TEXT,
    
    -- Attendance (for verified voters restriction)
    restrict_to_district BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_town_halls_candidate ON town_halls(candidate_id);
CREATE INDEX idx_town_halls_scheduled ON town_halls(scheduled_at);
CREATE INDEX idx_town_halls_status ON town_halls(status);

CREATE TABLE town_hall_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    town_hall_id UUID REFERENCES town_halls(id) ON DELETE CASCADE,
    asked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    question_text TEXT NOT NULL,
    
    -- Pre-submitted or live
    is_presubmitted BOOLEAN DEFAULT FALSE,
    
    -- Was it answered during the event
    was_answered BOOLEAN DEFAULT FALSE,
    answered_at TIMESTAMP,
    
    upvote_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_town_hall_questions_event ON town_hall_questions(town_hall_id);

CREATE TABLE town_hall_question_upvotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES town_hall_questions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(question_id, user_id)
);

-- =====================================================
-- PROMISE TRACKER
-- =====================================================

CREATE TABLE promises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    
    promise_text TEXT NOT NULL,
    category_id UUID REFERENCES issue_categories(id),
    
    -- Locked after election win
    is_locked BOOLEAN DEFAULT FALSE,
    locked_at TIMESTAMP,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'kept', 'broken', 'in_progress', 'compromised')),
    status_explanation TEXT,
    status_updated_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promises_candidate ON promises(candidate_id);
CREATE INDEX idx_promises_status ON promises(status);

-- =====================================================
-- VOTING RECORDS
-- =====================================================

CREATE TABLE voting_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    
    -- External reference
    external_vote_id VARCHAR(255),
    source VARCHAR(50) CHECK (source IN ('propublica', 'openstates', 'govtrack', 'manual')),
    
    -- Vote details
    bill_id VARCHAR(100),
    bill_name VARCHAR(500),
    bill_description TEXT,
    
    vote VARCHAR(20) CHECK (vote IN ('yes', 'no', 'abstain', 'not_voting', 'present')),
    vote_date DATE,
    
    -- Link to promise (if applicable)
    related_promise_id UUID REFERENCES promises(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_voting_records_candidate ON voting_records(candidate_id);
CREATE INDEX idx_voting_records_date ON voting_records(vote_date DESC);

-- =====================================================
-- BILLS & SPONSORSHIPS
-- =====================================================

CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bills_state ON bills(state);
CREATE INDEX idx_bills_external_id ON bills(external_id);
CREATE INDEX idx_bills_bill_number ON bills(bill_number, state);

CREATE TABLE bill_sponsorships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(candidate_id, bill_id, sponsorship_type)
);

CREATE INDEX idx_sponsorships_candidate ON bill_sponsorships(candidate_id);
CREATE INDEX idx_sponsorships_bill ON bill_sponsorships(bill_id);
CREATE INDEX idx_sponsorships_type ON bill_sponsorships(sponsorship_type);

CREATE TABLE vote_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(100),
    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
    chamber VARCHAR(20),
    vote_date DATE,
    description TEXT,
    result VARCHAR(20),
    yes_count INTEGER,
    no_count INTEGER,
    other_count INTEGER,
    source VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vote_events_bill ON vote_events(bill_id);
CREATE INDEX idx_vote_events_date ON vote_events(vote_date);

-- =====================================================
-- ENDORSEMENTS (Candidate to Candidate only)
-- =====================================================

CREATE TABLE endorsements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endorser_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    endorsed_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    
    endorsement_text TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(endorser_id, endorsed_id)
);

CREATE INDEX idx_endorsements_endorser ON endorsements(endorser_id);
CREATE INDEX idx_endorsements_endorsed ON endorsements(endorsed_id);

-- =====================================================
-- FOLLOWING
-- =====================================================

CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    
    -- Notification preferences for this follow
    notify_posts BOOLEAN DEFAULT TRUE,
    notify_qa BOOLEAN DEFAULT TRUE,
    notify_town_halls BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, candidate_id)
);

CREATE INDEX idx_follows_user ON follows(user_id);
CREATE INDEX idx_follows_candidate ON follows(candidate_id);

-- =====================================================
-- USER CONNECTIONS (Friend system)
-- =====================================================

CREATE TABLE connection_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
    requested_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    
    UNIQUE(requester_id, requested_id)
);

CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_a_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user_b_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_a_id, user_b_id)
);

-- =====================================================
-- VOTING GUIDE
-- =====================================================

CREATE TABLE voting_guides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    election_id UUID REFERENCES elections(id) ON DELETE CASCADE,
    
    name VARCHAR(255) DEFAULT 'My Voting Guide',
    is_public BOOLEAN DEFAULT FALSE,
    share_code VARCHAR(20) UNIQUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, election_id)
);

CREATE TABLE voting_guide_picks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guide_id UUID REFERENCES voting_guides(id) ON DELETE CASCADE,
    race_id UUID REFERENCES races(id) ON DELETE CASCADE,
    
    -- Their pick
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
    
    -- Or undecided
    is_undecided BOOLEAN DEFAULT FALSE,
    
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(guide_id, race_id)
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    message TEXT,
    
    -- Reference to related entity
    reference_type VARCHAR(50),
    reference_id UUID,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    -- Email sent
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- =====================================================
-- NOTIFICATION PREFERENCES
-- =====================================================

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    
    -- In-app (always on, these control email)
    email_question_answered BOOLEAN DEFAULT TRUE,
    email_new_candidate_area BOOLEAN DEFAULT TRUE,
    email_election_reminder BOOLEAN DEFAULT TRUE,
    email_followed_post BOOLEAN DEFAULT FALSE,
    email_followed_town_hall BOOLEAN DEFAULT TRUE,
    email_registration_deadline BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MODERATION
-- =====================================================

CREATE TABLE moderation_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- What was flagged
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    
    -- Who flagged
    flagged_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    flagged_by_ai BOOLEAN DEFAULT FALSE,
    
    reason VARCHAR(100),
    details TEXT,
    
    -- Resolution
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
    reviewed_by_admin_id UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    action_taken VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_moderation_flags_status ON moderation_flags(status);
CREATE INDEX idx_moderation_flags_content ON moderation_flags(content_type, content_id);

CREATE TABLE community_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- What content this note is on
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    
    -- The note
    note_text TEXT NOT NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Voting
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    
    -- Status
    is_visible BOOLEAN DEFAULT FALSE, -- Only visible once enough helpful votes
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_notes_content ON community_notes(content_type, content_id);

-- =====================================================
-- SESSIONS & AUTH
-- =====================================================

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    token_hash VARCHAR(255) NOT NULL,
    
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);

CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    token_hash VARCHAR(255) NOT NULL,
    
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    token_hash VARCHAR(255) NOT NULL,
    
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- DATA SOURCES & SYNC TRACKING
-- =====================================================

CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    base_url VARCHAR(500),
    api_key_env_var VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP,
    last_sync_status VARCHAR(50),
    last_sync_error TEXT,
    sync_frequency_hours INTEGER DEFAULT 24,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sync_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'running',
    records_fetched INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_unchanged INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    error_log TEXT,
    metadata JSONB
);

CREATE INDEX idx_sync_runs_source ON sync_runs(data_source_id);
CREATE INDEX idx_sync_runs_status ON sync_runs(status);

CREATE TABLE candidate_source_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
    external_id VARCHAR(100) NOT NULL,
    external_data JSONB,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verification_status VARCHAR(50) DEFAULT 'verified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(data_source_id, external_id)
);

CREATE INDEX idx_candidate_source_links_candidate ON candidate_source_links(candidate_id);
CREATE INDEX idx_candidate_source_links_source ON candidate_source_links(data_source_id);
CREATE INDEX idx_candidate_source_links_external ON candidate_source_links(external_id);

-- Seed initial data sources
INSERT INTO data_sources (id, name, display_name, source_type, base_url, api_key_env_var, sync_frequency_hours)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'fec', 'Federal Election Commission', 'api', 'https://api.open.fec.gov/v1', 'FEC_API_KEY', 24),
    ('00000000-0000-0000-0000-000000000002', 'wisconsin_elections', 'Wisconsin Elections Commission', 'scraper', 'https://elections.wi.gov', NULL, 168),
    ('00000000-0000-0000-0000-000000000003', 'ballotpedia', 'Ballotpedia', 'scraper', 'https://ballotpedia.org', NULL, 168)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- AUDIT LOG
-- =====================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    
    entity_type VARCHAR(50),
    entity_id UUID,
    
    old_values JSONB,
    new_values JSONB,
    
    ip_address VARCHAR(45),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- =====================================================
-- SEED DATA: Issue Categories
-- =====================================================

INSERT INTO issue_categories (name, description, icon, sort_order) VALUES
('Economy & Jobs', 'Minimum wage, unions, small business, taxes', 'dollar-sign', 1),
('Education', 'Public school funding, school choice, student debt', 'book-open', 2),
('Healthcare', 'Public option, abortion access, drug pricing', 'heart', 3),
('Environment', 'Climate policy, clean energy, conservation', 'leaf', 4),
('Public Safety', 'Police funding, gun policy, criminal justice reform', 'shield', 5),
('Civil Rights', 'Voting rights, LGBTQ+ rights, discrimination', 'users', 6),
('Immigration', 'Border policy, pathway to citizenship, refugees', 'globe', 7),
('Government & Ethics', 'Term limits, campaign finance, transparency', 'landmark', 8),
('Foreign Policy', 'International relations, military, diplomacy', 'flag', 9),
('Infrastructure', 'Roads, bridges, public transit, broadband', 'building', 10),
('Housing', 'Affordable housing, zoning, homelessness', 'home', 11),
('Local Issues', 'Zoning, utilities, parks, local services', 'map-pin', 12);

-- =====================================================
-- TOWN HALL RSVPS
-- =====================================================

CREATE TABLE town_hall_rsvps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    town_hall_id UUID REFERENCES town_halls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(town_hall_id, user_id)
);

CREATE INDEX idx_town_hall_rsvps_town_hall ON town_hall_rsvps(town_hall_id);
CREATE INDEX idx_town_hall_rsvps_user ON town_hall_rsvps(user_id);

-- =====================================================
-- DISTRICT-COUNTY MAPPING (for federal candidate filtering)
-- =====================================================

CREATE TABLE congressional_districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state VARCHAR(2) NOT NULL,
    district_number INTEGER NOT NULL,
    name VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(state, district_number)
);

CREATE TABLE counties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state VARCHAR(2) NOT NULL,
    name VARCHAR(200) NOT NULL,
    fips_code VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(state, name)
);

CREATE TABLE district_county_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id UUID REFERENCES congressional_districts(id) ON DELETE CASCADE,
    county_id UUID REFERENCES counties(id) ON DELETE CASCADE,
    coverage VARCHAR(20) DEFAULT 'full' CHECK (coverage IN ('full', 'partial')),
    UNIQUE(district_id, county_id)
);

CREATE INDEX idx_district_county_district ON district_county_mappings(district_id);
CREATE INDEX idx_district_county_county ON district_county_mappings(county_id);