#!/usr/bin/env node

/**
 * Inspect a sync_logs row.
 *
 * Usage:
 *   node scripts/inspect-sync-log.cjs           # latest row
 *   node scripts/inspect-sync-log.cjs 67        # specific id
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set. Check backend/.env.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const idArg = process.argv[2];
  const sql = idArg
    ? `SELECT id, job_type, status, started_at, finished_at, duration_ms,
              steps_total, steps_completed, steps_failed, steps_skipped,
              details, error_message
         FROM sync_logs WHERE id = $1`
    : `SELECT id, job_type, status, started_at, finished_at, duration_ms,
              steps_total, steps_completed, steps_failed, steps_skipped,
              details, error_message
         FROM sync_logs ORDER BY started_at DESC LIMIT 1`;

  const { rows } = await pool.query(sql, idArg ? [idArg] : []);
  if (!rows.length) {
    console.log(idArg ? `No sync_logs row with id ${idArg}.` : 'sync_logs is empty.');
    await pool.end();
    return;
  }

  const row = rows[0];
  console.log(`=== sync_logs #${row.id} ===`);
  console.log(`job_type:        ${row.job_type}`);
  console.log(`status:          ${row.status}`);
  console.log(`started_at:      ${row.started_at?.toISOString?.() || row.started_at}`);
  console.log(`finished_at:     ${row.finished_at?.toISOString?.() || row.finished_at}`);
  console.log(`duration_ms:     ${row.duration_ms}`);
  console.log(`steps total/ok/failed/skipped: ${row.steps_total} / ${row.steps_completed} / ${row.steps_failed} / ${row.steps_skipped}`);

  console.log('\n--- Failed steps ---');
  const details = row.details || {};
  const failed = Object.entries(details).filter(([, v]) => v && v.status === 'failed');
  if (failed.length === 0) {
    console.log('(none recorded in details)');
  } else {
    for (const [step, info] of failed) {
      const secs = info.duration_ms != null ? (info.duration_ms / 1000).toFixed(1) + 's' : '?';
      console.log(`\n[${step}] (${secs})`);
      console.log(info.error || '(no error message)');
    }
  }

  console.log('\n--- error_message ---');
  console.log(row.error_message || '(null)');

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  pool.end().catch(() => {});
  process.exit(1);
});
