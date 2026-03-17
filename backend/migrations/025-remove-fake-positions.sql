-- Remove fabricated candidate positions created by populate-empty-tables.js
-- These showed fake stances (Supports/Opposes) on candidate profiles.
-- Real positions should come from candidates themselves or verified public records.
DELETE FROM candidate_positions;
