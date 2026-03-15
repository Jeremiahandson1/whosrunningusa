#!/usr/bin/env node

/**
 * Automated Sync Scheduler
 *
 * Runs data ingestion scripts and logs results to the sync_logs table.
 * Designed to be invoked as a Render cron job or system cron task.
 *
 * Environment variables:
 *   SYNC_STEPS       — Comma-separated steps to run (default: all)
 *                       Options: districts, fec, openstates, congress, bills
 *   SYNC_STATE       — Limit to a single state (e.g. "CA")
 *   SYNC_FEC_CYCLE   — FEC election cycle year (default: 2026)
 *   SYNC_TIMEOUT_MS  — Per-step timeout in ms (default: 600000 = 10 min)
 *
 * Usage:
 *   node scripts/sync-scheduler.js                         # Run all steps
 *   SYNC_STEPS=fec,openstates node scripts/sync-scheduler.js
 *   SYNC_STATE=CA node scripts/sync-scheduler.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { spawn } = require('child_process');
const path = require('path');
const db = require('../db');

const SCRIPTS_DIR = __dirname;
const STEP_TIMEOUT = parseInt(process.env.SYNC_TIMEOUT_MS) || 1200000; // 20 min default

// Steps in execution order
const ALL_STEPS = ['districts', 'fec', 'openstates', 'congress', 'bills', 'congress-legislators', 'wikidata', 'votesmart'];

function getStepsToRun() {
  const envSteps = process.env.SYNC_STEPS;
  if (envSteps) {
    return envSteps.split(',').map(s => s.trim()).filter(s => ALL_STEPS.includes(s));
  }
  return ALL_STEPS;
}

function buildCommand(step) {
  const state = process.env.SYNC_STATE || null;
  const cycle = process.env.SYNC_FEC_CYCLE || '2026';

  switch (step) {
    case 'districts':
      return ['import-districts.js'];
    case 'fec':
      return ['sync.js', 'fec', `--cycle=${cycle}`, ...(state ? [`--state=${state}`] : [])];
    case 'openstates':
      return ['sync-open-states.js', ...(state ? [state] : [])];
    case 'congress':
      return ['sync-congress-gov.js', '--members', ...(state ? [`--state=${state}`] : [])];
    case 'bills':
      return ['sync-open-states-bills.js', ...(state ? [state] : []), '--recent'];
    case 'congress-legislators':
      return ['sync-congress-legislators.js'];
    case 'wikidata':
      return ['sync-wikidata.js'];
    case 'votesmart':
      return ['sync-votesmart.js', ...(state ? [`--state=${state}`] : [])];
    default:
      return null;
  }
}

function runStep(step) {
  return new Promise((resolve, reject) => {
    const args = buildCommand(step);
    if (!args) {
      return reject(new Error(`Unknown step: ${step}`));
    }

    const scriptPath = path.join(SCRIPTS_DIR, args[0]);
    const scriptArgs = args.slice(1);

    const child = spawn('node', [scriptPath, ...scriptArgs], {
      cwd: SCRIPTS_DIR,
      stdio: 'pipe',
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Step "${step}" timed out after ${STEP_TIMEOUT}ms`));
    }, STEP_TIMEOUT);

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Step "${step}" exited with code ${code}\n${stderr}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function createLogEntry(jobType) {
  const result = await db.query(
    `INSERT INTO sync_logs (job_type, status, started_at)
     VALUES ($1, 'running', NOW())
     RETURNING id`,
    [jobType]
  );
  return result.rows[0].id;
}

async function updateLogEntry(logId, updates) {
  const { status, stepsTotal, stepsCompleted, stepsFailed, stepsSkipped, details, errorMessage } = updates;
  await db.query(
    `UPDATE sync_logs SET
       status = $2,
       finished_at = NOW(),
       duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
       steps_total = $3,
       steps_completed = $4,
       steps_failed = $5,
       steps_skipped = $6,
       details = $7,
       error_message = $8
     WHERE id = $1`,
    [logId, status, stepsTotal, stepsCompleted, stepsFailed, stepsSkipped, JSON.stringify(details), errorMessage]
  );
}

async function main() {
  const steps = getStepsToRun();
  console.log(`=== Sync Scheduler Started ===`);
  console.log(`  Time:  ${new Date().toISOString()}`);
  console.log(`  Steps: ${steps.join(', ')}`);
  if (process.env.SYNC_STATE) {
    console.log(`  State: ${process.env.SYNC_STATE}`);
  }
  console.log('');

  // Ensure sync_logs table exists (migration may not have run yet)
  await db.query(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id SERIAL PRIMARY KEY,
      job_type VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'running',
      started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP,
      duration_ms INTEGER,
      steps_total INTEGER DEFAULT 0,
      steps_completed INTEGER DEFAULT 0,
      steps_failed INTEGER DEFAULT 0,
      steps_skipped INTEGER DEFAULT 0,
      details JSONB DEFAULT '{}',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const logId = await createLogEntry('sync');
  const stepResults = {};
  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepStart = Date.now();
    console.log(`[${i + 1}/${steps.length}] Running: ${step}`);

    try {
      const result = await runStep(step);
      const elapsed = Date.now() - stepStart;
      stepResults[step] = { status: 'completed', duration_ms: elapsed };
      completed++;
      console.log(`  Completed in ${(elapsed / 1000).toFixed(1)}s\n`);
    } catch (err) {
      const elapsed = Date.now() - stepStart;
      stepResults[step] = { status: 'failed', duration_ms: elapsed, error: err.message };
      failed++;
      console.error(`  Failed: ${err.message}\n`);
      // Continue to next step — don't crash the whole scheduler
    }
  }

  const overallStatus = failed === 0 ? 'completed' : (completed > 0 ? 'partial' : 'failed');
  const errorSummary = failed > 0
    ? Object.entries(stepResults)
        .filter(([, r]) => r.status === 'failed')
        .map(([name, r]) => `${name}: ${r.error}`)
        .join('\n')
    : null;

  await updateLogEntry(logId, {
    status: overallStatus,
    stepsTotal: steps.length,
    stepsCompleted: completed,
    stepsFailed: failed,
    stepsSkipped: skipped,
    details: stepResults,
    errorMessage: errorSummary,
  });

  console.log(`=== Sync Scheduler Finished ===`);
  console.log(`  Status:    ${overallStatus}`);
  console.log(`  Completed: ${completed}/${steps.length}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Log ID:    ${logId}`);

  await db.pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Sync scheduler fatal error:', err);
  try { await db.pool.end(); } catch (_) { /* ignore */ }
  process.exit(1);
});
