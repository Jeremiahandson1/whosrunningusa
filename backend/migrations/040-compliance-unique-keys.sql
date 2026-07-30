-- Migration 040: dedupe transparency_requirements / compliance_records and
-- add the unique keys that stop nightly regrowth.
--
-- seed-transparency-requirements.cjs inserted into both tables with a bare
-- ON CONFLICT DO NOTHING, but neither table had a unique key — so nothing
-- ever conflicted. Every nightly run added a full copy of all 18
-- requirements, and the politicians × requirements baseline cross-join
-- multiplied against every copy (18.5M rows / 5.3 GB in production, 95% of
-- the database, before cleanup).
--
-- Production was rebuilt out-of-band with
-- backend/scripts/rebuild-compliance-records.js (drop-and-swap — cheaper
-- than DELETE churn at that scale); this migration converges other
-- environments and is a no-op where the cleanup already ran.

SET statement_timeout = '600s';

-- 1. Canonicalize transparency_requirements (keep the earliest copy of each
--    distinct requirement) and re-point referencing rows.
CREATE TEMP TABLE _req_canon AS
SELECT DISTINCT ON (jurisdiction_type, COALESCE(state, ''), requirement_type, title)
       id AS canon_id
  FROM transparency_requirements
 ORDER BY jurisdiction_type, COALESCE(state, ''), requirement_type, title, created_at, id;

CREATE TEMP TABLE _req_map AS
SELECT tr.id AS old_id, canon.id AS canon_id
  FROM transparency_requirements tr
  JOIN transparency_requirements canon
    ON canon.jurisdiction_type = tr.jurisdiction_type
   AND COALESCE(canon.state, '') = COALESCE(tr.state, '')
   AND canon.requirement_type = tr.requirement_type
   AND canon.title = tr.title
  JOIN _req_canon rc ON rc.canon_id = canon.id
 WHERE tr.id <> canon.id;

UPDATE compliance_records cr SET requirement_id = m.canon_id
  FROM _req_map m
 WHERE cr.requirement_id = m.old_id;

DELETE FROM transparency_requirements
 WHERE id IN (SELECT old_id FROM _req_map);

-- 2. Keep only the most recently checked compliance row per
--    (politician, requirement).
DELETE FROM compliance_records cr
 USING compliance_records cr2
 WHERE cr.politician_id = cr2.politician_id
   AND cr.requirement_id = cr2.requirement_id
   AND cr.id <> cr2.id
   AND (cr.last_checked < cr2.last_checked
        OR (cr.last_checked IS NULL AND cr2.last_checked IS NOT NULL)
        OR (cr.last_checked IS NOT DISTINCT FROM cr2.last_checked AND cr.id < cr2.id));

-- 3. The unique keys the seeder's ON CONFLICT clauses now target.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transparency_requirement
  ON transparency_requirements (jurisdiction_type, COALESCE(state, ''), requirement_type, title);

CREATE UNIQUE INDEX IF NOT EXISTS uq_compliance_politician_requirement
  ON compliance_records (politician_id, requirement_id);

ANALYZE transparency_requirements;
ANALYZE compliance_records;
