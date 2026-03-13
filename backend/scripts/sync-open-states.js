#!/usr/bin/env node

/**
 * Open States Sync Script
 * 
 * Syncs state legislator data from Open States API
 * 
 * Usage:
 *   node scripts/sync-open-states.js          # Sync all states
 *   node scripts/sync-open-states.js WI       # Sync single state
 *   node scripts/sync-open-states.js WI,MN,IL # Sync multiple states
 * 
 * Environment variables:
 *   OPEN_STATES_API_KEY - Required API key from https://open.pluralpolicy.com/accounts/profile/
 *   DATABASE_URL - PostgreSQL connection string
 */

require('dotenv').config();

const ingestionService = require('../services/ingestion');

async function main() {
  // Check for API key
  if (!process.env.OPEN_STATES_API_KEY) {
    console.error('ERROR: OPEN_STATES_API_KEY environment variable is required');
    console.error('Get your API key at: https://open.pluralpolicy.com/accounts/profile/');
    process.exit(1);
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  const states = args[0] ? args[0].toUpperCase().split(',') : null;

  console.log('='.repeat(60));
  console.log('Open States Legislator Sync');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  
  if (states && states.length > 0) {
    console.log(`Syncing states: ${states.join(', ')}`);
  } else {
    console.log('Syncing all 50 states + DC + PR');
  }
  
  console.log('='.repeat(60));
  console.log('');

  try {
    let totalStats = {
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: 0
    };

    if (states && states.length > 0) {
      // Sync specific states
      for (const state of states) {
        console.log(`\n--- Syncing ${state} ---`);
        const stats = await ingestionService.syncOpenStatesState(state);
        
        totalStats.fetched += stats.fetched || 0;
        totalStats.created += stats.created || 0;
        totalStats.updated += stats.updated || 0;
        totalStats.unchanged += stats.unchanged || 0;
        totalStats.errors += stats.errors || 0;
        
        console.log(`${state} complete: ${stats.fetched} fetched, ${stats.created} created, ${stats.updated} updated`);
      }
    } else {
      // Sync all states
      const stats = await ingestionService.syncOpenStatesLegislators();
      totalStats = stats;
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('SYNC COMPLETE');
    console.log('='.repeat(60));
    console.log(`Finished at: ${new Date().toISOString()}`);
    console.log(`Total fetched:   ${totalStats.fetched}`);
    console.log(`Total created:   ${totalStats.created}`);
    console.log(`Total updated:   ${totalStats.updated}`);
    console.log(`Total unchanged: ${totalStats.unchanged}`);
    console.log(`Total errors:    ${totalStats.errors}`);
    console.log('='.repeat(60));

    if (totalStats.errors > 0) {
      console.log('\nSync completed with errors. Check logs for details.');
      process.exit(1);
    }

    process.exit(0);

  } catch (err) {
    console.error('');
    console.error('='.repeat(60));
    console.error('SYNC FAILED');
    console.error('='.repeat(60));
    console.error(`Error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run
main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});