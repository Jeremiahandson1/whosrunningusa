-- Migration 016: Add cross-reference IDs and photo URL to candidate_profiles

-- Profile photo URL
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- VoteSmart candidate ID for enrichment
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS vote_smart_candidate_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_cp_vote_smart ON candidate_profiles(vote_smart_candidate_id);

-- Congress.gov Bioguide ID for federal legislators (links to Wikidata, congress-legislators dataset)
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS congress_gov_id VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_cp_congress_gov ON candidate_profiles(congress_gov_id);

-- GovTrack ID
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS govtrack_id VARCHAR(20);

-- Wikipedia article title
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS wikipedia_id VARCHAR(200);

-- Wikidata entity ID (e.g. Q12345)
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS wikidata_id VARCHAR(20);
