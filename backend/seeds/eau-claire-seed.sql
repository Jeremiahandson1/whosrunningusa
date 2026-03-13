-- =============================================================================
-- EAU CLAIRE, WISCONSIN TEST DATA SEED
-- =============================================================================
-- Run in pgAdmin Query Tool
-- =============================================================================

-- =============================================================================
-- ELECTION
-- =============================================================================

INSERT INTO elections (id, name, election_date, election_type, scope, state, registration_deadline, early_voting_start, early_voting_end, is_active)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Wisconsin Spring Election 2025', '2025-04-01', 'general', 'state', 'WI', '2025-03-12', '2025-03-18', '2025-03-30', TRUE),
  ('22222222-2222-2222-2222-222222222222', 'Wisconsin General Election 2026', '2026-11-03', 'general', 'state', 'WI', '2026-10-14', '2026-10-20', '2026-11-01', TRUE)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  election_date = EXCLUDED.election_date;

-- =============================================================================
-- OFFICES - Multiple levels with city data
-- =============================================================================

-- City of Eau Claire offices
INSERT INTO offices (id, name, office_level, state, county, city, term_length_years, sort_order)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Mayor', 'city', 'WI', 'Eau Claire', 'Eau Claire', 4, 10),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', 'City Council President', 'city', 'WI', 'Eau Claire', 'Eau Claire', 2, 20),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', 'City Council District 1', 'city', 'WI', 'Eau Claire', 'Eau Claire', 2, 30),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03', 'City Council District 2', 'city', 'WI', 'Eau Claire', 'Eau Claire', 2, 31),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04', 'City Council District 3', 'city', 'WI', 'Eau Claire', 'Eau Claire', 2, 32)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- City of Altoona offices (another city in Eau Claire County)
INSERT INTO offices (id, name, office_level, state, county, city, term_length_years, sort_order)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa05', 'Mayor', 'city', 'WI', 'Eau Claire', 'Altoona', 4, 10),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa06', 'City Council At-Large', 'city', 'WI', 'Eau Claire', 'Altoona', 2, 20)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Eau Claire County offices
INSERT INTO offices (id, name, office_level, state, county, city, term_length_years, sort_order)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'County Executive', 'county', 'WI', 'Eau Claire', NULL, 4, 10),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'County Board Supervisor District 1', 'county', 'WI', 'Eau Claire', NULL, 2, 20),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', 'County Board Supervisor District 2', 'county', 'WI', 'Eau Claire', NULL, 2, 21),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'District Attorney', 'county', 'WI', 'Eau Claire', NULL, 4, 30),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04', 'Sheriff', 'county', 'WI', 'Eau Claire', NULL, 4, 40),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05', 'County Clerk', 'county', 'WI', 'Eau Claire', NULL, 4, 50)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- School District offices (district level with city)
INSERT INTO offices (id, name, office_level, state, county, city, district, term_length_years, sort_order)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', 'School Board Seat 1', 'district', 'WI', 'Eau Claire', 'Eau Claire', 'Eau Claire Area School District', 3, 10),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02', 'School Board Seat 2', 'district', 'WI', 'Eau Claire', 'Eau Claire', 'Eau Claire Area School District', 3, 11),
  ('cccccccc-cccc-cccc-cccc-cccccccccc03', 'School Board Seat 3', 'district', 'WI', 'Eau Claire', 'Eau Claire', 'Eau Claire Area School District', 3, 12)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- State Legislature (representing Eau Claire area)
