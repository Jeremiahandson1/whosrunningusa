-- Migration 014: Add social media columns to candidate_profiles
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100);
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS youtube_handle VARCHAR(100);
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500);
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS tiktok_handle VARCHAR(100);
