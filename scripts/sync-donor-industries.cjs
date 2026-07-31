#!/usr/bin/env node

/**
 * Sync Donor Industries — populate politician_donor_industries from FEC
 * Schedule A employer aggregates.
 *
 * This table is the keystone for Follow the Money, the Accountability
 * Mirror, and Rubber Stamp's donor-alignment column: it previously had NO
 * writer anywhere in the repo (OpenSecrets was the intended source; its API
 * is discontinued). This computes the same shape from primary-source FEC
 * data instead:
 *
 *   candidate → principal/authorized committees (/candidate/{id}/committees)
 *   committee → itemized receipts aggregated by employer
 *               (/schedules/schedule_a/by_employer, sorted by total)
 *   employer  → industry via keyword classification below
 *
 * Coverage note: employer aggregates cover ITEMIZED individual receipts
 * (over-$200 donors). "Retired" and "Not employed" are kept as their own
 * categories — they are consistently among the largest and hiding them
 * would misrepresent the distribution.
 *
 * Ordering: candidates WITH voting records first (the accountability tools
 * need donors+votes together), then least-recently-synced. The nightly step
 * has a 30-minute window; --limit bounds a run and the ordering makes
 * successive runs converge.
 *
 * Usage:
 *   node scripts/sync-donor-industries.cjs --cycle=2026 --limit=150
 *   node scripts/sync-donor-industries.cjs --dry-run
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch (_) {}

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const FEC_BASE = 'https://api.open.fec.gov/v1';
const FEC_API_KEY = process.env.FEC_API_KEY;

function parseArgs() {
  const args = { cycle: 2026, limit: 150, dryRun: false };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--cycle=')) args.cycle = parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.split('=')[1], 10);
    else if (a === '--dry-run') args.dryRun = true;
  }
  return args;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// FEC allows 1,000 requests/hour — pace and back off on 429.
const FEC_MIN_INTERVAL_MS = 3700;
let lastFecCall = 0;
async function fecGet(path, params = {}) {
  params.api_key = FEC_API_KEY;
  for (let attempt = 0; ; attempt++) {
    const wait = lastFecCall + FEC_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastFecCall = Date.now();
    try {
      const resp = await axios.get(`${FEC_BASE}${path}`, { params, timeout: 30000 });
      return resp.data;
    } catch (err) {
      if (err.response && err.response.status === 429 && attempt < 3) {
        const backoff = 60000 * (attempt + 1);
        console.log(`  429 from FEC — backing off ${Math.round(backoff / 1000)}s`);
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Employer → industry classification
// ---------------------------------------------------------------------------

const INDUSTRY_RULES = [
  ['Retired', /\bRETIRED\b/],
  ['Not Employed / Homemaker', /\bNOT.?EMPLOYED\b|\bUNEMPLOYED\b|\bHOMEMAKER\b|^NONE$|^N\/A$/],
  ['Self-Employed', /\bSELF.?EMPLOYED\b|^SELF$/],
  ['Securities & Investment', /\bCAPITAL\b|\bINVESTMENT\b|\bSECURITIES\b|\bHEDGE\b|\bEQUITY\b|\bASSET MANAGEMENT\b|GOLDMAN|JPMORGAN|MORGAN STANLEY|BLACKROCK|BLACKSTONE|CITADEL|FIDELITY|VANGUARD|CHARLES SCHWAB/],
  ['Banking & Finance', /\bBANK\b|\bBANCORP\b|\bCREDIT UNION\b|\bFINANCIAL\b|\bFINANCE\b|WELLS FARGO|CITIGROUP|CITIBANK/],
  ['Crypto & Fintech', /COINBASE|RIPPLE|\bCRYPTO\b|KRAKEN|BINANCE|ANDREESSEN|A16Z|PAYPAL|STRIPE|BLOCK INC/],
  ['Technology', /GOOGLE|ALPHABET|MICROSOFT|\bAPPLE\b|AMAZON|\bMETA\b|FACEBOOK|NETFLIX|ORACLE|SALESFORCE|\bSOFTWARE\b|\bTECH\b|NVIDIA|INTEL|\bIBM\b|CISCO|QUALCOMM|TESLA|SPACEX|PALANTIR|OPENAI|ANTHROPIC/],
  ['Law & Lobbying', /\bLAW\b|\bLLP\b|\bATTORNEY\b|\bLEGAL\b|\bLOBBY/],
  ['Health Care', /\bHOSPITAL\b|\bHEALTH\b|\bMEDICAL\b|\bCLINIC\b|\bPHYSICIAN\b|\bDENTAL\b|KAISER|\bNURS/],
  ['Pharmaceuticals', /PFIZER|MERCK|\bPHARMA\b|JOHNSON & JOHNSON|ELI LILLY|AMGEN|ABBVIE|BIOTECH|GENENTECH|MODERNA/],
  ['Insurance', /\bINSURANCE\b|AETNA|ANTHEM|UNITEDHEALTH|ALLSTATE|STATE FARM|GEICO|PRUDENTIAL|METLIFE/],
  ['Real Estate & Construction', /\bREALTY\b|\bREAL ESTATE\b|\bPROPERTIES\b|\bDEVELOPMENT\b|\bCONSTRUCTION\b|\bBUILDERS\b|\bHOMES\b|\bCONTRACTOR/],
  ['Oil & Gas / Energy', /\bOIL\b|\bENERGY\b|\bPETROLEUM\b|\bGAS\b|EXXON|CHEVRON|SHELL|\bDRILLING\b|HALLIBURTON|\bSOLAR\b|\bUTILIT/],
  ['Defense & Aerospace', /LOCKHEED|RAYTHEON|BOEING|NORTHROP|GENERAL DYNAMICS|\bDEFENSE\b|AEROSPACE|BAE SYSTEMS/],
  ['Education', /\bUNIVERSITY\b|\bCOLLEGE\b|\bSCHOOL\b|\bEDUCATION\b|\bACADEM/],
  ['Government & Public Sector', /\bSTATE OF\b|\bCITY OF\b|\bCOUNTY OF?\b|US ARMY|US NAVY|U\.S\. |FEDERAL |\bGOVERNMENT\b|\bPOSTAL\b|\bVA\b MEDICAL/],
  ['Organized Labor', /\bUNION\b|AFL.?CIO|SEIU|TEAMSTERS|\bUAW\b|\bIBEW\b|AFSCME|\bLOCAL \d+/],
  ['Agriculture & Food', /\bFARM\b|\bAGRICULT|\bRANCH\b|\bDAIRY\b|CARGILL|TYSON|\bFOODS?\b/],
  ['Media & Entertainment', /DISNEY|WARNER|COMCAST|\bMEDIA\b|\bSTUDIOS?\b|\bENTERTAINMENT\b|\bBROADCAST|\bMUSIC\b|\bFILM\b/],
  ['Telecommunications', /\bAT&T\b|VERIZON|T-MOBILE|\bTELECOM|CHARTER COMMUNICATIONS/],
  ['Transportation & Logistics', /\bAIRLINES?\b|\bRAILROAD\b|\bTRUCKING\b|FEDEX|\bUPS\b|DELTA AIR|UNITED AIR|AMERICAN AIR|\bLOGISTICS\b/],
  ['Hospitality & Restaurants', /\bHOTEL\b|\bRESTAURANT\b|\bRESORT\b|MARRIOTT|HILTON|MCDONALD/],
  ['Retail & Consumer', /WALMART|TARGET|COSTCO|\bRETAIL\b|\bSTORES?\b|HOME DEPOT|WALGREENS|\bCVS\b/],
  ['Consulting & Accounting', /\bCONSULT|DELOITTE|MCKINSEY|ACCENTURE|\bACCOUNT|ERNST & YOUNG|\bKPMG\b|\bPWC\b/],
  ['Manufacturing', /\bMANUFACTUR|GENERAL ELECTRIC|\bGE\b|CATERPILLAR|3M\b|\bINDUSTRIES\b|\bSTEEL\b/],
];

function classifyEmployer(employer) {
  const e = (employer || '').toUpperCase().trim();
  if (!e) return 'Unclassified';
  for (const [industry, rx] of INDUSTRY_RULES) {
    if (rx.test(e)) return industry;
  }
  return 'Other';
}

// ---------------------------------------------------------------------------

async function getCandidates(cycle, limit) {
  // Voting-record holders first (accountability tools need donors AND votes),
  // then least-recently-synced.
  const { rows } = await pool.query(
    `SELECT cp.id, cp.display_name, cp.fec_candidate_id
       FROM candidate_profiles cp
       LEFT JOIN (
         SELECT politician_id, max(created_at) AS last_synced
           FROM politician_donor_industries
          WHERE cycle_year = $1
          GROUP BY politician_id
       ) pdi ON pdi.politician_id = cp.id
      WHERE cp.fec_candidate_id IS NOT NULL AND cp.fec_candidate_id != ''
      ORDER BY
        (EXISTS (SELECT 1 FROM voting_records vr WHERE vr.candidate_id = cp.id)) DESC,
        pdi.last_synced ASC NULLS FIRST,
        cp.display_name
      LIMIT $2`,
    [cycle, limit]
  );
  return rows;
}

async function main() {
  const opts = parseArgs();

  if (!FEC_API_KEY) {
    console.log('Skipping: FEC_API_KEY not set');
    process.exit(0);
  }

  console.log(`\n=== Sync Donor Industries ===`);
  console.log(`Cycle: ${opts.cycle}  Limit: ${opts.limit}  Dry run: ${opts.dryRun}\n`);

  const candidates = await getCandidates(opts.cycle, opts.limit);
  console.log(`Processing ${candidates.length} candidates\n`);

  let synced = 0, noCommittee = 0, noReceipts = 0, errors = 0;

  for (const candidate of candidates) {
    try {
      const cmtes = await fecGet(`/candidate/${candidate.fec_candidate_id}/committees/`, {
        cycle: opts.cycle, designation: ['P', 'A'], per_page: 10,
      });
      const committeeIds = (cmtes.results || []).map(c => c.committee_id);
      if (committeeIds.length === 0) {
        noCommittee++;
        // Record the visit so the rotation moves on rather than retrying the
        // same committee-less candidates every run.
        if (!opts.dryRun) {
          await pool.query(
            `INSERT INTO politician_donor_industries (politician_id, industry_name, total_amount, donor_count, cycle_year, source, source_url)
             VALUES ($1, '__no_committee__', 0, 0, $2, 'fec', NULL)
             ON CONFLICT (politician_id, industry_name, cycle_year) DO UPDATE SET created_at = NOW()`,
            [candidate.id, opts.cycle]
          );
        }
        continue;
      }

      // Aggregate top employers across the candidate's committees
      const industryTotals = new Map(); // industry -> {amount, donors}
      let sawReceipts = false;
      for (const cid of committeeIds) {
        for (let page = 1; page <= 2; page++) {
          const data = await fecGet('/schedules/schedule_a/by_employer/', {
            committee_id: cid, cycle: opts.cycle, per_page: 100, page,
            sort: '-total',
          });
          const results = data.results || [];
          if (results.length === 0) break;
          sawReceipts = true;
          for (const r of results) {
            const industry = classifyEmployer(r.employer);
            const cur = industryTotals.get(industry) || { amount: 0, donors: 0 };
            cur.amount += parseFloat(r.total) || 0;
            cur.donors += parseInt(r.count) || 0;
            industryTotals.set(industry, cur);
          }
          if (!data.pagination || page >= (data.pagination.pages || 1)) break;
        }
      }

      if (!sawReceipts) {
        noReceipts++;
        if (!opts.dryRun) {
          await pool.query(
            `INSERT INTO politician_donor_industries (politician_id, industry_name, total_amount, donor_count, cycle_year, source, source_url)
             VALUES ($1, '__no_itemized_receipts__', 0, 0, $2, 'fec', NULL)
             ON CONFLICT (politician_id, industry_name, cycle_year) DO UPDATE SET created_at = NOW()`,
            [candidate.id, opts.cycle]
          );
        }
        continue;
      }

      const sourceUrl = `https://www.fec.gov/data/receipts/?committee_id=${committeeIds[0]}&two_year_transaction_period=${opts.cycle}`;

      if (opts.dryRun) {
        const top = [...industryTotals.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 5);
        console.log(`[DRY RUN] ${candidate.display_name}: ${top.map(([k, v]) => `${k} $${Math.round(v.amount).toLocaleString()}`).join(' | ')}`);
        synced++;
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `DELETE FROM politician_donor_industries WHERE politician_id = $1 AND cycle_year = $2`,
          [candidate.id, opts.cycle]
        );
        for (const [industry, v] of industryTotals) {
          await client.query(
            `INSERT INTO politician_donor_industries
               (politician_id, industry_name, total_amount, donor_count, cycle_year, source, source_url)
             VALUES ($1, $2, $3, $4, $5, 'fec', $6)`,
            [candidate.id, industry, Math.round(v.amount * 100) / 100, v.donors, opts.cycle, sourceUrl]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      synced++;
      const top = [...industryTotals.entries()].sort((a, b) => b[1].amount - a[1].amount)[0];
      console.log(`  ${candidate.display_name}: ${industryTotals.size} industries, top: ${top[0]} $${Math.round(top[1].amount).toLocaleString()}`);
    } catch (err) {
      errors++;
      console.error(`  ERROR ${candidate.display_name}: ${err.message}`);
    }
  }

  console.log(`\n=== Sync Complete ===`);
  console.log(`Synced: ${synced}  No committee: ${noCommittee}  No itemized receipts: ${noReceipts}  Errors: ${errors}`);
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err.message); pool.end(); process.exit(1); });
