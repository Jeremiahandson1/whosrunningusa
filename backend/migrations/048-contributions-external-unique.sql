-- Unique index on contributions.external_id so the FEC Schedule A sync
-- (scripts/sync-fec-receipts.cjs) can upsert receipts by FEC sub_id.
-- Partial: legacy/manual rows without an external_id are exempt.

CREATE UNIQUE INDEX IF NOT EXISTS idx_contributions_external_id
  ON contributions(external_id)
  WHERE external_id IS NOT NULL;
