#!/usr/bin/env node

/**
 * Sync FARA (Foreign Agents Registration Act) Data
 *
 * Downloads bulk data from the FARA eFiling system and populates
 * fara_registrants, fara_principals, fara_contracts, and fara_contacts.
 * Attempts to match contacted officials against candidate_profiles.
 *
 * Usage:
 *   node scripts/sync-fara.js
 *   node scripts/sync-fara.js --dry-run
 *
 * Required env vars:
 *   DATABASE_URL
 *
 * Data source:
 *   https://efile.fara.gov/bulk-data
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = { dryRun: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
  }
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const FARA_API_BASE = 'https://efile.fara.gov/api/v1';
const FARA_PROFILE_BASE = 'https://efile.fara.gov/ords/fara/q';

const HTTP_OPTS = {
  timeout: 60000,
  headers: { 'User-Agent': 'WhosRunningUSA/1.0 civic-data-project' },
};

// ---------------------------------------------------------------------------
// Fetch helpers with rate limiting
// ---------------------------------------------------------------------------

async function fetchJSON(url) {
  await sleep(500); // rate limit: 500ms between requests
  console.log(`  Fetching ${url}...`);
  const res = await axios.get(url, HTTP_OPTS);
  return res.data;
}

// ---------------------------------------------------------------------------
// Step 1: Registrants
// ---------------------------------------------------------------------------

async function syncRegistrants(dryRun) {
  console.log('\nStep 1: Fetching FARA registrants...');

  // FARA API change (sometime before 2026-04): the bare /Registrants/json
  // path was removed. Registrants are now listed by status — Active and
  // Terminated each have their own endpoint — so fetch both and merge.
  const allRecords = [];
  for (const status of ['Active', 'Terminated']) {
    let data;
    try {
      data = await fetchJSON(`${FARA_API_BASE}/Registrants/json/${status}`);
    } catch (err) {
      console.error(`  Failed to fetch ${status} registrants: ${err.message}`);
      continue;
    }
    // Response shape (verified 2026-07): {"REGISTRANTS_ACTIVE":{"ROW":[...]}}
    // (REGISTRANTS_TERMINATED for the terminated list). A single row may come
    // back as a bare object rather than an array.
    const rowset = (data && typeof data === 'object') ? data[`REGISTRANTS_${status.toUpperCase()}`] : null;
    const rawRows = rowset && rowset.ROW ? rowset.ROW : [];
    const records = Array.isArray(rawRows) ? rawRows : [rawRows];
    console.log(`  Received ${records.length} ${status} registrant records`);
    for (const r of records) allRecords.push({ ...r, _status: status });
  }

  let upserted = 0;
  const activeRegNumbers = [];
  for (const r of allRecords) {
    const regNumber = String(r.Registration_Number || r.registration_number || r.reg_number || '').trim();
    const name = r.Registrant_Name || r.registrant_name || r.Name || '';
    if (!regNumber || !name) continue;

    const address = [r.Address_1, r.Address_2, r.City, r.State, r.Zip]
      .filter(Boolean).join(', ') || r.address || null;
    const state = r.State || r.state || null;
    const regDate = r.Registration_Date || r.registration_date || null;
    const termDate = r.Termination_Date || r.termination_date || null;
    const isActive = r._status === 'Active';
    const sourceUrl = `${FARA_PROFILE_BASE}/${regNumber}`;

    if (isActive) activeRegNumbers.push(regNumber);

    if (dryRun) {
      console.log(`  [dry-run] Registrant: ${name} (${regNumber}, ${r._status})`);
      upserted++;
      continue;
    }

    await pool.query(
      `INSERT INTO fara_registrants
         (registration_number, registrant_name, address, state,
          registration_date, termination_date, is_active, source_url, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (registration_number) DO UPDATE SET
         registrant_name = EXCLUDED.registrant_name,
         address = EXCLUDED.address,
         state = EXCLUDED.state,
         registration_date = EXCLUDED.registration_date,
         termination_date = EXCLUDED.termination_date,
         is_active = EXCLUDED.is_active,
         source_url = EXCLUDED.source_url,
         updated_at = NOW()`,
      [regNumber, name, address, state && state.length <= 2 ? state : null,
       regDate || null, termDate || null, isActive, sourceUrl]
    );
    upserted++;
  }

  console.log(`  Upserted ${upserted} registrants (${activeRegNumbers.length} active)`);
  return { upserted, activeRegNumbers };
}

// ---------------------------------------------------------------------------
// Step 2: Foreign Principals
// ---------------------------------------------------------------------------

async function syncPrincipals(activeRegNumbers, dryRun) {
  console.log(`\nStep 2: Fetching foreign principals for ${activeRegNumbers.length} active registrants...`);

  // FARA API change: there is no longer a single /ForeignPrincipals/json
  // list endpoint. Principals must be queried per-registrant via
  // /ForeignPrincipals/json/Active/:registrationNumber.
  let upserted = 0;
  let processed = 0;
  let notFound = 0;

  for (const regNumber of activeRegNumbers) {
    let data;
    try {
      data = await fetchJSON(`${FARA_API_BASE}/ForeignPrincipals/json/Active/${encodeURIComponent(regNumber)}`);
    } catch (err) {
      // 404 here just means the registrant has no active foreign principals
      // on file — common case, don't log noise for it.
      if (String(err.message).includes('404') || err.response?.status === 404) {
        notFound++;
      } else {
        console.error(`  Failed for ${regNumber}: ${err.message}`);
      }
      continue;
    }

    // Response shape (verified 2026-07): {"ROWSET":{"ROW":[...]}} with rows
    // like {FP_NAME, COUNTRY_NAME, REG_NUMBER, ...}. Empty registrants return
    // {"ROWSET":""}; some return a non-JSON error body (data is a string).
    const rowset = (data && typeof data === 'object') ? data.ROWSET : null;
    const rawRows = rowset && rowset.ROW ? rowset.ROW : [];
    const records = Array.isArray(rawRows) ? rawRows : [rawRows];
    if (records.length === 0) continue;

    // Resolve registrant id once per regNumber
    let registrantId = null;
    if (!dryRun) {
      const reg = await pool.query(
        `SELECT id FROM fara_registrants WHERE registration_number = $1 LIMIT 1`,
        [regNumber]
      );
      registrantId = reg.rows[0]?.id || null;
    }

    for (const p of records) {
      const name = p.FP_NAME || p.Foreign_Principal || p.foreign_principal || p.Name || '';
      const country = p.COUNTRY_NAME || p.Country || p.country || p.FP_Country || '';
      if (!name || !country) continue;

      const govEntity = p.Government_Entity || p.government_entity || null;
      // The API exposes no explicit government flag — infer from the name.
      const isGov = !!(govEntity ||
        (p.Principal_Type || '').toLowerCase().includes('government') ||
        /embassy|consulate|ministry|government|republic of|state of/i.test(name));

      if (dryRun) {
        console.log(`  [dry-run] ${regNumber} → ${name} (${country})`);
        upserted++;
        continue;
      }

      // Upsert principal by name + country. The table has no unique
      // constraint on the pair, so ON CONFLICT can never fire — check for an
      // existing row first or every re-run duplicates every principal.
      let principalId;
      const existing = await pool.query(
        `SELECT id FROM fara_principals WHERE principal_name = $1 AND country = $2 LIMIT 1`,
        [name, country]
      );
      if (existing.rows.length > 0) {
        principalId = existing.rows[0].id;
      } else {
        const { rows } = await pool.query(
          `INSERT INTO fara_principals
             (principal_name, country, government_entity, is_government, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING id`,
          [name, country, govEntity, isGov]
        );
        principalId = rows[0].id;
      }

      // Link principal to registrant via fara_contracts
      if (principalId && registrantId) {
        await pool.query(
          `INSERT INTO fara_contracts (registrant_id, principal_id, contract_description, source_url)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [registrantId, principalId,
           `FARA registration linkage for ${name}`,
           `${FARA_PROFILE_BASE}/${regNumber}`]
        );
      }

      upserted++;
    }

    processed++;
    if (processed % 100 === 0) {
      console.log(`  Progress: ${processed}/${activeRegNumbers.length} registrants checked, ${upserted} principals upserted`);
    }
  }

  console.log(`  Upserted ${upserted} foreign principals across ${processed} registrants (${notFound} had no FP data)`);
  return upserted;
}

// ---------------------------------------------------------------------------
// Step 3: Contracts (handled inline during principal sync above)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step 4: Short Form Activities (contacts) — DISABLED
// ---------------------------------------------------------------------------
// The old /api/v1/ShortFormActivities/json endpoint, which returned records
// of FARA agents' contacts with US officials, no longer exists in the FARA
// API. The only short-form endpoint exposed today is
// /api/v1/ShortFormRegistrants/json/{Active|Terminated}/:registrationNumber,
// which lists individual foreign agents under a primary registrant — not
// who they contacted. The contact-with-officials data now lives only in
// the registration-document PDFs (RegDocs endpoint).
//
// Until we add a PDF-parsing path or an alternative source, this step is a
// no-op so the cron stops 404-ing.

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  console.log('=== FARA Data Sync ===');
  console.log(`Dry run: ${args.dryRun}`);
  console.log(`Source: ${FARA_API_BASE}`);
  console.log('');

  const { upserted: registrants, activeRegNumbers } = await syncRegistrants(args.dryRun);
  const principals = await syncPrincipals(activeRegNumbers, args.dryRun);

  console.log('\n=== Summary ===');
  console.log(`Registrants upserted:        ${registrants}`);
  console.log(`Foreign principals upserted: ${principals}`);
  console.log(`Contracts created:           (linked during principal sync)`);
  console.log(`Contacts:                    skipped — no longer exposed by FARA API (see comment in script)`);
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
