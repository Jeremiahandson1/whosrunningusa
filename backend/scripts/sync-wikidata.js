#!/usr/bin/env node

/**
 * Wikidata Enrichment Sync
 *
 * Enriches candidate profiles with education history and photos
 * from Wikidata (public SPARQL endpoint). Processes candidates
 * that have a Bioguide ID (federal legislators) and haven't
 * been enriched yet.
 *
 * Source: https://www.wikidata.org
 * License: CC0 (public domain)
 * No API key required. Rate limit: 5 parallel queries/IP.
 *
 * Usage:
 *   node scripts/sync-wikidata.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const ingestionService = require('../services/ingestion');
const db = require('../db');

async function main() {
  console.log('\n=== Wikidata Enrichment Sync ===');
  console.log(`  Time: ${new Date().toISOString()}`);

  const stats = await ingestionService.syncWikidata();

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
  console.error('Wikidata sync fatal error:', err);
  try { await db.pool.end(); } catch (_) { /* ignore */ }
  process.exit(1);
});
