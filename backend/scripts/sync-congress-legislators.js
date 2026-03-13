#!/usr/bin/env node

/**
 * Congress-Legislators Dataset Sync
 *
 * Fetches current US Congress members from the public domain
 * unitedstates/congress-legislators GitHub dataset and enriches
 * existing candidate profiles with social media, contact info,
 * and cross-reference IDs.
 *
 * Source: https://github.com/unitedstates/congress-legislators
 * License: Public Domain (CC0)
 * No API key required. No rate limits.
 *
 * Usage:
 *   node scripts/sync-congress-legislators.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const ingestionService = require('../services/ingestion');
const db = require('../db');

async function main() {
  console.log('\n=== Congress-Legislators Dataset Sync ===');
  console.log(`  Time: ${new Date().toISOString()}`);

  const stats = await ingestionService.syncCongressLegislators();

  console.log('\n=== Results ===');
  console.log(`  Fetched:   ${stats.fetched || 0}`);
  console.log(`  Updated:   ${stats.updated || 0}`);
  console.log(`  Unchanged: ${stats.unchanged || 0}`);
  console.log(`  Errors:    ${stats.errors || 0}`);

  if (stats.errorLog) {
    console.log(`\n  Error log:\n${stats.errorLog}`);
  }

  await db.pool.end();
  process.exit(stats.status === 'failed' ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Congress-legislators sync fatal error:', err);
  try { await db.pool.end(); } catch (_) { /* ignore */ }
  process.exit(1);
});
