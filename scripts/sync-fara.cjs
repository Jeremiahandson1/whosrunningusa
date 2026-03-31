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

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

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
  let data;
  try {
    data = await fetchJSON(`${FARA_API_BASE}/Registrants/json`);
  } catch (err) {
    console.error(`  Failed to fetch registrants: ${err.message}`);
    return 0;
  }

  const records = Array.isArray(data) ? data : (data.REGISTRANTS_ROWS || data.data || []);
  console.log(`  Received ${records.length} registrant records`);

  let upserted = 0;
  for (const r of records) {
    const regNumber = String(r.Registration_Number || r.registration_number || r.reg_number || '').trim();
    const name = r.Registrant_Name || r.registrant_name || r.Name || '';
    if (!regNumber || !name) continue;

    const address = [r.Address_1, r.Address_2, r.City, r.State, r.Zip]
      .filter(Boolean).join(', ') || r.address || null;
    const state = r.State || r.state || null;
    const regDate = r.Registration_Date || r.registration_date || null;
    const termDate = r.Termination_Date || r.termination_date || null;
    const isActive = !termDate;
    const sourceUrl = `${FARA_PROFILE_BASE}/${regNumber}`;

    if (dryRun) {
      console.log(`  [dry-run] Registrant: ${name} (${regNumber})`);
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

  console.log(`  Upserted ${upserted} registrants`);
  return upserted;
}

// ---------------------------------------------------------------------------
// Step 2: Foreign Principals
// ---------------------------------------------------------------------------

async function syncPrincipals(dryRun) {
  console.log('\nStep 2: Fetching foreign principals...');
  let data;
  try {
    data = await fetchJSON(`${FARA_API_BASE}/ForeignPrincipals/json`);
  } catch (err) {
    console.error(`  Failed to fetch foreign principals: ${err.message}`);
    return 0;
  }

  const records = Array.isArray(data) ? data : (data.FOREIGN_PRINCIPALS_ROWS || data.data || []);
  console.log(`  Received ${records.length} foreign principal records`);

  let upserted = 0;
  for (const p of records) {
    const name = p.Foreign_Principal || p.foreign_principal || p.Name || '';
    const country = p.Country || p.country || p.FP_Country || '';
    if (!name || !country) continue;

    const govEntity = p.Government_Entity || p.government_entity || null;
    const isGov = !!(govEntity || (p.Principal_Type || '').toLowerCase().includes('government'));
    const regNumber = String(p.Registration_Number || p.registration_number || '').trim();

    if (dryRun) {
      console.log(`  [dry-run] Principal: ${name} (${country})`);
      upserted++;
      continue;
    }

    // Upsert principal by name + country (no natural unique key in FARA data)
    const { rows } = await pool.query(
      `INSERT INTO fara_principals
         (principal_name, country, government_entity, is_government, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [name, country, govEntity, isGov]
    );

    // If already existed, look it up
    let principalId;
    if (rows.length > 0) {
      principalId = rows[0].id;
    } else {
      const existing = await pool.query(
        `SELECT id FROM fara_principals WHERE principal_name = $1 AND country = $2 LIMIT 1`,
        [name, country]
      );
      principalId = existing.rows[0]?.id;
    }

    // Step 3 inline: Link to registrant if we have a registration_number
    if (principalId && regNumber) {
      const reg = await pool.query(
        `SELECT id FROM fara_registrants WHERE registration_number = $1 LIMIT 1`,
        [regNumber]
      );
      if (reg.rows.length > 0) {
        await pool.query(
          `INSERT INTO fara_contracts (registrant_id, principal_id, contract_description, source_url)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [reg.rows[0].id, principalId,
           `FARA registration linkage for ${name}`,
           `${FARA_PROFILE_BASE}/${regNumber}`]
        );
      }
    }

    upserted++;
  }

  console.log(`  Upserted ${upserted} foreign principals`);
  return upserted;
}

