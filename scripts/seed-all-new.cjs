#!/usr/bin/env node

/**
 * Run all seed scripts for new modules in sequence.
 *
 * Usage:
 *   node scripts/seed-all-new.cjs
 *   DATABASE_URL=postgres://user:pass@host/db node scripts/seed-all-new.cjs
 */

const { execSync } = require('child_process');
const path = require('path');

const SCRIPTS_DIR = __dirname;

const seeds = [
  { name: 'Revenue Violations', file: 'seed-revenue-violations.cjs' },
  { name: 'Hypocrisy Index', file: 'seed-hypocrisy-index.cjs' },
  { name: 'Think Tanks', file: 'seed-think-tanks.cjs' },
  { name: 'FARA Enforcement', file: 'seed-fara-enforcement.cjs' },
  { name: 'Cost Calculator', file: 'seed-cost-calculator.cjs' },
  { name: 'Voter Access', file: 'seed-voter-access.cjs' },
  { name: 'Local Offices', file: 'seed-local-offices.cjs' },
  // 'District Results' removed 2026-07-30: seed-district-results.cjs held
  // fabricated sample vote counts (self-described "representative sample for
  // development and demos") that fed real-looking gerrymandering metrics.
  // Load real FEC bulk results before re-enabling compute-gerrymandering.
  { name: 'Transparency Requirements', file: 'seed-transparency-requirements.cjs' },
];

const computes = [
  { name: 'Promise Scores', file: 'compute-promise-scores.cjs' },
  { name: 'Rubber Stamp Scores', file: 'compute-rubber-stamp.cjs' },
  { name: 'PAC Violations', file: 'check-pac-violations.cjs' },
];

console.log('=== WhosRunningUSA — Seed All New Modules ===\n');

let ok = 0, fail = 0;

for (const s of [...seeds, ...computes]) {
  const scriptPath = path.join(SCRIPTS_DIR, s.file);
  console.log(`[${ok + fail + 1}/${seeds.length + computes.length}] ${s.name}...`);
  try {
    execSync(`node "${scriptPath}"`, {
      cwd: SCRIPTS_DIR,
      env: process.env,
      stdio: 'pipe',
      timeout: 300000,
    });
    ok++;
    console.log(`  OK\n`);
  } catch (err) {
    fail++;
    const stderr = err.stderr?.toString().split('\n').slice(-3).join('\n') || err.message;
    console.error(`  FAILED: ${stderr}\n`);
  }
}

console.log(`=== Done: ${ok} succeeded, ${fail} failed ===`);
if (fail > 0) process.exit(1);
