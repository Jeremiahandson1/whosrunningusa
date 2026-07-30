-- Migration 042: remove fabricated voter-access scores and gerrymandering
-- data (same policy as migrations 023-026: only real, citable data).
--
-- voter_access_state_scores held hand-assigned 1-100 rankings from
-- seed-voter-access.cjs with no citation or methodology, internally
-- inconsistent with the sourced laws they claimed to summarize, and stamped
-- last_computed_at as if derived. The sourced voter_access_laws/impacts rows
-- are untouched; /voter-access/states now lists states from those.
--
-- district_election_results held synthetic demo vote counts
-- (seed-district-results.cjs, self-described "representative sample for
-- development and demos", ~161 of 435 districts, recycled digits, stamped
-- with never-fetched clerk.house.gov URLs). gerrymandering_metrics were
-- efficiency gaps computed over that fake input — a real formula on fake
-- data is still fake data. Reload from real FEC bulk results before
-- re-running compute-gerrymandering.cjs.

DELETE FROM voter_access_state_scores;
DELETE FROM gerrymandering_metrics;
DELETE FROM district_election_results;
