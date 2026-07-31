-- Migration 043: give vote_explanations real conflict keys.
--
-- generate-vote-explanations.cjs inserts with ON CONFLICT DO NOTHING, but no
-- unique index covered its (vote_event_id) / (bill_id) rows — the same
-- silent-no-op pattern that let transparency_requirements and
-- compliance_records duplicate nightly. Dedupe (keep newest), then add
-- partial unique indexes so the clause actually conflicts.

SET statement_timeout = '600s';

DELETE FROM vote_explanations ve
 USING vote_explanations ve2
 WHERE ve.id <> ve2.id
   AND ve.vote_event_id IS NOT NULL
   AND ve.vote_event_id = ve2.vote_event_id
   AND (ve.created_at < ve2.created_at
        OR (ve.created_at = ve2.created_at AND ve.id::text < ve2.id::text));

DELETE FROM vote_explanations ve
 USING vote_explanations ve2
 WHERE ve.id <> ve2.id
   AND ve.vote_event_id IS NULL AND ve2.vote_event_id IS NULL
   AND ve.bill_id IS NOT NULL
   AND ve.bill_id = ve2.bill_id
   AND (ve.created_at < ve2.created_at
        OR (ve.created_at = ve2.created_at AND ve.id::text < ve2.id::text));

CREATE UNIQUE INDEX IF NOT EXISTS uq_vote_explanations_event
  ON vote_explanations (vote_event_id) WHERE vote_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_vote_explanations_bill
  ON vote_explanations (bill_id) WHERE vote_event_id IS NULL AND bill_id IS NOT NULL;
