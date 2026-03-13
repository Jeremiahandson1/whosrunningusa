#!/usr/bin/env node

/**
 * VoteSmart Sync Script
 *
 * Enriches candidate profiles with data from the VoteSmart API:
 * - Bio (education, professional experience, political history)
 * - Interest group ratings
 * - Photo URLs
 *
 * Usage:
 *   node scripts/sync-votesmart.js                  # All candidates
 *   node scripts/sync-votesmart.js --state=WI       # Single state
 *
 * Requires VOTE_SMART_API_KEY environment variable.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const ingestionService = require('../services/ingestion');
const db = require('../db');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value || true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const state = args.state || null;

  console.log('\n=== VoteSmart Sync ===');
  console.log(`  Time:  ${new Date().toISOString()}`);
  console.log(`  State: ${state || 'all'}`);

  if (!process.env.VOTE_SMART_API_KEY) {
    console.log('  VOTE_SMART_API_KEY not set — skipping');
    process.exit(0);
  }

  const stats = await ingestionService.syncVoteSmart(state);

  console.log('\n=== Results ===');
  console.log(`  Fetched:   ${stats.fetched || 0}`);
  console.log(`  Matched:   ${stats.matched || 0}`);
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
  console.error('VoteSmart sync fatal error:', err);
  try { await db.pool.end(); } catch (_) { /* ignore */ }
  process.exit(1);
});
