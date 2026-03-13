#!/usr/bin/env node

/**
 * Master Data Ingestion Script
 *
 * Orchestrates all external API data syncs in the correct order.
 * This pulls LIVE data from authoritative sources to supplement
 * the seed data created by seed-all.js.
 *
 * Prerequisites:
 *   - Database seeded (run seed-all.js first)
 *   - API keys set in environment:
 *     FEC_API_KEY          — https://api.data.gov/signup/
 *     OPEN_STATES_API_KEY  — https://open.pluralpolicy.com/accounts/profile/
 *     CONGRESS_GOV_API_KEY — https://api.congress.gov/sign-up/
 *
 * Usage:
 *   node ingest-all.js                    # Run all ingestion
 *   node ingest-all.js --step=fec         # FEC only
 *   node ingest-all.js --step=openstates  # Open States only
 *   node ingest-all.js --step=congress    # Congress.gov only
 *   node ingest-all.js --step=bills       # Open States bills only
 *   node ingest-all.js --step=districts   # District-county mapping only
 *   node ingest-all.js --state=CA         # Single state only
 *   node ingest-all.js --dry-run          # Show what would run
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { execSync, spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const stepFlag = args.find(a => a.startsWith('--step='));
const stateFlag = args.find(a => a.startsWith('--state='));
const dryRun = args.includes('--dry-run');

const step = stepFlag ? stepFlag.split('=')[1] : 'all';
const targetState = stateFlag ? stateFlag.split('=')[1].toUpperCase() : null;

const SCRIPTS_DIR = __dirname;

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const statesToProcess = targetState ? [targetState] : ALL_STATES;

async function main() {
  console.log('=== WhosRunningUSA Data Ingestion ===\n');

  // Check API keys
  const keys = {
    FEC_API_KEY: !!process.env.FEC_API_KEY,
    OPEN_STATES_API_KEY: !!process.env.OPEN_STATES_API_KEY,
    CONGRESS_GOV_API_KEY: !!process.env.CONGRESS_GOV_API_KEY,
  };

  console.log('API Key Status:');
  for (const [key, present] of Object.entries(keys)) {
    console.log(`  ${key}: ${present ? 'SET' : 'MISSING'}`);
  }
  console.log('');

  if (dryRun) {
    console.log('[DRY RUN] Would execute the following steps:\n');
  }

  const steps = [];

  // Step 1: Import district-county mapping (no API key needed)
  if (step === 'all' || step === 'districts') {
    steps.push({
      name: 'District-County Mapping',
      description: 'Import Census Bureau congressional district to county relationships',
      command: `node ${path.join(SCRIPTS_DIR, 'import-districts.js')}`,
      requiresKey: null,
    });
  }

  // Step 2: FEC Federal Candidates
  if (step === 'all' || step === 'fec') {
    const cycle = 2026;
    if (targetState) {
      steps.push({
        name: `FEC Sync — ${targetState}`,
        description: `Sync federal candidates from FEC for ${targetState}, cycle ${cycle}`,
        command: `node ${path.join(SCRIPTS_DIR, 'sync.js')} fec --cycle=${cycle} --state=${targetState}`,
        requiresKey: 'FEC_API_KEY',
      });
    } else {
      steps.push({
        name: 'FEC Sync — All States',
        description: `Sync all federal candidates from FEC for cycle ${cycle}`,
        command: `node ${path.join(SCRIPTS_DIR, 'sync.js')} fec --cycle=${cycle}`,
        requiresKey: 'FEC_API_KEY',
      });
    }
  }

  // Step 3: Open States Legislators
  if (step === 'all' || step === 'openstates') {
    const stateArg = targetState || statesToProcess.join(',');
    steps.push({
      name: 'Open States Legislators',
      description: `Sync state legislators from Open States (${targetState || 'all states'})`,
      command: `node ${path.join(SCRIPTS_DIR, 'sync-open-states.js')} ${stateArg}`,
      requiresKey: 'OPEN_STATES_API_KEY',
    });
  }

  // Step 4: Congress.gov Members & Bills
  if (step === 'all' || step === 'congress') {
    const stateArg = targetState ? `--state=${targetState}` : '';
    steps.push({
      name: 'Congress.gov Members',
      description: 'Sync congressional members from Congress.gov',
      command: `node ${path.join(SCRIPTS_DIR, 'sync-congress-gov.js')} --members ${stateArg}`,
      requiresKey: 'CONGRESS_GOV_API_KEY',
    });
    steps.push({
      name: 'Congress.gov Bills',
      description: 'Sync bills from Congress.gov',
      command: `node ${path.join(SCRIPTS_DIR, 'sync-congress-gov.js')} --bills ${stateArg}`,
      requiresKey: 'CONGRESS_GOV_API_KEY',
    });
    steps.push({
      name: 'Congress.gov Sponsorships',
      description: 'Sync bill sponsorships from Congress.gov',
      command: `node ${path.join(SCRIPTS_DIR, 'sync-congress-gov.js')} --sponsorships ${stateArg}`,
      requiresKey: 'CONGRESS_GOV_API_KEY',
    });
  }

  // Step 5: Open States Bills & Votes
  if (step === 'all' || step === 'bills') {
    const billStates = targetState ? [targetState] : ['CA', 'TX', 'NY', 'FL', 'IL', 'PA', 'OH', 'GA', 'MI', 'WI'];
    for (const st of billStates) {
      steps.push({
        name: `Open States Bills — ${st}`,
        description: `Sync state bills and votes for ${st}`,
        command: `node ${path.join(SCRIPTS_DIR, 'sync-open-states-bills.js')} ${st} --recent`,
        requiresKey: 'OPEN_STATES_API_KEY',
      });
    }
  }

  // Execute steps
  let completed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    console.log(`\n[${i + 1}/${steps.length}] ${s.name}`);
    console.log(`  ${s.description}`);

    if (s.requiresKey && !keys[s.requiresKey]) {
      console.log(`  SKIPPED: ${s.requiresKey} not set`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  WOULD RUN: ${s.command}`);
      continue;
    }

    console.log(`  Running: ${s.command}`);
    try {
      await runCommand(s.command);
      completed++;
      console.log(`  DONE`);
    } catch (err) {
      failed++;
      console.error(`  FAILED: ${err.message}`);
    }
  }

  console.log('\n=== Ingestion Summary ===');
  console.log(`  Steps:     ${steps.length}`);
  console.log(`  Completed: ${completed}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Failed:    ${failed}`);

  if (skipped > 0) {
    console.log('\nTo set missing API keys, add them to backend/.env:');
    if (!keys.FEC_API_KEY) console.log('  FEC_API_KEY=your_key          # Get at https://api.data.gov/signup/');
    if (!keys.OPEN_STATES_API_KEY) console.log('  OPEN_STATES_API_KEY=your_key  # Get at https://open.pluralpolicy.com/accounts/profile/');
    if (!keys.CONGRESS_GOV_API_KEY) console.log('  CONGRESS_GOV_API_KEY=your_key # Get at https://api.congress.gov/sign-up/');
  }
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', command.replace(/^node\s+/, '').split(' '), {
      cwd: SCRIPTS_DIR,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process exited with code ${code}`));
    });

    child.on('error', (err) => reject(err));
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
