-- Sync logs table for tracking automated sync/backup jobs
CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL,        -- 'sync', 'backup', 'sync:fec', 'sync:openstates', etc.
  status VARCHAR(20) NOT NULL DEFAULT 'running',  -- 'running', 'completed', 'failed', 'partial'
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP,
  duration_ms INTEGER,
  steps_total INTEGER DEFAULT 0,
  steps_completed INTEGER DEFAULT 0,
  steps_failed INTEGER DEFAULT 0,
  steps_skipped INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}',           -- Per-step results, error messages, etc.
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_job_type ON sync_logs(job_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at DESC);
