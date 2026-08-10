#!/usr/bin/env node

/**
 * Sync Senate LDA (Lobbying Disclosure Act) filings for foreign clients.
 *
 * FARA's API publishes no dollar amounts; the LDA API does. For every country
 * that appears in fara_principals or foreign_aid_country_summaries, fetch the
 * filings whose CLIENT is based in that country and store income/expenses.
 * The influence chain sums these by client_country_code.
 *
 * API: https://lda.senate.gov/api/v1/filings/?client_country=<ISO2>&filing_year=YYYY
 * Anonymous access is rate-limited (~15 req/min) — pace at 4.5s/request.
 *
 * Usage: node scripts/sync-lda.cjs [--year=2026] [--country=UKR]
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch (_) {}

const { Pool } = require('pg');
const axios = require('axios');
const { iso3ToIso2 } = require('./lib/country-codes.cjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const API = 'https://lda.senate.gov/api/v1/filings/';
const RATE_MS = 4500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseArgs() {
  const args = { year: new Date().getFullYear(), country: null };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--year=')) args.year = parseInt(a.slice(7), 10);
    if (a.startsWith('--country=')) args.country = a.slice(10).toUpperCase();
  }
  return args;
}

async function fetchPage(url) {
  for (let attempt = 1; ; attempt++) {
    await sleep(RATE_MS);
    try {
      const res = await axios.get(url, { timeout: 60000, headers: { Accept: 'application/json', 'User-Agent': 'WhosRunningUSA/1.0 civic-data-project' } });
      return res.data;
    } catch (err) {
      const status = err.response?.status;
      if (status === 429 && attempt <= 4) {
        const retryAfter = parseInt(err.response?.headers?.['retry-after'], 10);
        const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : attempt * 30000;
        console.log(`  429 rate-limited, waiting ${Math.round(waitMs / 1000)}s...`);
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
}

async function syncCountry(code3, year) {
  const code2 = iso3ToIso2(code3);
  if (!code2) { console.log(`  ${code3}: no ISO2 mapping, skipped`); return 0; }

  let url = `${API}?client_country=${code2}&filing_year=${year}&page_size=25`;
  let upserted = 0;
  while (url) {
    const data = await fetchPage(url);
    for (const f of (data.results || [])) {
      if (!f.filing_uuid) continue;
      await pool.query(
        `INSERT INTO lda_filings
           (filing_uuid, filing_type, filing_year, filing_period,
            registrant_name, client_name, client_country, client_country_code,
            income, expenses, source_url, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
         ON CONFLICT (filing_uuid) DO UPDATE SET
           income = EXCLUDED.income, expenses = EXCLUDED.expenses,
           filing_type = EXCLUDED.filing_type, updated_at = NOW()`,
        [
          f.filing_uuid, f.filing_type || null, f.filing_year || year,
          f.filing_period || null,
          f.registrant?.name || null, f.client?.name || null,
          f.client?.country_display || f.client?.country || null, code3,
          f.income != null ? parseFloat(f.income) : null,
          f.expenses != null ? parseFloat(f.expenses) : null,
          f.filing_document_url || f.url || null,
        ]
      );
      upserted++;
    }
    url = data.next || null;
  }
  return upserted;
}

async function main() {
  const args = parseArgs();
  console.log(`=== LDA Filings Sync (FY${args.year}) ===`);

  let codes;
  if (args.country) {
    codes = [args.country];
  } else {
    const { rows } = await pool.query(`
      SELECT DISTINCT country_code AS c FROM fara_principals WHERE country_code IS NOT NULL
      UNION SELECT DISTINCT country_code FROM foreign_aid_country_summaries
    `);
    codes = rows.map(r => r.c).sort();
  }
  console.log(`Countries to sync: ${codes.length}`);

  let total = 0, failed = 0;
  for (const code of codes) {
    try {
      const n = await syncCountry(code, args.year);
      if (n > 0) console.log(`  ${code}: ${n} filings`);
      total += n;
    } catch (err) {
      failed++;
      console.error(`  Error for ${code}: ${err.message}`);
    }
  }
  console.log(`\n=== Summary ===\nFilings upserted: ${total}\nCountries failed: ${failed}`);
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
