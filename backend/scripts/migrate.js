#!/usr/bin/env node

/**
 * Database Migration Runner
 *
 * Applies schema.sql first, then all numbered migration files in order.
 * Tracks applied migrations in a _migrations table to avoid re-running.
 *
 * Usage:
 *   node scripts/migrate.js           # Run all pending migrations
 *   node scripts/migrate.js --status  # Show migration status
 *   node scripts/migrate.js --reset   # Drop _migrations tracking (does NOT drop data)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

const SCHEMA_FILE = path.join(__dirname, '..', 'schema.sql');
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Records the most recent failure for any migration that's been attempted
  // but did not commit. Lets /api/health surface what went wrong without
  // needing access to the deploy logs.
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migration_failures (
      filename VARCHAR(255) PRIMARY KEY,
      error_message TEXT,
      error_code VARCHAR(20),
      attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function recordFailure(filename, err) {
  try {
    await db.query(
      `INSERT INTO _migration_failures (filename, error_message, error_code, attempted_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (filename) DO UPDATE SET
         error_message = EXCLUDED.error_message,
         error_code = EXCLUDED.error_code,
         attempted_at = CURRENT_TIMESTAMP`,
      [filename, err.message || String(err), err.code || null]
    );
  } catch (_) { /* failure logging itself shouldn't crash the run */ }
}

async function clearFailure(filename) {
  try {
    await db.query(`DELETE FROM _migration_failures WHERE filename = $1`, [filename]);
  } catch (_) { /* ignore */ }
}

async function getAppliedMigrations() {
  const result = await db.query('SELECT filename FROM _migrations ORDER BY filename');
  return new Set(result.rows.map(r => r.filename));
}

async function markApplied(filename) {
  await db.query('INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', [filename]);
}

async function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => {
      // Sort by leading number: 002-xxx.sql, 003-xxx.sql, etc.
      const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0');
      return numA - numB;
    });
  return files;
}

async function runMigration(filename, sql) {
  const client = await db.getClient();
  // Migrations sometimes need to run wide-ranging DDL (e.g., extensions,
  // schema rewrites) that exceeds the pool-wide statement_timeout default.
  // Disable the timeout for this connection only.
  try { await client.query(`SET statement_timeout = 0`); } catch (_) { /* ignore */ }
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', [filename]);
    await client.query('COMMIT');
    await clearFailure(filename);
    console.log(`  Applied: ${filename}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function showStatus() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const migrationFiles = await getMigrationFiles();

  console.log('\nMigration Status');
  console.log('='.repeat(50));

  // Schema
  const schemaApplied = applied.has('000-schema.sql');
  console.log(`  ${schemaApplied ? '[x]' : '[ ]'} 000-schema.sql (base schema)`);

  // Migration files
  for (const file of migrationFiles) {
    const isApplied = applied.has(file);
    console.log(`  ${isApplied ? '[x]' : '[ ]'} ${file}`);
  }

  const pending = migrationFiles.filter(f => !applied.has(f));
  const schemaIsPending = !schemaApplied;
  const totalPending = pending.length + (schemaIsPending ? 1 : 0);

  console.log(`\n  ${applied.size} applied, ${totalPending} pending`);
  console.log('='.repeat(50));
}

async function runAll() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  console.log('\nWhosRunningUSA Migration Runner');
  console.log('='.repeat(50));

  let ran = 0;

  // Check for stale state: tables exist but _migrations is empty or schema is outdated
  const needsFullReset = async () => {
    // Case 1: _migrations is empty but tables exist (failed prior deploy)
    if (!applied.has('000-schema.sql')) {
      const tableCheck = await db.query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
      ).catch(() => ({ rows: [{ count: '0' }] }));
      if (parseInt(tableCheck.rows[0].count) > 0) return true;
    }
    // Case 2: schema applied but columns are wrong (outdated schema)
    if (applied.has('000-schema.sql')) {
      const colCheck = await db.query(
        "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'congressional_districts' AND column_name = 'state_abbr'"
      ).catch(() => ({ rows: [{ count: '0' }] }));
      if (parseInt(colCheck.rows[0].count) === 0) return true;
    }
    return false;
  };

  try {
    if (await needsFullReset()) {
      console.log('\nStale/outdated schema detected — dropping all tables and re-applying...');
      await db.query('DROP SCHEMA public CASCADE');
      await db.query('CREATE SCHEMA public');
      await db.query('GRANT ALL ON SCHEMA public TO public');
      await ensureMigrationsTable();
      const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
      await runMigration('000-schema.sql', sql);
      ran++;
    } else if (!applied.has('000-schema.sql')) {
      console.log('\nApplying base schema...');
      const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
      await runMigration('000-schema.sql', sql);
      ran++;
    } else {
      console.log('\nBase schema already applied.');
    }
  } catch (err) {
    console.error(`  Base schema error: ${err.message} (continuing...)`);
  }

  // 2. Apply numbered migrations
  const migrationFiles = await getMigrationFiles();
  const pending = migrationFiles.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('No pending migrations.');
  } else {
    console.log(`\nApplying ${pending.length} migration(s)...`);
    const failed = [];
    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await runMigration(file, sql);
        ran++;
      } catch (err) {
        console.error(`  FAILED: ${file} — ${err.message}${err.code ? ` (code ${err.code})` : ''}`);
        await recordFailure(file, err);
        failed.push(file);
      }
    }
    if (failed.length > 0) {
      console.log(`\n  WARNING: ${failed.length} migration(s) failed (server will still start):`);
      failed.forEach(f => console.log(`    - ${f}`));
      console.log(`\n  Failure details are persisted in the _migration_failures table`);
      console.log(`  and exposed at /api/health for live diagnosis.`);
    }
  }

  console.log(`\nDone. ${ran} migration(s) applied.`);
  console.log('='.repeat(50));
}

async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.includes('--status')) {
      await showStatus();
    } else if (args.includes('--reset')) {
      await db.query('DROP TABLE IF EXISTS _migrations');
      console.log('Migration tracking table dropped.');
    } else {
      await runAll();
    }
  } catch (err) {
    console.error('Migration error:', err.message);
    // Don't exit(1) — let the server start even if migrations had issues
    console.error('WARNING: Migration had errors but server will attempt to start.');
  }

  process.exit(0);
}

main();
