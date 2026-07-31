/**
 * Shared Anthropic Message Batches plumbing for the nightly AI generators.
 *
 * Batches run at 50% of synchronous pricing and these jobs have no latency
 * requirement. Flow per generator run:
 *   1. collectPending() — pick up batches submitted by earlier runs (tracked
 *      in ai_batch_jobs) whose results are ready, and process them.
 *   2. submit new work as a batch, poll for up to `pollMs`, and process the
 *      results if the batch finishes in time. If it doesn't, the next run
 *      collects it — nothing is lost (results are retrievable for 29 days).
 *
 * onResult(customId, text) receives the raw model text for each succeeded
 * request and does the parsing/inserting; it should throw on bad JSON so the
 * item is counted as an error.
 */

const POLL_INTERVAL_MS = 30 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Strip markdown fences and parse the model's JSON reply. */
function extractJson(text) {
  let jsonStr = text.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();
  return JSON.parse(jsonStr);
}

/** Run onResult for every request in an ended batch. Returns {ok, failed}. */
async function processBatchResults({ anthropic, batchId, onResult }) {
  let ok = 0;
  let failed = 0;
  for await (const result of await anthropic.messages.batches.results(batchId)) {
    if (result.result.type !== 'succeeded') {
      console.warn(`    [batch] ${result.custom_id}: ${result.result.type}`);
      failed++;
      continue;
    }
    const text = result.result.message.content.find((b) => b.type === 'text')?.text;
    if (!text) { failed++; continue; }
    try {
      await onResult(result.custom_id, text);
      ok++;
    } catch (err) {
      console.warn(`    [batch] ${result.custom_id}: ${err.message}`);
      failed++;
    }
  }
  return { ok, failed };
}

/**
 * Collect every pending batch of this job type whose processing has ended.
 * Returns total {ok, failed} across collected batches.
 */
async function collectPending({ pool, anthropic, jobType, onResult }) {
  const { rows } = await pool.query(
    `SELECT id, batch_id FROM ai_batch_jobs WHERE job_type = $1 AND status = 'pending'`,
    [jobType]
  );
  let ok = 0;
  let failed = 0;
  for (const job of rows) {
    let batch;
    try {
      batch = await anthropic.messages.batches.retrieve(job.batch_id);
    } catch (err) {
      // 404 = batch expired/deleted server-side; close the row out.
      console.warn(`  [batch] ${job.batch_id} unretrievable (${err.status || err.message}) — marking failed`);
      await pool.query(
        `UPDATE ai_batch_jobs SET status = 'failed', completed_at = NOW() WHERE id = $1`,
        [job.id]
      );
      continue;
    }
    if (batch.processing_status !== 'ended') {
      console.log(`  [batch] ${job.batch_id} still ${batch.processing_status} — will collect next run`);
      continue;
    }
    console.log(`  [batch] Collecting ${job.batch_id} (submitted earlier)...`);
    const res = await processBatchResults({ anthropic, batchId: job.batch_id, onResult });
    ok += res.ok;
    failed += res.failed;
    await pool.query(
      `UPDATE ai_batch_jobs SET status = 'done', completed_at = NOW() WHERE id = $1`,
      [job.id]
    );
    console.log(`  [batch] ${job.batch_id}: ${res.ok} ok, ${res.failed} failed`);
  }
  return { ok, failed };
}

/**
 * Submit requests as one batch, record it in ai_batch_jobs, then poll for up
 * to pollMs. If it ends in time, process results and mark done. Returns
 * {batchId, collected: {ok, failed} | null}.
 */
async function submitAndPoll({ pool, anthropic, jobType, requests, pollMs, onResult }) {
  if (requests.length === 0) return { batchId: null, collected: null };

  const batch = await anthropic.messages.batches.create({ requests });
  await pool.query(
    `INSERT INTO ai_batch_jobs (job_type, batch_id) VALUES ($1, $2)`,
    [jobType, batch.id]
  );
  console.log(`  [batch] Submitted ${requests.length} requests as ${batch.id}`);

  const deadline = Date.now() + pollMs;
  let current = batch;
  while (current.processing_status !== 'ended' && Date.now() < deadline) {
    await sleep(Math.min(POLL_INTERVAL_MS, Math.max(1000, deadline - Date.now())));
    current = await anthropic.messages.batches.retrieve(batch.id);
  }

  if (current.processing_status !== 'ended') {
    console.log(`  [batch] ${batch.id} not finished within poll budget — next run will collect it.`);
    return { batchId: batch.id, collected: null };
  }

  const collected = await processBatchResults({ anthropic, batchId: batch.id, onResult });
  await pool.query(
    `UPDATE ai_batch_jobs SET status = 'done', completed_at = NOW() WHERE batch_id = $1`,
    [batch.id]
  );
  console.log(`  [batch] ${batch.id}: ${collected.ok} ok, ${collected.failed} failed`);
  return { batchId: batch.id, collected };
}

/** Parse a --poll-minutes=N flag (default 10). */
function parsePollMs(argv, defaultMinutes = 10) {
  const arg = argv.find((a) => a.startsWith('--poll-minutes='));
  const minutes = arg ? parseFloat(arg.split('=')[1]) : defaultMinutes;
  return Math.max(0, minutes) * 60 * 1000;
}

module.exports = { extractJson, collectPending, submitAndPoll, parsePollMs };
