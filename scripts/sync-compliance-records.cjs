#!/usr/bin/env node

/**
 * Sync Compliance Records
 *
 * Checks and updates compliance records for federal legislators based on
 * real data from FEC, Senate eFD, and FOIA.gov. Scores compliance 0-100
 * based on timeliness and completeness.
 *
 * Usage:
 *   node scripts/sync-compliance-records.js
 *   node scripts/sync-compliance-records.js --dry-run
 *   node scripts/sync-compliance-records.js --type=financial_disclosure
 *
 * Required env vars:
 *   DATABASE_URL
 *
 * Optional env vars:
 *   FEC_API_KEY — for campaign finance compliance checks
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function parseArgs() {
  const args = { dryRun: false, type: null };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--type=')) args.type = arg.split('=')[1];
  }
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Compliance checkers per requirement type
// ---------------------------------------------------------------------------

/**
 * Check STOCK Act compliance: do they have stock trades with late disclosures?
 */
async function checkStockActCompliance(politicianId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as total_trades,
            COUNT(CASE WHEN days_to_disclose > 45 THEN 1 END) as late_trades,
            AVG(days_to_disclose) as avg_delay
     FROM official_trades
     WHERE politician_id = $1 AND days_to_disclose IS NOT NULL`,
    [politicianId]
  );

  const stats = rows[0];
  const totalTrades = parseInt(stats.total_trades);

  if (totalTrades === 0) return { status: 'unknown', score: null, notes: 'No trades recorded' };

  const lateTrades = parseInt(stats.late_trades);
  const avgDelay = parseFloat(stats.avg_delay);
  const lateRatio = lateTrades / totalTrades;

  let status, score;
  if (lateRatio === 0) {
    status = 'compliant';
    score = 100;
  } else if (lateRatio < 0.1) {
    status = 'compliant';
    score = Math.max(80, 100 - Math.round(lateRatio * 200));
  } else if (lateRatio < 0.3) {
    status = 'partial';
    score = Math.max(40, 100 - Math.round(lateRatio * 200));
  } else {
    status = 'non_compliant';
    score = Math.max(0, Math.round(100 - lateRatio * 100));
  }

  return {
    status,
    score,
    notes: `${totalTrades} trades, ${lateTrades} late (${Math.round(lateRatio * 100)}%), avg delay ${Math.round(avgDelay)}d`,
  };
}

/**
 * Check FEC campaign finance filing compliance
 */
async function checkFECCompliance(politicianId) {
  const { rows } = await pool.query(
    `SELECT fec_candidate_id FROM candidate_profiles WHERE id = $1`,
    [politicianId]
  );

  if (!rows[0]?.fec_candidate_id) {
    return { status: 'unknown', score: null, notes: 'No FEC ID on file' };
  }

  if (!process.env.FEC_API_KEY) {
    return { status: 'unknown', score: null, notes: 'FEC API key not configured' };
  }

  try {
    const fecId = rows[0].fec_candidate_id;
    const res = await axios.get(
      `https://api.open.fec.gov/v1/candidate/${fecId}/totals/?api_key=${process.env.FEC_API_KEY}&sort=-cycle`,
      { timeout: 10000 }
    );

    const results = res.data?.results;
    if (!results || results.length === 0) {
      return { status: 'unknown', score: null, notes: 'No FEC filing data found' };
    }

    const latest = results[0];
    const hasRecent = latest.cycle >= new Date().getFullYear() - 1;

    return {
      status: hasRecent ? 'compliant' : 'partial',
      score: hasRecent ? 90 : 50,
      notes: `Last filing cycle: ${latest.cycle}. Total raised: $${latest.receipts?.toLocaleString() || '0'}`,
    };
  } catch (err) {
    return { status: 'unknown', score: null, notes: `FEC API error: ${err.message}` };
  }
}

/**
 * Check lobbying disclosure: are there revolving door flags?
 */