// ---------------------------------------------------------------------------
// Step 3: Contracts (handled inline during principal sync above)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step 4: Short Form Activities (contacts)
// ---------------------------------------------------------------------------

async function syncActivities(dryRun) {
  console.log('\nStep 4: Fetching short form activities (contacts)...');
  let data;
  try {
    data = await fetchJSON(`${FARA_API_BASE}/ShortFormActivities/json`);
  } catch (err) {
    console.error(`  Failed to fetch activities: ${err.message}`);
    return { contacts: 0, matched: 0 };
  }

  const records = Array.isArray(data) ? data : (data.SHORT_FORM_ACTIVITIES_ROWS || data.data || []);
  console.log(`  Received ${records.length} activity records`);

  let contacts = 0;
  let matched = 0;

  for (const a of records) {
    const regNumber = String(a.Registration_Number || a.registration_number || '').trim();
    const contactName = a.Contact_Name || a.contact_name || a.Official_Contacted || '';
    const contactTitle = a.Contact_Title || a.contact_title || a.Title || null;
    const contactOffice = a.Contact_Office || a.contact_office || a.Agency || null;
    const contactDate = a.Contact_Date || a.contact_date || a.Date || null;
    const contactType = a.Contact_Type || a.contact_type || a.Method || null;
    const description = a.Description || a.description || a.Purpose || null;

    if (!regNumber) continue;

    // Look up registrant
    const reg = await pool.query(
      `SELECT id FROM fara_registrants WHERE registration_number = $1 LIMIT 1`,
      [regNumber]
    );
    if (reg.rows.length === 0) continue;
    const registrantId = reg.rows[0].id;

    // Try to find the principal linked to this registrant
    const princ = await pool.query(
      `SELECT fp.id FROM fara_principals fp
       JOIN fara_contracts fc ON fc.principal_id = fp.id
       WHERE fc.registrant_id = $1
       LIMIT 1`,
      [registrantId]
    );
    const principalId = princ.rows[0]?.id || null;

    // Step 5: Try to match contact_name against candidate_profiles
    let candidateId = null;
    if (contactName) {
      const nameMatch = await pool.query(
        `SELECT id FROM candidate_profiles
         WHERE display_name ILIKE $1
         LIMIT 1`,
        [`%${contactName.trim()}%`]
      );
      if (nameMatch.rows.length > 0) {
        candidateId = nameMatch.rows[0].id;
        matched++;
      }
    }

    if (dryRun) {
      const matchLabel = candidateId ? ' [MATCHED]' : '';
      console.log(`  [dry-run] Contact: ${contactName || 'unknown'} via registrant ${regNumber}${matchLabel}`);
      contacts++;
      continue;
    }

    await pool.query(
      `INSERT INTO fara_contacts
         (registrant_id, principal_id, candidate_id, contact_date,
          contact_type, contact_office, contact_name, contact_title,
          description, source_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT DO NOTHING`,
      [registrantId, principalId, candidateId,
       contactDate || null, contactType || null,
       contactOffice || null, contactName || null,
       contactTitle || null, description || null,
       `${FARA_PROFILE_BASE}/${regNumber}`]
    );
    contacts++;
  }

  console.log(`  Inserted ${contacts} contacts (${matched} matched to candidates)`);
  return { contacts, matched };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  console.log('=== FARA Data Sync ===');
  console.log(`Dry run: ${args.dryRun}`);
  console.log(`Source: ${FARA_API_BASE}`);
  console.log('');

  const registrants = await syncRegistrants(args.dryRun);
  const principals = await syncPrincipals(args.dryRun);
  const { contacts, matched } = await syncActivities(args.dryRun);

  console.log('\n=== Summary ===');
  console.log(`Registrants upserted: ${registrants}`);
  console.log(`Foreign principals upserted: ${principals}`);
  console.log(`Contracts created: (linked during principal sync)`);
  console.log(`Contacts inserted: ${contacts}`);
  console.log(`Contacts matched to candidates: ${matched}`);
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
