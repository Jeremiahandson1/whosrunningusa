#!/usr/bin/env node

/**
 * Sync Congressional Stock Trades
 *
 * Fetches STOCK Act disclosures from the House/Senate financial disclosure
 * databases and the Capitol Trades API. Flags suspicious trades based on
 * committee assignments, timing relative to legislation, and disclosure delays.
 *
 * Usage:
 *   node scripts/sync-stock-trades.js
 *   node scripts/sync-stock-trades.js --dry-run
 *   node scripts/sync-stock-trades.js --days=90
 *   node scripts/sync-stock-trades.js --politician-id <uuid>
 *
 * Required env vars:
 *   DATABASE_URL
 *
 * Optional env vars:
 *   QUIVER_API_KEY    — QuiverQuant API for congressional trades
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = { dryRun: false, days: 180, politicianId: null };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--days=')) args.days = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--politician-id=')) args.politicianId = arg.split('=')[1];
  }
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Committee-to-sector mapping for flag detection
// ---------------------------------------------------------------------------

const COMMITTEE_SECTORS = {
  'Armed Services': ['defense', 'aerospace', 'military'],
  'Energy and Commerce': ['energy', 'oil', 'gas', 'utilities', 'pharma', 'biotech', 'tech'],
  'Financial Services': ['banking', 'finance', 'insurance', 'real estate'],
  'Ways and Means': ['tax', 'trade'],
  'Agriculture': ['agriculture', 'food', 'farming'],
  'Transportation': ['airlines', 'transport', 'shipping', 'rail'],
  'Health': ['pharma', 'biotech', 'health', 'medical', 'hospital'],
  'Banking': ['banking', 'finance', 'crypto', 'fintech'],
  'Commerce': ['tech', 'telecom', 'media', 'retail'],
  'Judiciary': ['tech', 'antitrust'],
  'Intelligence': ['defense', 'cybersecurity', 'tech'],
  'Appropriations': [], // relevant to everything
};

function isCommitteeRelevant(committees, assetName, ticker) {
  if (!committees || committees.length === 0) return null;
  const searchText = `${assetName || ''} ${ticker || ''}`.toLowerCase();
  for (const committee of committees) {
    const sectors = Object.entries(COMMITTEE_SECTORS).find(
      ([name]) => committee.toLowerCase().includes(name.toLowerCase())
    );
    if (sectors && sectors[1].some(s => searchText.includes(s))) {
      return committee;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fetch trades from QuiverQuant API (or fallback to Senate/House sites)
// ---------------------------------------------------------------------------

async function fetchTradesFromAPI(days) {
  const trades = [];

  if (process.env.QUIVER_API_KEY) {
    console.log('Fetching from QuiverQuant API...');
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      const res = await axios.get(`https://api.quiverquant.com/beta/live/congresstrading`, {
        headers: { Authorization: `Bearer ${process.env.QUIVER_API_KEY}` },
        params: { date_from: since },
      });
      if (Array.isArray(res.data)) {
        for (const t of res.data) {
          trades.push({
            filer_name: t.Representative || t.Senator || t.Name,
            ticker: t.Ticker || null,
            asset_name: t.Asset || t.Description || null,
            trade_type: (t.Transaction || '').toLowerCase().includes('purchase') ? 'purchase'
              : (t.Transaction || '').toLowerCase().includes('sale') ? 'sale' : 'exchange',
            amount_range_low: parseAmountRange(t.Range || t.Amount, 'low'),
            amount_range_high: parseAmountRange(t.Range || t.Amount, 'high'),
            trade_date: t.TransactionDate || t.Date,
            disclosure_date: t.DisclosureDate || null,
            source: 'quiverquant',
            source_url: t.Link || null,
          });
        }
      }
      console.log(`  Fetched ${trades.length} trades from QuiverQuant`);
    } catch (err) {
      console.error(`  QuiverQuant API error: ${err.message}`);
    }
  }

  // If no API key or no results, try the Senate eFD RSS
  if (trades.length === 0) {
    console.log('Fetching from Senate eFD periodic transaction reports...');
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      const res = await axios.get(
        'https://efts.sec.gov/LATEST/search-index?q=%22periodic+transaction%22&dateRange=custom&startdt=' + since + '&enddt=' + new Date().toISOString().split('T')[0],
        { timeout: 15000, headers: { 'User-Agent': 'WhosRunningUSA/1.0 civic-data-project' } }
      );
      // Parse whatever format comes back
      if (res.data && Array.isArray(res.data.hits)) {
        for (const hit of res.data.hits.slice(0, 500)) {
          const name = hit._source?.person_full_name || hit._source?.filer_name || 'Unknown';
          trades.push({
            filer_name: name,
            ticker: null,
            asset_name: hit._source?.asset_description || null,
            trade_type: (hit._source?.transaction_type || '').toLowerCase().includes('purchase') ? 'purchase' : 'sale',
            amount_range_low: null,
            amount_range_high: null,
            trade_date: hit._source?.transaction_date || null,
            disclosure_date: hit._source?.disclosure_date || null,
            source: 'senate_efd',
            source_url: hit._source?.url || null,
          });
        }
      }
      console.log(`  Fetched ${trades.length} from Senate eFD`);
    } catch (err) {
      console.warn(`  Senate eFD fetch failed (non-fatal): ${err.message}`);
    }
  }

  return trades;
}

function parseAmountRange(range, which) {
  if (!range) return null;
  const str = String(range).replace(/[,$]/g, '');
  const match = str.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (match) {
    return which === 'low' ? parseFloat(match[1]) : parseFloat(match[2]);
  }
  const single = parseFloat(str);
  return isNaN(single) ? null : single;
}

// ---------------------------------------------------------------------------
// Match trade filer name to candidate_profiles
// ---------------------------------------------------------------------------

async function matchFilerToCandidate(filerName) {
  if (!filerName) return null;

  // Normalize: "Pelosi, Nancy" → "Nancy Pelosi"
  const parts = filerName.split(',').map(s => s.trim());
  const normalized = parts.length >= 2 ? `${parts[1]} ${parts[0]}` : parts[0];

  const { rows } = await pool.query(
    `SELECT id, display_name, fec_office_type,
            (SELECT array_agg(committee_name) FROM candidate_committees cc WHERE cc.candidate_id = cp.id) as committees
     FROM candidate_profiles cp
     WHERE display_name ILIKE $1
        OR display_name ILIKE $2
     LIMIT 1`,
    [`%${normalized}%`, `%${filerName}%`]
  );

  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Flag detection
// ---------------------------------------------------------------------------

async function detectFlags(trade, candidate) {
  const flags = [];

  // 1. Late disclosure (> 45 days per STOCK Act)
  if (trade.trade_date && trade.disclosure_date) {
    const tradeDate = new Date(trade.trade_date);
    const disclosureDate = new Date(trade.disclosure_date);
    const daysToDisclose = Math.round((disclosureDate - tradeDate) / 86400000);
    trade.days_to_disclose = daysToDisclose;

    if (daysToDisclose > 45) {
      flags.push({
        flag_type: 'late_disclosure',
        description: `Disclosed ${daysToDisclose} days after trade, exceeding the 45-day STOCK Act requirement by ${daysToDisclose - 45} days.`,
        severity: Math.min(10, Math.floor(3 + (daysToDisclose - 45) / 15)),
      });
    }
  }

  // 2. Committee relevance
  if (candidate && candidate.committees) {
    const relevantCommittee = isCommitteeRelevant(candidate.committees, trade.asset_name, trade.ticker);
    if (relevantCommittee) {
      flags.push({
        flag_type: 'committee_relevant',
        description: `Trade in ${trade.ticker || trade.asset_name} may be relevant to committee assignment: ${relevantCommittee}.`,
        severity: 6,
        related_committee: relevantCommittee,
      });
    }
  }

  // 3. Timing relative to recent votes on related bills
  if (trade.trade_date && candidate) {
    const { rows: relatedVotes } = await pool.query(
      `SELECT ve.id as vote_event_id, b.id as bill_id, b.title, ve.vote_date, b.bill_number
       FROM voting_records vr
       JOIN vote_events ve ON vr.vote_event_id = ve.id
       JOIN bills b ON ve.bill_id = b.id
       WHERE vr.candidate_id = $1
         AND ABS(EXTRACT(EPOCH FROM (ve.vote_date::timestamp - $2::timestamp)) / 86400) <= 14
       ORDER BY ve.vote_date DESC
       LIMIT 5`,
      [candidate.id, trade.trade_date]
    );

    for (const vote of relatedVotes) {
      flags.push({
        flag_type: 'timing_suspicious',
        description: `Trade occurred within 14 days of vote on ${vote.bill_number || vote.title}.`,
        severity: 7,
        related_bill_id: vote.bill_id,
        related_event_description: vote.title,
        event_date: vote.vote_date,
      });
    }
  }

  // 4. Large trade volume
  if (trade.amount_range_high && trade.amount_range_high >= 500000) {
    flags.push({
      flag_type: 'volume_unusual',
      description: `Trade amount (up to $${(trade.amount_range_high / 1000000).toFixed(1)}M) is unusually large for individual stock transactions.`,
      severity: Math.min(10, Math.floor(4 + trade.amount_range_high / 500000)),
    });
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  console.log('=== Congressional Stock Trade Sync ===');
  console.log(`Dry run: ${args.dryRun}`);
  console.log(`Looking back: ${args.days} days`);
  if (args.politicianId) console.log(`Filtering to politician: ${args.politicianId}`);
  console.log('');

  // Step 1: Fetch raw trades
  const rawTrades = await fetchTradesFromAPI(args.days);
  console.log(`\nTotal raw trades fetched: ${rawTrades.length}`);

  if (rawTrades.length === 0) {
    console.log('No trades to process. Exiting.');
    await pool.end();
    process.exit(0);
  }

  let inserted = 0;
  let flagged = 0;
  let unmatched = 0;
  let skipped = 0;

  for (const trade of rawTrades) {
    // Match filer to candidate
    const candidate = await matchFilerToCandidate(trade.filer_name);
    if (!candidate) {
      unmatched++;
      continue;
    }

    if (args.politicianId && candidate.id !== args.politicianId) {
      skipped++;
      continue;
    }

    // Check for duplicate
    const { rows: existingTrade } = await pool.query(
      `SELECT id FROM official_trades
       WHERE politician_id = $1 AND trade_date = $2 AND ticker = $3 AND trade_type = $4
       LIMIT 1`,
      [candidate.id, trade.trade_date, trade.ticker, trade.trade_type]
    );

    if (existingTrade.length > 0) {
      skipped++;
      continue;
    }

    // Detect flags
    const flags = await detectFlags(trade, candidate);

    if (args.dryRun) {
      console.log(`  [dry-run] ${candidate.display_name}: ${trade.trade_type} ${trade.ticker || trade.asset_name} (${flags.length} flags)`);
      inserted++;
      flagged += flags.length;
      continue;
    }

    // Insert trade
    const { rows: [newTrade] } = await pool.query(
      `INSERT INTO official_trades
         (politician_id, filer_name, ticker, asset_name, trade_type,
          amount_range_low, amount_range_high, trade_date, disclosure_date,
          days_to_disclose, committee_assignments, source_url, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        candidate.id, trade.filer_name, trade.ticker, trade.asset_name,
        trade.trade_type, trade.amount_range_low, trade.amount_range_high,
        trade.trade_date, trade.disclosure_date, trade.days_to_disclose || null,
        candidate.committees || null, trade.source_url, trade.source,
      ]
    );

    inserted++;

    // Insert flags
    for (const flag of flags) {
      await pool.query(
        `INSERT INTO trade_flags
           (trade_id, flag_type, description, severity, related_committee, related_bill_id,
            related_event_description, event_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newTrade.id, flag.flag_type, flag.description, flag.severity,
          flag.related_committee || null, flag.related_bill_id || null,
          flag.related_event_description || null, flag.event_date || null,
        ]
      );
      flagged++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Trades inserted: ${inserted}`);
  console.log(`Flags created: ${flagged}`);
  console.log(`Unmatched filers: ${unmatched}`);
  console.log(`Skipped (duplicates/filtered): ${skipped}`);
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