INSERT INTO offices (id, name, office_level, state, county, city, district, term_length_years, sort_order)
VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddd01', 'State Assembly District 91', 'state', 'WI', NULL, NULL, '91', 2, 10),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', 'State Assembly District 92', 'state', 'WI', NULL, NULL, '92', 2, 11),
  ('dddddddd-dddd-dddd-dddd-dddddddddd03', 'State Senate District 23', 'state', 'WI', NULL, NULL, '23', 4, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- =============================================================================
-- RACES - Link offices to elections
-- =============================================================================

-- Spring 2025 races
INSERT INTO races (id, election_id, office_id, name, description, seats_available, filing_deadline)
VALUES
  -- City of Eau Claire
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Eau Claire Mayor', 'Race for Mayor of Eau Claire', 1, '2025-01-02'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', 'City Council District 1', 'Race for City Council District 1', 1, '2025-01-02'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03', 'City Council District 2', 'Race for City Council District 2', 1, '2025-01-02'),
  
  -- City of Altoona
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa05', 'Altoona Mayor', 'Race for Mayor of Altoona', 1, '2025-01-02'),
  
  -- County
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'County Board District 1', 'Race for County Board Supervisor District 1', 1, '2025-01-02'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee06', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', 'County Board District 2', 'Race for County Board Supervisor District 2', 1, '2025-01-02'),
  
  -- School Board
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee07', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccc01', 'ECASD School Board Seat 1', 'Eau Claire Area School District Board Election', 1, '2025-01-02'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee08', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccc02', 'ECASD School Board Seat 2', 'Eau Claire Area School District Board Election', 1, '2025-01-02')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 2026 General Election races
INSERT INTO races (id, election_id, office_id, name, description, seats_available, filing_deadline)
VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee09', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'State Assembly District 91', 'Wisconsin State Assembly race', 1, '2026-06-01'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee0a', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'State Assembly District 92', 'Wisconsin State Assembly race', 1, '2026-06-01'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee0b', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'County Executive', 'Eau Claire County Executive race', 1, '2026-06-01'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee0c', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'District Attorney', 'Eau Claire County District Attorney race', 1, '2026-06-01'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee0d', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04', 'Sheriff', 'Eau Claire County Sheriff race', 1, '2026-06-01')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- =============================================================================
-- CANDIDATE PROFILES
-- =============================================================================

