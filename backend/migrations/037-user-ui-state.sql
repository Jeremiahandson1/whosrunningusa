-- Migration 037: per-user UI state
-- Stores small client-side preferences (modal-seen flags, last-picked
-- election, etc.) on the user row so they survive across devices and
-- ephemeral browser sessions where localStorage doesn't persist.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ui_state JSONB NOT NULL DEFAULT '{}'::jsonb;
