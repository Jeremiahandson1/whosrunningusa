#!/usr/bin/env node

/**
 * Backfill Historical Senators (and Representatives)
 *
 * Pulls the @unitedstates/congress-legislators dataset and inserts shadow
 * profiles for any senator/representative who served 2010+ but isn't yet
 * in candidate_profiles. Lets the historical-trade sync match those names
 * (Stock Watcher data goes back to 2012; many of those filers are out of
 * office now and aren't in the current FEC sync).
 *
 * Idempotent — uses (display_name, fec_state, fec_office_type) as the
 * de-dup key plus bioguide / govtrack / FEC ID lookups, so re-runs from
 * the cron only insert genuinely new rows.
 *
 * Usage:
 *   node scripts/backfill-historical-senators.cjs
 *   node scripts/backfill-historical-senators.cjs --dry-run
 *   node scripts/backfill-historical-senators.cjs --since=2010
 *   node scripts/backfill-historical-senators.cjs --senators-only
 *
 * Required env vars:
 *   DATABASE_URL
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
const axios = require('axios');
const yaml = require('js-yaml');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CURRENT_URL    = 'https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml';
const HISTORICAL_URL = 'https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-historical.yaml';
const USER_AGENT     = 'WhosRunningUSA/1.0 (civic-data project)';

function parseArgs() {
  const args = { dryRun: false, since: 2010, senatorsOnly: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--since=')) args.since = parseInt(arg.split('=')[1], 10);
    else if (arg === '--senators-only') args.senatorsOnly = true;
  }
  return args;
}

async function fetchYaml(url) {
  const res = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 60_000,
    maxContentLength: 100 * 1024 * 1024,
    responseType: 'text',
  });
  return yaml.load(res.data);
}

function partyAbbrev(party) {
  if (!party) return null;
  const p = String(party).toLowerCase();
  if (p.startsWith('dem')) return 'DEM';
  if (p.startsWith('rep')) return 'REP';
  if (p.startsWith('ind')) return 'IND';
  if (p.startsWith('lib')) return 'LIB';
  if (p.startsWith('gre')) return 'GRN';
  return null;
}

function buildDisplayName(name) {
  if (!name) return null;
  if (name.official_full) return name.official_full;
  const first = name.first || '';
  const last = name.last || '';
  return `${first} ${last}`.trim() || null;
}

// Pick the most recent senator/rep term that overlaps the eligibility window.
// Returns { type, state, party, end } or null if no qualifying term.
function pickTerm(legislator, sinceYear, senatorsOnly) {
  const terms = legislator.terms || [];
  const cutoff = `${sinceYear}-01-01`;
  let best = null;
  for (const t of terms) {
    if (senatorsOnly && t.type !== 'sen') continue;
    if (t.type !== 'sen' && t.type !== 'rep') continue;
    const end = t.end || '';
    if (end < cutoff) continue;
    if (!best || (t.start || '') > (best.start || '')) {
      best = t;
    }
  }
  return best;
}

async function findExistingProfile(legislator, displayName, state, officeType) {
  const ids = legislator.id || {};
  const params = [];
  const conditions = [];

  if (ids.bioguide) {
    params.push(ids.bioguide);
    conditions.push(`congress_gov_id = $${params.length}`);
  }
  if (ids.govtrack) {
    params.push(String(ids.govtrack));
    conditions.push(`govtrack_id = $${params.length}`);
  }
  if (ids.fec && ids.fec.length > 0) {
    params.push(ids.fec[ids.fec.length - 1]);
    conditions.push(`fec_candidate_id = $${params.length}`);
  }
  if (ids.wikidata) {
    params.push(ids.wikidata);
    conditions.push(`wikidata_id = $${params.length}`);
  }
  // Final fallback: name + state + office type. Catches profiles that were
  // populated by FEC sync without a govtrack/bioguide cross-reference.
  if (displayName && state && officeType) {
    params.push(displayName, state, officeType);
    conditions.push(`(LOWER(display_name) = LOWER($${params.length - 2}) AND fec_state = $${params.length - 1} AND fec_office_type = $${params.length})`);
  }

  if (conditions.length === 0) return null;

  const q = `SELECT id FROM candidate_profiles WHERE ${conditions.join(' OR ')} LIMIT 1`;
  const { rows } = await pool.query(q, params);
  return rows[0]?.id || null;
}

async function insertShadowProfile(legislator, displayName, state, officeType, term) {
  const ids = legislator.id || {};
  const bio = legislator.bio || {};
  const party = partyAbbrev(term.party);
  const fecId = (ids.fec && ids.fec.length > 0) ? ids.fec[ids.fec.length - 1] : null;

  const officialTitle =
    officeType === 'S' ? `Former U.S. Senator (${state})`
                       : `Former U.S. Representative (${state}-${term.district || '?'})`;

  const result = await pool.query(
    `INSERT INTO candidate_profiles
       (display_name, official_title, party_affiliation,
        fec_office_type, fec_state, fec_district, fec_candidate_id,
        congress_gov_id, govtrack_id, wikidata_id,
        is_shadow_profile, is_active, candidate_verified, candidate_verified_at,
        verification_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, TRUE, TRUE, NOW(), 'congress-legislators')
     RETURNING id`,
    [
      displayName,
      officialTitle,
      party,
      officeType,
      state,
      officeType === 'H' ? (term.district != null ? String(term.district).padStart(2, '0') : null) : null,
      fecId,
      ids.bioguide || null,
      ids.govtrack ? String(ids.govtrack) : null,
      ids.wikidata || null,
    ]
  );
  return result.rows[0].id;
}

async function main() {
  const args = parseArgs();

  console.log('=== Historical Senators/Reps Backfill ===');
  console.log(`Dry run: ${args.dryRun}`);
  console.log(`Since year: ${args.since}`);
  console.log(`Senators only: ${args.senatorsOnly}`);
  console.log('');

  console.log('Fetching legislators-current.yaml...');
  const current = await fetchYaml(CURRENT_URL);
  console.log(`  ${current.length} current legislators`);

  console.log('Fetching legislators-historical.yaml...');
  const historical = await fetchYaml(HISTORICAL_URL);
  console.log(`  ${historical.length} historical legislators`);

  const all = [...current, ...historical];
  console.log(`\nProcessing ${all.length} total legislators...`);

  let inserted = 0;
  let alreadyPresent = 0;
  let skippedNoTerm = 0;
  let errors = 0;

  for (const legislator of all) {
    const term = pickTerm(legislator, args.since, args.senatorsOnly);
    if (!term) { skippedNoTerm++; continue; }

    const displayName = buildDisplayName(legislator.name);
    if (!displayName) { skippedNoTerm++; continue; }

    const officeType = term.type === 'sen' ? 'S' : 'H';
    const state = term.state;

    try {
      const existingId = await findExistingProfile(legislator, displayName, state, officeType);
      if (existingId) {
        alreadyPresent++;
        continue;
      }

      if (args.dryRun) {
        console.log(`  [dry-run] would insert: ${displayName} (${officeType}-${state}, ${partyAbbrev(term.party) || 'IND'}, term ended ${term.end})`);
        inserted++;
        continue;
      }

      await insertShadowProfile(legislator, displayName, state, officeType, term);
      inserted++;
      if (inserted % 50 === 0) {
        console.log(`  ...inserted ${inserted} so far`);
      }
    } catch (err) {
      errors++;
      console.error(`  Failed for ${displayName}: ${err.message}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Inserted shadow profiles:     ${inserted}`);
  console.log(`Already in candidate_profiles: ${alreadyPresent}`);
  console.log(`Skipped (no qualifying term):  ${skippedNoTerm}`);
  console.log(`Errors:                        ${errors}`);
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
