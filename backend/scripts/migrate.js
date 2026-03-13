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
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', [filename]);
    await client.query('COMMIT');
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

  // 1. Apply base schema
  if (!applied.has('000-schema.sql')) {
    // Check if tables already exist (schema was applied outside migration tracking)
    const tableCheck = await db.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
    );
    if (parseInt(tableCheck.rows[0].count) > 0) {
      console.log('\nBase schema already exists (marking as applied)...');
      await markApplied('000-schema.sql');
    } else {
      console.log('\nApplying base schema...');
      const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
      await runMigration('000-schema.sql', sql);
    }
    ran++;
  } else {
    console.log('\nBase schema already applied.');
  }

  // 2. Apply numbered migrations
  const migrationFiles = await getMigrationFiles();
  const pending = migrationFiles.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('No pending migrations.');
  } else {
    console.log(`\nApplying ${pending.length} migration(s)...`);
    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await runMigration(file, sql);
      ran++;
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
    process.exit(1);
  }

  process.exit(0);
}

main();