INSERT INTO candidate_profiles (id, user_id, identity_verified, candidate_verified, is_shadow_profile, display_name, official_title, party_affiliation, campaign_website, full_bio, is_active)
VALUES
  -- Eau Claire Mayor candidates
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', NULL, TRUE, TRUE, TRUE, 'Sarah Mitchell', 'Mayor of Eau Claire', 'Non-Partisan', 'https://mitchellformayor.com', 'Current Mayor seeking re-election. Focused on downtown development and sustainable growth.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff01', NULL, FALSE, TRUE, FALSE, 'James Rodriguez', NULL, 'Non-Partisan', 'https://jamesforec.com', 'Local business owner and community advocate. Promises to bring fiscal responsibility to city hall.', TRUE),
  
  -- City Council District 1
  ('ffffffff-ffff-ffff-ffff-ffffffffff02', NULL, TRUE, TRUE, TRUE, 'Emily Chen', 'City Council Member', 'Non-Partisan', NULL, 'Incumbent council member representing District 1. Focus on neighborhood safety and parks.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff03', NULL, FALSE, TRUE, FALSE, 'Michael Thompson', NULL, 'Non-Partisan', NULL, 'Retired teacher running to improve city services and reduce property taxes.', TRUE),
  
  -- City Council District 2
  ('ffffffff-ffff-ffff-ffff-ffffffffff04', NULL, FALSE, TRUE, FALSE, 'Lisa Park', NULL, 'Non-Partisan', NULL, 'Environmental engineer focused on climate resilience and green infrastructure.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff05', NULL, FALSE, TRUE, FALSE, 'Robert Williams', NULL, 'Non-Partisan', NULL, 'Small business owner advocating for economic development.', TRUE),
  
  -- Altoona Mayor
  ('ffffffff-ffff-ffff-ffff-ffffffffff06', NULL, TRUE, TRUE, TRUE, 'Karen Johnson', 'Mayor of Altoona', 'Non-Partisan', NULL, 'Current Mayor of Altoona. Focused on managing growth while maintaining small-town feel.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff07', NULL, FALSE, TRUE, FALSE, 'David Brown', NULL, 'Non-Partisan', NULL, 'Local developer pushing for more housing and infrastructure improvements.', TRUE),
  
  -- County Board candidates
  ('ffffffff-ffff-ffff-ffff-ffffffffff08', NULL, TRUE, TRUE, TRUE, 'Patricia Garcia', 'County Board Supervisor', 'Non-Partisan', NULL, 'Incumbent supervisor. Focused on county budget and rural services.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff09', NULL, FALSE, TRUE, FALSE, 'Thomas Anderson', NULL, 'Non-Partisan', NULL, 'Farm owner running on property tax reform and road maintenance.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff0a', NULL, FALSE, TRUE, FALSE, 'Jennifer Lee', NULL, 'Non-Partisan', NULL, 'Social worker advocating for mental health services expansion.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff0b', NULL, FALSE, TRUE, FALSE, 'Mark Wilson', NULL, 'Non-Partisan', NULL, 'Business consultant focused on economic development in the county.', TRUE),
  
  -- School Board candidates
  ('ffffffff-ffff-ffff-ffff-ffffffffff0c', NULL, TRUE, TRUE, TRUE, 'Susan Miller', 'ECASD School Board Member', 'Non-Partisan', NULL, 'Current school board member. Former teacher with 20 years experience.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff0d', NULL, FALSE, TRUE, FALSE, 'Daniel Martinez', NULL, 'Non-Partisan', NULL, 'Parent and IT professional. Focused on technology in education.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff0e', NULL, FALSE, TRUE, FALSE, 'Amanda White', NULL, 'Non-Partisan', NULL, 'School counselor advocating for student mental health resources.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff0f', NULL, FALSE, TRUE, FALSE, 'Christopher Davis', NULL, 'Non-Partisan', NULL, 'Local business owner pushing for vocational education expansion.', TRUE),
  
  -- State Assembly candidates
  ('ffffffff-ffff-ffff-ffff-ffffffffff10', NULL, TRUE, TRUE, TRUE, 'Representative Jodi Emerson', 'State Assembly District 91', 'Democrat', 'https://jodiemerson.com', 'Incumbent State Representative. Focus on healthcare and education funding.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff11', NULL, FALSE, TRUE, FALSE, 'Paul Hansen', NULL, 'Republican', NULL, 'Small business owner running on tax cuts and deregulation.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff12', NULL, TRUE, TRUE, TRUE, 'Representative Warren Petryk', 'State Assembly District 92', 'Republican', NULL, 'Incumbent State Representative. Focused on agriculture and rural development.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff13', NULL, FALSE, TRUE, FALSE, 'Maria Santos', NULL, 'Democrat', NULL, 'Nurse and union member running on healthcare access.', TRUE),
  
  -- County Executive / DA / Sheriff (2026)
  ('ffffffff-ffff-ffff-ffff-ffffffffff14', NULL, TRUE, TRUE, TRUE, 'Nick Smiar', 'Eau Claire County Executive', 'Non-Partisan', NULL, 'Current County Executive seeking re-election.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff15', NULL, FALSE, TRUE, FALSE, 'Jessica Taylor', NULL, 'Non-Partisan', NULL, 'County department head challenging for the executive position.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff16', NULL, TRUE, TRUE, TRUE, 'Peter Rindal', 'Eau Claire County District Attorney', 'Non-Partisan', NULL, 'Current District Attorney. Focused on criminal justice reform.', TRUE),
  ('ffffffff-ffff-ffff-ffff-ffffffffff17', NULL, TRUE, TRUE, TRUE, 'Ron Cramer', 'Eau Claire County Sheriff', 'Non-Partisan', NULL, 'Current Sheriff focused on community policing.', TRUE)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, is_active = TRUE;

-- =============================================================================
-- CANDIDACIES - Link candidates to races
-- =============================================================================

