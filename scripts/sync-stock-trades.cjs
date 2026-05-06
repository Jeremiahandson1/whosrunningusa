#!/usr/bin/env node

/**
 * Sync Congressional Stock Trades
 *
 * Fetches STOCK Act disclosures from House Stock Watcher and Senate Stock
 * Watcher (free public S3-hosted JSON dumps scraped from the official PTR
 * filings). Flags suspicious trades based on committee assignments, timing
 * relative to legislation, and disclosure delays.
 *
 * Updated daily upstream — same source data as paid services like Quiver,
 * just on a 1-day delay instead of real-time.
 *
 * Usage:
 *   node scripts/sync-stock-trades.cjs
 *   node scripts/sync-stock-trades.cjs --dry-run
 *   node scripts/sync-stock-trades.cjs --days=90
 *   node scripts/sync-stock-trades.cjs --politician-id <uuid>
 *
 * Required env vars:
 *   DATABASE_URL
 *
 * No API keys required — Stock Watcher data is public.
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

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
// Stock Watcher data sources
//
// As of May 2026 the original Stock Watcher infra (housestockwatcher.com,
// senate-stock-watcher S3 buckets) is dead. The community GitHub mirror at
// timothycarambat/senate-stock-watcher-data is the only freely-licensed
// dataset still up — but it stopped updating in November 2020. We use it
// as a HISTORICAL ARCHIVE: 8,350 real STOCK Act disclosures from
// 2012–2020. The frontend explicitly labels this as "historical only" so
// users aren't misled into thinking it's current.
//
// To switch to a live feed later: replace these URLs with whichever data
// source has a commercial license (Quiver Commercial, FMP paid tier, or
// a future free mirror). The flag detection + DB insert path below is
// data-source-agnostic.
// ---------------------------------------------------------------------------

const SENATE_FEED = 'https://raw.githubusercontent.com/timothycarambat/senate-stock-watcher-data/master/aggregate/all_transactions.json';
const HOUSE_FEED  = null;  // No working free House mirror as of May 2026.

const USER_AGENT = 'WhosRunningUSA/1.0 (civic-data project; +https://whosrunningusa.com)';

// Stock Watcher uses M/D/YYYY in some places, ISO in others. Normalize.
function parseSwDate(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  // M/D/YYYY or MM/DD/YYYY
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mo, d, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Fallback: let Date parse it; bail on Invalid Date
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
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

function normalizeTradeType(raw) {
  const lower = (raw || '').toLowerCase();
  if (lower.includes('purchase') || lower.includes('buy')) return 'purchase';
  if (lower.includes('sale') || lower.includes('sell')) return 'sale';
  if (lower.includes('exchange')) return 'exchange';
  return null;
}

// "Hon. Daniel S. Goldman" → "Daniel Goldman"
// "Pelosi, Nancy" → "Nancy Pelosi"
function cleanFilerName(raw) {
  if (!raw) return null;
  let name = String(raw).trim();
  if (name.includes(',')) {
    const [last, first] = name.split(',').map(s => s.trim());
    name = `${first} ${last}`;
  }
  // Drop common honorifics/suffixes
  name = name.replace(/^(Hon\.|Mr\.|Mrs\.|Ms\.|Dr\.|Sen\.|Rep\.)\s+/i, '');
  name = name.replace(/\s+(Jr\.|Sr\.|II|III|IV)$/i, '');
  // Collapse whitespace
  return name.replace(/\s+/g, ' ').trim();
}

async function fetchTradesFromAPI(days) {
  const cutoff = new Date(Date.now() - days * 86400000);
  const trades = [];

  // House: no working free mirror as of May 2026.
  if (HOUSE_FEED) {
    console.log('Fetching House Stock Watcher feed...');
    try {
      const res = await axios.get(HOUSE_FEED, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 60_000,
        maxContentLength: 200 * 1024 * 1024,
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      let kept = 0;
      for (const t of rows) {
        const tradeDate = parseSwDate(t.transaction_date);
        if (!tradeDate) continue;
        if (new Date(tradeDate) < cutoff) continue;
        const type = normalizeTradeType(t.type);
        if (!type) continue;
        trades.push({
          filer_name: cleanFilerName(t.representative),
          ticker: (t.ticker && t.ticker !== '--') ? t.ticker : null,
          asset_name: t.asset_description || null,
          trade_type: type,
          amount_range_low: parseAmountRange(t.amount, 'low'),
          amount_range_high: parseAmountRange(t.amount, 'high'),
          trade_date: tradeDate,
          disclosure_date: parseSwDate(t.disclosure_date),
          source: 'house_stock_watcher',
          source_url: t.ptr_link || null,
        });
        kept++;
      }
      console.log(`  House: ${rows.length} rows in feed, ${kept} within last ${days} days`);
    } catch (err) {
      console.error(`  House Stock Watcher fetch failed: ${err.message}`);
    }
  } else {
    console.log('House feed disabled — no working free House mirror.');
  }

  // Senate (historical archive — frozen at Nov 2020, see notes above).
  // Date filter intentionally NOT applied: the archive only goes up to Nov
  // 2020, so any "last N days" cutoff would drop all 8,350 records. Dedup
  // on (politician_id, trade_date, ticker, trade_type) below handles
  // re-runs from the cron without inserting duplicates.
  console.log('Fetching Senate Stock Watcher feed (historical archive)...');
  try {
    const res = await axios.get(SENATE_FEED, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 60_000,
      maxContentLength: 200 * 1024 * 1024,
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    let kept = 0;
    for (const t of rows) {
      const tradeDate = parseSwDate(t.transaction_date);
      if (!tradeDate) continue;
      const type = normalizeTradeType(t.type);
      if (!type) continue;
      trades.push({
        filer_name: cleanFilerName(t.senator),
        ticker: (t.ticker && t.ticker !== '--') ? t.ticker : null,
        asset_name: t.asset_description || null,
        trade_type: type,
        amount_range_low: parseAmountRange(t.amount, 'low'),
        amount_range_high: parseAmountRange(t.amount, 'high'),
        trade_date: tradeDate,
        disclosure_date: parseSwDate(t.disclosure_date),
        source: 'senate_stock_watcher',
        source_url: t.ptr_link || null,
      });
      kept++;
    }
    console.log(`  Senate: ${rows.length} rows in feed, ${kept} usable historical records`);
  } catch (err) {
    console.error(`  Senate Stock Watcher fetch failed: ${err.message}`);
  }

  return trades;
}

// ---------------------------------------------------------------------------
// Match trade filer name to candidate_profiles
// ---------------------------------------------------------------------------

// Pull (first, last) tokens from a name regardless of input format.
// "Ron L Wyden"           → { first: "Ron",  last: "Wyden" }
// "Tommy H Tuberville"    → { first: "Tommy", last: "Tuberville" }
// "Hon. Daniel S. Goldman" → { first: "Daniel", last: "Goldman" }
// "Pelosi, Nancy"         → { first: "Nancy", last: "Pelosi" }
// "Wyden, Ron L"          → { first: "Ron",   last: "Wyden" }
function extractFirstLast(name) {
  if (!name) return null;
  let s = String(name).trim();
  // Drop honorifics
  s = s.replace(/^(Hon\.|Mr\.|Mrs\.|Ms\.|Dr\.|Sen\.|Rep\.)\s+/i, '');
  // Drop suffixes
  s = s.replace(/[\s,]+(Jr\.?|Sr\.?|II|III|IV)$/i, '');
  // Drop trailing periods/initials like "Daniel S." → "Daniel S"
  s = s.replace(/\./g, '');
  let first, last;
  if (s.includes(',')) {
    const [lastPart, firstPart] = s.split(',').map(p => p.trim());
    first = (firstPart || '').split(/\s+/)[0];
    last = lastPart.split(/\s+/).pop();
  } else {
    const tokens = s.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;
    first = tokens[0];
    last = tokens[tokens.length - 1];
  }
  if (!first || !last || first.length < 2 || last.length < 2) return null;
  return { first, last };
}

// Cache lookups across the run. With 7,887 records and ~120 unique senators
// in the data, hitting the DB once per record is wasteful — and a busted
// match query against 15k candidate_profiles isn't free either.
const filerMatchCache = new Map();

async function matchFilerToCandidate(filerName) {
  if (!filerName) return null;
  if (filerMatchCache.has(filerName)) return filerMatchCache.get(filerName);

  const fl = extractFirstLast(filerName);
  if (!fl) {
    filerMatchCache.set(filerName, null);
    return null;
  }

  // Match strategy, ranked by precision:
  //  1. display_name ILIKE 'first% last' or 'first %last%' — handles
  //     "Ron Wyden" matching for both "Ron L Wyden" and "Ron Wyden" inputs.
  //  2. last name in display_name AND first name token in display_name —
  //     catches reversed orders like "Wyden, Ron".
  // The OFFICE filter restricts to senators/reps to avoid matching state
  // legislators or candidates with the same name.
  const { rows } = await pool.query(
    `SELECT cp.id, cp.display_name, cp.fec_office_type,
            COALESCE(
              (SELECT array_agg(lc.name)
                 FROM committee_memberships cm
                 JOIN legislative_committees lc ON cm.committee_id = lc.id
                WHERE cm.candidate_id = cp.id AND cm.is_current = TRUE),
              ARRAY[]::text[]
            ) AS committees
       FROM candidate_profiles cp
      WHERE (cp.fec_office_type IN ('S', 'H') OR cp.fec_office_type IS NULL)
        AND cp.display_name ~* $1
      ORDER BY
        CASE WHEN cp.fec_office_type = 'S' THEN 0
             WHEN cp.fec_office_type = 'H' THEN 1
             ELSE 2 END,
        LENGTH(cp.display_name) ASC
      LIMIT 1`,
    // Match: display_name contains both first AND last as whole words.
    // Postgres regex \y is a word boundary. Case-insensitive via ~*.
    [`\\y${fl.first}\\y.*\\y${fl.last}\\y|\\y${fl.last}\\y.*\\y${fl.first}\\y`]
  );

  const result = rows[0] || null;
  filerMatchCache.set(filerName, result);
  return result;
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
