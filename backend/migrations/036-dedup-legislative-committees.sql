-- Clean up duplicate rows in legislative_committees and the memberships
-- pointing at them. Earlier runs of sync-committees.js used ON CONFLICT
-- DO NOTHING on a table with no unique constraint on name, so every run
-- inserted a fresh committee row per committee.
--
-- Strategy:
--   1. For each committee name, pick the earliest row as the canonical one.
--   2. Repoint every committee_memberships row at the canonical committee_id.
--   3. Delete the now-unreferenced duplicate committee rows.
--   4. Dedupe memberships that collapsed onto the same canonical committee.
--
-- Safe to re-run — each step short-circuits when nothing remains to do.

-- 1/2) Repoint memberships to canonical committee_id
WITH canonical AS (
  SELECT DISTINCT ON (name) id AS canonical_id, name
    FROM legislative_committees
   ORDER BY name, created_at ASC, id ASC
)
UPDATE committee_memberships cm
   SET committee_id = canonical.canonical_id
  FROM legislative_committees lc, canonical
 WHERE cm.committee_id = lc.id
   AND lc.name = canonical.name
   AND lc.id <> canonical.canonical_id;

-- 3) Drop now-orphan committee rows
WITH canonical AS (
  SELECT DISTINCT ON (name) id AS canonical_id, name
    FROM legislative_committees
   ORDER BY name, created_at ASC, id ASC
)
DELETE FROM legislative_committees lc
 USING canonical
 WHERE canonical.name = lc.name
   AND canonical.canonical_id <> lc.id;

-- 4) Collapse any memberships that now reference the same committee+candidate
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