async function checkLobbyingDisclosure(politicianId) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT pse.id) as total_positions,
            COUNT(DISTINCT rdf.id) as total_flags,
            COUNT(DISTINCT CASE WHEN rdf.flag_type = 'cooling_period_violation' THEN rdf.id END) as violations
     FROM post_service_employment pse
     LEFT JOIN revolving_door_flags rdf ON rdf.employment_id = pse.id
     WHERE pse.politician_id = $1`,
    [politicianId]
  );

  const stats = rows[0];
  const totalPositions = parseInt(stats.total_positions);

  if (totalPositions === 0) {
    return { status: 'compliant', score: 100, notes: 'No post-service employment recorded' };
  }

  const violations = parseInt(stats.violations);
  if (violations > 0) {
    return {
      status: 'non_compliant',
      score: Math.max(0, 100 - violations * 30),
      notes: `${violations} cooling period violation(s) detected`,
    };
  }

  const flags = parseInt(stats.total_flags);
  if (flags > 0) {
    return {
      status: 'partial',
      score: Math.max(40, 100 - flags * 15),
      notes: `${flags} revolving door flag(s), no cooling period violations`,
    };
  }

  return { status: 'compliant', score: 90, notes: `${totalPositions} post-service positions, no flags` };
}

/**
 * Check annual financial disclosure (Ethics in Government Act)
 */
async function checkFinancialDisclosure(politicianId) {
  // Check if we have trade data (a proxy for disclosure filing)
  const { rows } = await pool.query(
    `SELECT COUNT(*) as total_trades,
            MAX(disclosure_date) as last_disclosure
     FROM official_trades
     WHERE politician_id = $1`,
    [politicianId]
  );

  const totalTrades = parseInt(rows[0].total_trades);
  const lastDisclosure = rows[0].last_disclosure;

  if (totalTrades === 0 && !lastDisclosure) {
    return { status: 'unknown', score: null, notes: 'No disclosure data available' };
  }

  // Check if there's a recent disclosure
  if (lastDisclosure) {
    const daysSince = Math.round((Date.now() - new Date(lastDisclosure).getTime()) / 86400000);
    if (daysSince < 365) {
      return { status: 'compliant', score: 85, notes: `Last disclosure ${daysSince} days ago` };
    } else {
      return { status: 'partial', score: 50, notes: `Last disclosure ${daysSince} days ago (may be overdue)` };
    }
  }

  return { status: 'unknown', score: null, notes: 'Insufficient data' };
}

// Mapping of requirement types to checker functions
const CHECKERS = {
  financial_disclosure: async (politicianId, reqTitle) => {
    if (reqTitle.includes('STOCK Act')) return checkStockActCompliance(politicianId);
    return checkFinancialDisclosure(politicianId);
  },
  campaign_finance: checkFECCompliance,
  lobbying_disclosure: checkLobbyingDisclosure,
  foia_response: async () => ({ status: 'unknown', score: null, notes: 'Agency-level metric, not individual' }),
  meeting_recording: async () => ({ status: 'unknown', score: null, notes: 'Agency-level metric, not individual' }),
  body_camera: async () => ({ status: 'unknown', score: null, notes: 'Law enforcement metric, not legislative' }),
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  console.log('=== Compliance Record Sync ===');
  console.log(`Dry run: ${args.dryRun}`);
  if (args.type) console.log(`Filtering to type: ${args.type}`);
  console.log('');

  // Get all compliance records that need updating
  const conditions = ['cr.compliance_status = \'unknown\' OR cr.last_checked IS NULL OR cr.last_checked < NOW() - INTERVAL \'7 days\''];
  const params = [];
  let paramIndex = 1;

  if (args.type) {
    conditions.push(`tr.requirement_type = $${paramIndex}`);
    params.push(args.type);
    paramIndex++;
  }

  const { rows: records } = await pool.query(
    `SELECT cr.id, cr.politician_id, cr.requirement_id,
            tr.requirement_type, tr.title as requirement_title,
            cp.display_name
     FROM compliance_records cr
     JOIN transparency_requirements tr ON cr.requirement_id = tr.id
     JOIN candidate_profiles cp ON cr.politician_id = cp.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY cp.display_name, tr.requirement_type
     LIMIT 500`,
    params
  );

  console.log(`Found ${records.length} records to update.\n`);

  let updated = 0;
  let errors = 0;

  for (const record of records) {
    const checker = CHECKERS[record.requirement_type];
    if (!checker) continue;

    try {
      const result = await checker(record.politician_id, record.requirement_title);

      if (args.dryRun) {
        console.log(`  [dry-run] ${record.display_name} / ${record.requirement_title}: ${result.status} (${result.score}) — ${result.notes}`);
        updated++;
        continue;
      }

      await pool.query(
        `UPDATE compliance_records
         SET compliance_status = $2, compliance_score = $3, last_checked = NOW(), notes = $4
         WHERE id = $1`,
        [record.id, result.status, result.score, result.notes]
      );

      updated++;
    } catch (err) {
      console.error(`  Error updating ${record.display_name} / ${record.requirement_title}: ${err.message}`);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
