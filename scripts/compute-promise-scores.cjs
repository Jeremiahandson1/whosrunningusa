#!/usr/bin/env node

/**
 * Recompute promise_scores from the promises table.
 *
 * Usage:
 *   node scripts/compute-promise-scores.js
 *
 * Required env vars:
 *   DATABASE_URL — PostgreSQL connection string
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Computing promise scores...\n');

  // Get all candidates that have at least one promise
  const { rows: candidates } = await pool.query(`
    SELECT candidate_id,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'kept') AS kept,
           COUNT(*) FILTER (WHERE status = 'broken') AS broken,
           COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
           COUNT(*) FILTER (WHERE status = 'compromised') AS compromised,
           COUNT(*) FILTER (WHERE status = 'pending') AS pending,
           COUNT(*) FILTER (WHERE is_locked = TRUE) AS locked
    FROM promises
    GROUP BY candidate_id
  `);

  console.log(`Found ${candidates.length} candidates with promises.\n`);

  let updated = 0;
  let created = 0;

  for (const c of candidates) {
    const total = parseInt(c.total, 10);
    const kept = parseInt(c.kept, 10);
    const broken = parseInt(c.broken, 10);
    const inProgress = parseInt(c.in_progress, 10);
    const compromised = parseInt(c.compromised, 10);
    const pending = parseInt(c.pending, 10);
    const locked = parseInt(c.locked, 10);

    // promise_score = ((kept + 0.5 * in_progress) / GREATEST(locked, 1)) * 100
    const denominator = Math.max(locked, 1);
    const score = ((kept + 0.5 * inProgress) / denominator) * 100;
    const roundedScore = Math.round(score * 100) / 100;

    const result = await pool.query(`
      INSERT INTO promise_scores (
        politician_id, total_promises, locked_promises,
        kept, broken, in_progress, compromised, pending,
        promise_score, last_computed_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (politician_id) DO UPDATE SET
        total_promises = EXCLUDED.total_promises,
        locked_promises = EXCLUDED.locked_promises,
        kept = EXCLUDED.kept,
        broken = EXCLUDED.broken,
        in_progress = EXCLUDED.in_progress,
        compromised = EXCLUDED.compromised,
        pending = EXCLUDED.pending,
        promise_score = EXCLUDED.promise_score,
        last_computed_at = NOW(),
        updated_at = NOW()
    `, [c.candidate_id, total, locked, kept, broken, inProgress, compromised, pending, roundedScore]);

    if (result.rowCount > 0) {
      // Check if it was an insert or update by looking at xmax
      // Simpler: just count
      updated++;
    }

    console.log(`  [${updated}/${candidates.length}] candidate=${c.candidate_id} — total=${total} locked=${locked} kept=${kept} broken=${broken} in_progress=${inProgress} compromised=${compromised} pending=${pending} → score=${roundedScore}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Candidates processed: ${updated}`);
  console.log(`Total promises across all candidates: ${candidates.reduce((s, c) => s + parseInt(c.total, 10), 0)}`);
  console.log('Done.');
}

main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
