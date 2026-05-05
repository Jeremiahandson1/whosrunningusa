-- Migration 038: composite indexes for transparency aggregations
--
-- The /transparency leaderboard groups by politician_id and computes
-- AVG(compliance_score) plus COUNT(*) FILTER (WHERE compliance_status = X)
-- buckets. /transparency/stats does the equivalent by requirement_type via
-- the requirement_id JOIN. With ~4.6M rows in compliance_records the cold
-- queries were taking 49–80 seconds on a single-column politician_id /
-- requirement_id index plus a full table scan for the score and status
-- columns.
--
-- These covering indexes let the planner satisfy GROUP BY + FILTER + AVG
-- via index-only scans, which is the difference between the pre-warmed
-- cache absorbing the cold miss comfortably vs. flirting with Render's
-- 100s request timeout as the dataset grows.

CREATE INDEX IF NOT EXISTS idx_compliance_politician_status_score
  ON compliance_records (politician_id, compliance_status, compliance_score);

CREATE INDEX IF NOT EXISTS idx_compliance_requirement_status_score
  ON compliance_records (requirement_id, compliance_status, compliance_score);

ANALYZE compliance_records;
