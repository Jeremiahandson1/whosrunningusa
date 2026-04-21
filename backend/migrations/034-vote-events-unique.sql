-- Allow idempotent vote_events upserts by (source, external_id).
-- Safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vote_events_source_external_id_key'
      AND conrelid = 'vote_events'::regclass
  ) THEN
    ALTER TABLE vote_events
      ADD CONSTRAINT vote_events_source_external_id_key UNIQUE (source, external_id);
  END IF;
END $$;
