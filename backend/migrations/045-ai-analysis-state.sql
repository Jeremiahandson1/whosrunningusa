-- Migration 045: cost controls for the nightly AI generators.
--
-- ai_analysis_state: per-politician, per-job "last analyzed" marker. Without
-- it, generate-accountability-gaps re-analyzed every eligible politician
-- (~445) every night, and generate-donor-vote-map re-analyzed every
-- politician whose previous analysis found zero connections. A bare
-- NOT EXISTS on the output tables can't express "already looked, found
-- nothing" — only a timestamp can. Generators re-analyze after 30 days.
--
-- ai_batch_jobs: tracks Anthropic Message Batches submitted by the
-- generators (50% cheaper than synchronous calls). A batch not finished
-- within a run's poll budget is collected by the next night's run, so the
-- batch id must survive the process.

CREATE TABLE IF NOT EXISTS ai_analysis_state (
    politician_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    job_type VARCHAR(40) NOT NULL,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (politician_id, job_type)
);

CREATE TABLE IF NOT EXISTS ai_batch_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type VARCHAR(40) NOT NULL,
    batch_id VARCHAR(120) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_batch_jobs_pending
    ON ai_batch_jobs (job_type) WHERE status = 'pending';
