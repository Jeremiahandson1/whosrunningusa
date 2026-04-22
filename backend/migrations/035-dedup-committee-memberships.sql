-- Remove duplicate committee_memberships rows introduced by repeated sync
-- runs with a NULL start_date (UNIQUE(candidate_id, committee_id, start_date)
-- treats NULL as distinct across rows). Keep the earliest row per
-- (candidate_id, committee_id); delete the rest.
--
-- Safe to re-run.
DELETE FROM committee_memberships
 WHERE id IN (
   SELECT id FROM (
     SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY candidate_id, committee_id
              ORDER BY created_at ASC, id ASC
            ) AS rn
       FROM committee_memberships
   ) ranked
   WHERE rn > 1
 );
