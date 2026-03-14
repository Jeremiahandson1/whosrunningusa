-- Migration 017: Add profile_photo_url column (was missing from 016)
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
