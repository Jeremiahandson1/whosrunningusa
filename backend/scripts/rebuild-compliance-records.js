#!/usr/bin/env node

/**
 * Rebuild compliance_records and transparency_requirements without
 * duplicates, and add the unique indexes that prevent regrowth.
 *
 * Why: seed-transparency-requirements.cjs inserted with ON CONFLICT DO
 * NOTHING but neither table had a unique key, so every nightly run added a
 * full new copy: transparency_requirements grew to 60 copies of each of its
 * 18 real requirements, and the politicians × requirements baseline
 * cross-join multiplied against every copy — 18.5M compliance rows / 5.3 GB,
 * 95% of the database.
 *
 * Method (built for a memory-starved instance — heavy queries here have
 * killed backends): hash aggregations only, no large sorts; exactly two
 * sequential scans of the big table; kept rows are copied into a NEW table
 * and the old one is dropped, which returns its disk to the OS immediately
 * (no VACUUM FULL, no multi-GB DELETE churn). Kept row per
 * (politician, canonical requirement) = the most recently checked one.
 *
 * Usage:
 *   node scripts/rebuild-compliance-records.js --dry-run
 *   node scripts/rebuild-compliance-records.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

const COLS = `id, politician_id, agency_name, requirement_id, compliance_status,
              compliance_score, last_checked, evidence_url, notes,
              reporting_period_start, reporting_period_end, created_at, updated_at`;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`\n=== Rebuild compliance_records ${dryRun ? '(dry run)' : ''} ===`);
  const startedAt = Date.now();
  const client = await db.pool.connect();

  try {
    const before = await client.query(`
      SELECT pg_size_pretty(pg_total_relation_size('compliance_records')) AS table_size,
             pg_size_pretty(pg_database_size(current_database())) AS db_size
    `);
    console.log(`  Before: compliance_records ${before.rows[0].table_size}, database ${before.rows[0].db_size}`);

    // Safety: compliance_records must be a leaf table for the drop-and-swap.
    const deps = await client.query(`
      SELECT con.conrelid::regclass::text AS t
        FROM pg_constraint con
       WHERE con.contype = 'f' AND con.confrelid = 'compliance_records'::regclass
    `);
    if (deps.rows.length > 0) {
      throw new Error(`Tables reference compliance_records, aborting: ${deps.rows.map(r => r.t).join(', ')}`);
    }

    // --- Canonical requirement per (jurisdiction_type, state, type, title) ---
    await client.query(`
      CREATE TEMP TABLE req_canon AS
      SELECT DISTINCT ON (jurisdiction_type, COALESCE(state, ''), requirement_type, title)
             id AS canon_id, jurisdiction_type, COALESCE(state, '') AS state_key,
             requirement_type, title
        FROM transparency_requirements
       ORDER BY jurisdiction_type, COALESCE(state, ''), requirement_type, title, created_at, id
    `);
    await client.query(`
      CREATE TEMP TABLE req_map AS
      SELECT tr.id AS old_id, rc.canon_id
        FROM transparency_requirements tr
        JOIN req_canon rc
          ON tr.jurisdiction_type = rc.jurisdiction_type
         AND COALESCE(tr.state, '') = rc.state_key
         AND tr.requirement_type = rc.requirement_type
         AND tr.title = rc.title
    `);
    await client.query(`ANALYZE req_map`);
    const reqStats = await client.query(
      `SELECT (SELECT count(*) FROM req_map)::int AS total, (SELECT count(*) FROM req_canon)::int AS canonical`
    );
    console.log(`  transparency_requirements: ${reqStats.rows[0].total} rows → ${reqStats.rows[0].canonical} canonical`);

    // --- Pass 1: newest last_checked per (politician, canonical requirement) ---
    console.log('  Scanning compliance_records (pass 1/2: group + max last_checked)…');
    await client.query(`
      CREATE TEMP TABLE keep1 AS
      SELECT cr.politician_id, m.canon_id, max(cr.last_checked) AS max_lc
        FROM compliance_records cr
        JOIN req_map m ON cr.requirement_id = m.old_id
       WHERE cr.politician_id IS NOT NULL
       GROUP BY 1, 2
    `);
    await client.query(`ANALYZE keep1`);
    const kept = await client.query(`SELECT count(*)::int AS n FROM keep1`);
    console.log(`  Logical rows to keep: ${kept.rows[0].n}`);

    if (dryRun) {
      console.log('  Dry run — stopping before any writes to real tables.');
      return;
    }

    // --- Pass 2: pick one physical row per group (ties broken by max id) ---
    console.log('  Scanning compliance_records (pass 2/2: pick surviving row ids)…');
    await client.query(`
      CREATE TEMP TABLE keep_ids AS
      SELECT max(cr.id::text)::uuid AS id
        FROM compliance_records cr
        JOIN req_map m ON cr.requirement_id = m.old_id
        JOIN keep1 k ON k.politician_id = cr.politician_id
                    AND k.canon_id = m.canon_id
                    AND cr.last_checked IS NOT DISTINCT FROM k.max_lc
       GROUP BY cr.politician_id, m.canon_id
    `);
    await client.query(`ANALYZE keep_ids`);

    // --- Build the replacement table (small: one row per logical key) ---
    await client.query(`DROP TABLE IF EXISTS compliance_records_new`);
    await client.query(`
      CREATE TABLE compliance_records_new
        (LIKE compliance_records INCLUDING DEFAULTS INCLUDING CONSTRAINTS)
    `);
    const inserted = await client.query(`
      INSERT INTO compliance_records_new (${COLS})
      SELECT cr.id, cr.politician_id, cr.agency_name, m.canon_id, cr.compliance_status,
             cr.compliance_score, cr.last_checked, cr.evidence_url, cr.notes,
             cr.reporting_period_start, cr.reporting_period_end, cr.created_at, cr.updated_at
        FROM compliance_records cr
        JOIN keep_ids k ON cr.id = k.id
        JOIN req_map m ON cr.requirement_id = m.old_id
    `);
    console.log(`  Copied ${inserted.rowCount} rows into replacement table`);

    // --- Swap: drop the 5 GB table (frees disk immediately), rename, re-arm ---
    await client.query('BEGIN');
    await client.query(`DROP TABLE compliance_records`);
    await client.query(`ALTER TABLE compliance_records_new RENAME TO compliance_records`);
    await client.query(`ALTER TABLE compliance_records ADD PRIMARY KEY (id)`);
    await client.query(`
      ALTER TABLE compliance_records
        ADD CONSTRAINT compliance_records_politician_id_fkey
        FOREIGN KEY (politician_id) REFERENCES candidate_profiles(id) ON DELETE CASCADE
    `);
    await client.query(`
      ALTER TABLE compliance_records
        ADD CONSTRAINT compliance_records_requirement_id_fkey
        FOREIGN KEY (requirement_id) REFERENCES transparency_requirements(id) ON DELETE CASCADE
    `);
    await client.query(`CREATE INDEX idx_compliance_politician ON compliance_records(politician_id)`);
    await client.query(`CREATE INDEX idx_compliance_requirement ON compliance_records(requirement_id)`);
    await client.query(`CREATE INDEX idx_compliance_status ON compliance_records(compliance_status)`);
    await client.query(`CREATE INDEX idx_compliance_politician_status_score ON compliance_records(politician_id, compliance_status, compliance_score)`);
    await client.query(`CREATE INDEX idx_compliance_requirement_status_score ON compliance_records(requirement_id, compliance_status, compliance_score)`);
    await client.query(`
      CREATE UNIQUE INDEX uq_compliance_politician_requirement
        ON compliance_records(politician_id, requirement_id)
    `);
    await client.query('COMMIT');
    console.log('  Swap complete — old table dropped, unique index in place');

    // --- Dedupe transparency_requirements itself ---
    const reqRefs = await client.query(`
      SELECT con.conrelid::regclass::text AS table_name, att.attname AS column_name
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
       WHERE con.contype = 'f' AND con.confrelid = 'transparency_requirements'::regclass
    `);
    for (const { table_name, column_name } of reqRefs.rows) {
      const r = await client.query(`
        UPDATE "${table_name}" t SET "${column_name}" = m.canon_id
          FROM req_map m
         WHERE t."${column_name}" = m.old_id AND m.old_id <> m.canon_id
      `);
      if (r.rowCount > 0) console.log(`  Re-pointed ${r.rowCount} rows in ${table_name}.${column_name}`);
    }
    const reqDel = await client.query(`
      DELETE FROM transparency_requirements
       WHERE id NOT IN (SELECT canon_id FROM req_canon)
    `);
    console.log(`  Deleted ${reqDel.rowCount} duplicate requirement rows`);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_transparency_requirement
        ON transparency_requirements (jurisdiction_type, COALESCE(state, ''), requirement_type, title)
    `);

    await client.query(`ANALYZE compliance_records`);
    await client.query(`ANALYZE transparency_requirements`);

    const after = await client.query(`
      SELECT (SELECT count(*) FROM compliance_records)::int AS rows,
             pg_size_pretty(pg_total_relation_size('compliance_records')) AS table_size,
             pg_size_pretty(pg_database_size(current_database())) AS db_size
    `);
    console.log(`  After: ${after.rows[0].rows} rows, table ${after.rows[0].table_size}, database ${after.rows[0].db_size}`);
  } finally {
    client.release();
  }

  console.log(`  Duration: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  await db.pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('rebuild-compliance-records failed:', err.message);
  try { await db.pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
