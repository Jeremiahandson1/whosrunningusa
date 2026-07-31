-- Migration 044: widen vote_events.result for Senate result strings.
-- House Clerk results fit VARCHAR(20) ("Passed", "Failed"); Senate LIS
-- results do not ("Cloture Motion Agreed to", "Joint Resolution Defeated").
ALTER TABLE vote_events ALTER COLUMN result TYPE VARCHAR(100);
