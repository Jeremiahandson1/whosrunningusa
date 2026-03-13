-- Migration 008: Add town_hall_rsvps table and answers unique constraint

-- Dedicated RSVP table for town halls
CREATE TABLE IF NOT EXISTS town_hall_rsvps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    town_hall_id UUID REFERENCES town_halls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(town_hall_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_town_hall_rsvps_town_hall ON town_hall_rsvps(town_hall_id);
CREATE INDEX IF NOT EXISTS idx_town_hall_rsvps_user ON town_hall_rsvps(user_id);

-- Enforce one answer per question
DROP INDEX IF EXISTS idx_answers_question;
CREATE UNIQUE INDEX idx_answers_question ON answers(question_id);

-- District/county tables (in case migration 003 didn't create them)
CREATE TABLE IF NOT EXISTS congressional_districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state VARCHAR(2) NOT NULL,
    district_number INTEGER NOT NULL,
    name VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(state, district_number)
);

CREATE TABLE IF NOT EXISTS counties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state VARCHAR(2) NOT NULL,
    name VARCHAR(200) NOT NULL,
    fips_code VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(state, name)
);

CREATE TABLE IF NOT EXISTS district_county_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id UUID REFERENCES congressional_districts(id) ON DELETE CASCADE,
    county_id UUID REFERENCES counties(id) ON DELETE CASCADE,
    coverage VARCHAR(20) DEFAULT 'full' CHECK (coverage IN ('full', 'partial')),
    UNIQUE(district_id, county_id)
);

CREATE INDEX IF NOT EXISTS idx_district_county_district ON district_county_mappings(district_id);
CREATE INDEX IF NOT EXISTS idx_district_county_county ON district_county_mappings(county_id);
