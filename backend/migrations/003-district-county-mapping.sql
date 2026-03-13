-- =============================================================================
-- DISTRICT-COUNTY MAPPINGS MIGRATION
-- =============================================================================
-- Maps congressional districts to counties (many-to-many relationship)
-- Source: Census Bureau 119th Congressional District to County Relationship Files
-- https://www.census.gov/geographies/reference-files/time-series/geo/relationship-files.2020.html

-- Congressional districts table
CREATE TABLE IF NOT EXISTS congressional_districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- District identifiers
    state_fips VARCHAR(2) NOT NULL,       -- State FIPS code (e.g., '55' for Wisconsin)
    state_abbr VARCHAR(2) NOT NULL,       -- State abbreviation (e.g., 'WI')
    district_number VARCHAR(2) NOT NULL,  -- District number (e.g., '01', '02', 'AL' for at-large)
    congress_number INTEGER NOT NULL,     -- Congress session (e.g., 119)
    
    -- Full identifiers
    geoid VARCHAR(4) NOT NULL,            -- State FIPS + District (e.g., '5501')
    full_name VARCHAR(100),               -- e.g., 'Wisconsin Congressional District 1'
    
    -- Representatives (can be updated)
    representative_name VARCHAR(200),
    representative_party VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(state_fips, district_number, congress_number)
);

-- District to county relationship
CREATE TABLE IF NOT EXISTS district_county_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- District reference
    district_id UUID REFERENCES congressional_districts(id) ON DELETE CASCADE,
    
    -- County identifiers (from Census)
    state_fips VARCHAR(2) NOT NULL,
    county_fips VARCHAR(3) NOT NULL,
    county_geoid VARCHAR(5) NOT NULL,     -- State FIPS + County FIPS (e.g., '55035' for Eau Claire)
    county_name VARCHAR(100) NOT NULL,
    
    -- Coverage metrics (from Census relationship file)
    -- These indicate what portion of the county is in this district
    land_area_sq_meters BIGINT,           -- Land area of county portion in district
    land_area_percent DECIMAL(5,2),       -- Percent of county's land in this district
    
    -- Flags
    is_full_county BOOLEAN DEFAULT FALSE, -- True if entire county is in this district
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(district_id, county_geoid)
);

-- County lookup table (for mapping FIPS to names)
CREATE TABLE IF NOT EXISTS counties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    state_fips VARCHAR(2) NOT NULL,
    state_abbr VARCHAR(2) NOT NULL,
    county_fips VARCHAR(3) NOT NULL,
    county_geoid VARCHAR(5) NOT NULL,     -- State FIPS + County FIPS
    county_name VARCHAR(100) NOT NULL,
    county_full_name VARCHAR(150),        -- e.g., 'Eau Claire County, Wisconsin'
    
    -- Population data (optional, for weighting)
    population_2020 INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(county_geoid)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_districts_state ON congressional_districts(state_abbr);
CREATE INDEX IF NOT EXISTS idx_districts_geoid ON congressional_districts(geoid);
CREATE INDEX IF NOT EXISTS idx_district_county_district ON district_county_mappings(district_id);
CREATE INDEX IF NOT EXISTS idx_district_county_county ON district_county_mappings(county_geoid);
CREATE INDEX IF NOT EXISTS idx_district_county_state ON district_county_mappings(state_fips);
CREATE INDEX IF NOT EXISTS idx_counties_state ON counties(state_abbr);
CREATE INDEX IF NOT EXISTS idx_counties_geoid ON counties(county_geoid);
CREATE INDEX IF NOT EXISTS idx_counties_name ON counties(state_abbr, county_name);

-- Helper view: Get districts for a county
CREATE OR REPLACE VIEW county_districts AS
SELECT 
    c.state_abbr,
    c.county_name,
    c.county_geoid,
    cd.district_number,
    cd.full_name as district_name,
    cd.representative_name,
    cd.representative_party,
    dcm.land_area_percent,
    dcm.is_full_county
FROM counties c
JOIN district_county_mappings dcm ON c.county_geoid = dcm.county_geoid
JOIN congressional_districts cd ON dcm.district_id = cd.id
WHERE cd.congress_number = 119;

-- Helper function: Get district numbers for a state/county
CREATE OR REPLACE FUNCTION get_districts_for_county(
    p_state_abbr VARCHAR(2),
    p_county_name VARCHAR(100)
) RETURNS TABLE (
    district_number VARCHAR(2),
    land_area_percent DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cd.district_number,
        dcm.land_area_percent
    FROM counties c
    JOIN district_county_mappings dcm ON c.county_geoid = dcm.county_geoid
    JOIN congressional_districts cd ON dcm.district_id = cd.id
    WHERE c.state_abbr = p_state_abbr
      AND LOWER(c.county_name) = LOWER(p_county_name)
      AND cd.congress_number = 119
    ORDER BY dcm.land_area_percent DESC;
END;
$$ LANGUAGE plpgsql;

SELECT 'District-county mappings migration complete!' as status;