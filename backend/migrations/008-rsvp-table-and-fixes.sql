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
-- These must match migration 003's column definitions exactly
CREATE TABLE IF NOT EXISTS congressional_districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state_fips VARCHAR(2) NOT NULL,
    state_abbr VARCHAR(2) NOT NULL,
    district_number VARCHAR(2) NOT NULL,
    congress_number INTEGER NOT NULL,
    geoid VARCHAR(4) NOT NULL,
    full_name VARCHAR(100),
    representative_name VARCHAR(200),
    representative_party VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(state_fips, district_number, congress_number)
);

CREATE TABLE IF NOT EXISTS counties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state_fips VARCHAR(2) NOT NULL,
    state_abbr VARCHAR(2) NOT NULL,
    county_fips VARCHAR(3) NOT NULL,
    county_geoid VARCHAR(5) NOT NULL,
    county_name VARCHAR(100) NOT NULL,
    county_full_name VARCHAR(150),
    population_2020 INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(county_geoid)
);

CREATE TABLE IF NOT EXISTS district_county_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id UUID REFERENCES congressional_districts(id) ON DELETE CASCADE,
    state_fips VARCHAR(2) NOT NULL,
    county_fips VARCHAR(3) NOT NULL,
    county_geoid VARCHAR(5) NOT NULL,
    county_name VARCHAR(100) NOT NULL,
    land_area_sq_meters BIGINT,
    land_area_percent DECIMAL(5,2),
    is_full_county BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(district_id, county_geoid)
);

CREATE INDEX IF NOT EXISTS idx_district_county_district ON district_county_mappings(district_id);
CREATE INDEX IF NOT EXISTS idx_district_county_county ON district_county_mappings(county_geoid);