INSERT INTO candidacies (id, candidate_id, race_id, filing_status, filed_at)
VALUES
  -- Eau Claire Mayor race
  ('00000000-0000-0000-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', 'certified', '2024-12-15'),
  ('00000000-0000-0000-0001-000000000002', 'ffffffff-ffff-ffff-ffff-ffffffffff01', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', 'certified', '2024-12-20'),
  
  -- City Council District 1
  ('00000000-0000-0000-0001-000000000003', 'ffffffff-ffff-ffff-ffff-ffffffffff02', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', 'certified', '2024-12-10'),
  ('00000000-0000-0000-0001-000000000004', 'ffffffff-ffff-ffff-ffff-ffffffffff03', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', 'certified', '2024-12-22'),
  
  -- City Council District 2
  ('00000000-0000-0000-0001-000000000005', 'ffffffff-ffff-ffff-ffff-ffffffffff04', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', 'certified', '2024-12-18'),
  ('00000000-0000-0000-0001-000000000006', 'ffffffff-ffff-ffff-ffff-ffffffffff05', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', 'certified', '2024-12-19'),
  
  -- Altoona Mayor
  ('00000000-0000-0000-0001-000000000007', 'ffffffff-ffff-ffff-ffff-ffffffffff06', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', 'certified', '2024-12-05'),
  ('00000000-0000-0000-0001-000000000008', 'ffffffff-ffff-ffff-ffff-ffffffffff07', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', 'certified', '2024-12-28'),
  
  -- County Board District 1
  ('00000000-0000-0000-0001-000000000009', 'ffffffff-ffff-ffff-ffff-ffffffffff08', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', 'certified', '2024-12-01'),
  ('00000000-0000-0000-0001-00000000000a', 'ffffffff-ffff-ffff-ffff-ffffffffff09', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', 'certified', '2024-12-15'),
  
  -- County Board District 2
  ('00000000-0000-0000-0001-00000000000b', 'ffffffff-ffff-ffff-ffff-ffffffffff0a', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee06', 'certified', '2024-12-12'),
  ('00000000-0000-0000-0001-00000000000c', 'ffffffff-ffff-ffff-ffff-ffffffffff0b', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee06', 'certified', '2024-12-20'),
  
  -- School Board Seat 1
  ('00000000-0000-0000-0001-00000000000d', 'ffffffff-ffff-ffff-ffff-ffffffffff0c', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee07', 'certified', '2024-11-30'),
  ('00000000-0000-0000-0001-00000000000e', 'ffffffff-ffff-ffff-ffff-ffffffffff0d', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee07', 'certified', '2024-12-20'),
  
  -- School Board Seat 2
  ('00000000-0000-0000-0001-00000000000f', 'ffffffff-ffff-ffff-ffff-ffffffffff0e', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee08', 'certified', '2024-12-10'),
  ('00000000-0000-0000-0001-000000000010', 'ffffffff-ffff-ffff-ffff-ffffffffff0f', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee08', 'certified', '2024-12-22'),
  
  -- State Assembly District 91
  ('00000000-0000-0000-0001-000000000011', 'ffffffff-ffff-ffff-ffff-ffffffffff10', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee09', 'filed', '2026-04-01'),
  ('00000000-0000-0000-0001-000000000012', 'ffffffff-ffff-ffff-ffff-ffffffffff11', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee09', 'exploring', NULL),
  
  -- State Assembly District 92
  ('00000000-0000-0000-0001-000000000013', 'ffffffff-ffff-ffff-ffff-ffffffffff12', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee0a', 'filed', '2026-04-01'),
  ('00000000-0000-0000-0001-000000000014', 'ffffffff-ffff-ffff-ffff-ffffffffff13', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee0a', 'exploring', NULL),
  
  -- County Executive
  ('00000000-0000-0000-0001-000000000015', 'ffffffff-ffff-ffff-ffff-ffffffffff14', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee0b', 'filed', '2026-04-01'),
  ('00000000-0000-0000-0001-000000000016', 'ffffffff-ffff-ffff-ffff-ffffffffff15', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee0b', 'exploring', NULL),
  
  -- District Attorney
  ('00000000-0000-0000-0001-000000000017', 'ffffffff-ffff-ffff-ffff-ffffffffff16', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee0c', 'filed', '2026-04-01'),
  
  -- Sheriff
  ('00000000-0000-0000-0001-000000000018', 'ffffffff-ffff-ffff-ffff-ffffffffff17', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee0d', 'filed', '2026-04-01')
ON CONFLICT (id) DO UPDATE SET filing_status = EXCLUDED.filing_status;

-- =============================================================================
-- SUMMARY
-- =============================================================================
SELECT 'Seed complete!' as status;
SELECT 'Elections:' as type, COUNT(*) as count FROM elections WHERE state = 'WI';
SELECT 'Offices:' as type, COUNT(*) as count FROM offices WHERE state = 'WI';
SELECT 'Races:' as type, COUNT(*) as count FROM races;
SELECT 'Candidates:' as type, COUNT(*) as count FROM candidate_profiles WHERE is_active = TRUE;
SELECT 'Cities in Eau Claire County:' as info, string_agg(DISTINCT city, ', ') as cities FROM offices WHERE state = 'WI' AND county = 'Eau Claire' AND city IS NOT NULL;