#!/usr/bin/env node

/**
 * CLI for data ingestion
 * 
 * Usage:
 *   node scripts/sync.js fec [--cycle=2024] [--state=WI]
 *   node scripts/sync.js status
 *   node scripts/sync.js verify <candidateId>
 */

require('dotenv').config();
const ingestionService = require('../services/ingestion');
const db = require('../db');

const commands = {
  async fec(args) {
    const cycle = parseInt(args.cycle || args.c) || 2024;
    const state = args.state || args.s || null;
    
    console.log(`\n🔄 Starting FEC sync...`);
    console.log(`   Cycle: ${cycle}`);
    console.log(`   State: ${state || 'All states'}\n`);
    
    const stats = await ingestionService.syncFECCandidates(cycle, state);
    
    console.log(`\n✅ FEC Sync Complete:`);
    console.log(`   Fetched:   ${stats.fetched}`);
    console.log(`   Created:   ${stats.created}`);
    console.log(`   Updated:   ${stats.updated}`);
    console.log(`   Unchanged: ${stats.unchanged}`);
    console.log(`   Errors:    ${stats.errors}`);
    
    if (stats.errors > 0) {
      console.log(`\n⚠️ Errors:\n${stats.errorLog}`);
    }
    
    process.exit(0);
  },

  async status() {
    console.log(`\n📊 Data Source Status:\n`);
    
    const sources = await ingestionService.getSyncStatus();
    
    for (const source of sources) {
      console.log(`${source.display_name} (${source.name})`);
      console.log(`   Type: ${source.source_type}`);
      console.log(`   Active: ${source.is_active}`);
      console.log(`   Last Sync: ${source.last_sync_at || 'Never'}`);
      console.log(`   Status: ${source.last_sync_status || 'N/A'}`);
      if (source.last_run_status) {
        console.log(`   Last Run: ${source.records_fetched} fetched, ${source.records_created} created, ${source.records_updated} updated`);
      }
      console.log('');
    }
    
    // Overall stats
    const stats = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM candidate_profiles WHERE is_active = TRUE) as total_candidates,
        (SELECT COUNT(*) FROM candidate_profiles WHERE candidate_verified = TRUE) as verified_candidates,
        (SELECT COUNT(*) FROM candidate_profiles WHERE fec_candidate_id IS NOT NULL) as fec_linked
    `);
    
    console.log(`📈 Database Stats:`);
    console.log(`   Total Candidates: ${stats.rows[0].total_candidates}`);
    console.log(`   Verified: ${stats.rows[0].verified_candidates}`);
    console.log(`   FEC Linked: ${stats.rows[0].fec_linked}\n`);
    
    process.exit(0);
  },

  async verify(args) {
    const candidateId = args._[0];
    
    if (!candidateId) {
      console.error('Usage: node scripts/sync.js verify <candidateId>');
      process.exit(1);
    }
    
    console.log(`\n🔍 Verifying candidate ${candidateId}...`);
    
    const result = await ingestionService.verifyCandidate(candidateId);
    
    if (result.verified) {
      console.log(`✅ Verified!`);
      console.log(`   FEC ID: ${result.fecId}`);
      console.log(`   Match: ${result.match?.name || 'Unknown'}`);
    } else {
      console.log(`❌ Not verified: ${result.error}`);
    }
    
    process.exit(0);
  },

  async help() {
    console.log(`
WhosRunningUSA Data Sync CLI

Commands:
  fec [options]     Sync federal candidates from FEC
    --cycle=YYYY    Election cycle year (default: 2024)
    --state=XX      Two-letter state code (optional)

  status            Show sync status for all data sources

  verify <id>       Verify a specific candidate against FEC

Examples:
  node scripts/sync.js fec --cycle=2024 --state=WI
  node scripts/sync.js fec
  node scripts/sync.js status
  node scripts/sync.js verify abc123-def456
    `);
    process.exit(0);
  }
};

// Parse arguments
function parseArgs(argv) {
  const args = { _: [] };
  
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value || true;
    } else if (arg.startsWith('-')) {
      args[arg.slice(1)] = argv[++i] || true;
    } else {
      args._.push(arg);
    }
  }
  
  return args;
}

// Main
async function main() {
  const args = parseArgs(process.argv);
  const command = args._.shift() || 'help';
  
  if (commands[command]) {
    try {
      await commands[command](args);
    } catch (err) {
      console.error(`\n❌ Error: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    await commands.help();
  }
}

main();