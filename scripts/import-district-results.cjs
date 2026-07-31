#!/usr/bin/env node

/**
 * Import District Election Results (REAL data)
 *
 * Downloads district-level U.S. House general-election returns from the
 * MIT Election Data + Science Lab dataset on Harvard Dataverse and imports
 * them into the district_election_results table, which feeds
 * scripts/compute-gerrymandering.cjs.
 *
 * Source dataset (citable):
 *   MIT Election Data and Science Lab, 2017, "U.S. House 1976-2024",
 *   https://doi.org/10.7910/DVN/IG0UN2, Harvard Dataverse.
 *   (Dataset title/version updates over time; the script resolves the
 *   latest "<start>-<end>-house" file in the latest published version.)
 *
 * Download mechanics: the dataset file sits behind a Dataverse guestbook,
 * so a plain GET on the access API returns 400. The documented flow is to
 * POST a guestbookResponse JSON to the same access endpoint, which returns
 * a short-lived signed URL that serves the file. This records a guestbook
 * entry with the MIT Election Lab (that is the point of the guestbook —
 * they want to know who uses the data). Override the identity we send via:
 *   DATAVERSE_GUESTBOOK_NAME / DATAVERSE_GUESTBOOK_EMAIL /
 *   DATAVERSE_GUESTBOOK_INSTITUTION / DATAVERSE_GUESTBOOK_POSITION
 *
 * Aggregation notes:
 *   - The CSV has one row per candidate per party line per district.
 *     Fusion states (NY, CT, SC...) list the same candidate on multiple
 *     party lines, so rows are grouped BY CANDIDATE within a district and
 *     their lines summed; the candidate counts as DEM/REP if any of their
 *     party lines matches /DEMOCRAT/ / /REPUBLICAN/ (this also folds in
 *     DEMOCRATIC-FARMER-LABOR and DEMOCRATIC-NONPARTISAN LEAGUE).
 *   - special=TRUE rows (special elections) are excluded and reported.
 *   - If a district has runoff=TRUE rows, only the runoff rows are used
 *     (the runoff decides the seat); this is reported per district.
 *   - Top-two states (CA/WA/LA) can produce same-party generals; the
 *     winner is the top individual candidate, not the party bucket.
 *   - Ballot-status pseudo-rows (BLANK, VOID, UNDERVOTES, OVERVOTES,
 *     EXHAUSTED BALLOT[S]) are excluded — they are not votes for anyone.
 *     Verified against the file: MIT's own totalvotes column excludes them
 *     in 2024 (NY/ME reconcile exactly once they are dropped), and Maine's
 *     RCV "EXHAUSTED BALLOT" row would otherwise be ranked as a candidate.
 *     Generic write-in buckets (WRITEIN, SCATTERING, ALL OTHERS...) are
 *     real votes and stay in other_votes.
 *   - Maine RCV limitation: the dataset carries first-choice tallies, so
 *     winner_party reflects the first-round leader (matches the actual
 *     RCV outcome in 2020-2024).
 *
 * Usage:
 *   node scripts/import-district-results.cjs                 # 2020+2022+2024
 *   node scripts/import-district-results.cjs --dry-run       # no DB writes
 *   node scripts/import-district-results.cjs --years=2022,2024
 *   node scripts/import-district-results.cjs --csv=path/to/1976-2024-house.csv
 *
 * If the automatic download ever breaks (Dataverse API change, guestbook
 * policy change), download the CSV manually from
 * https://doi.org/10.7910/DVN/IG0UN2 ("Original File Format (CSV)") and
 * pass it with --csv=.
 *
 * Required env vars (non-dry-run): DATABASE_URL
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch (_) {}

const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');

const DATAVERSE_BASE = 'https://dataverse.harvard.edu';
const DATASET_PERSISTENT_ID = 'doi:10.7910/DVN/IG0UN2';
// Stored in district_election_results.source_url — the citable DOI.
const SOURCE_URL = 'https://doi.org/10.7910/DVN/IG0UN2';
const DEFAULT_YEARS = [2020, 2022, 2024];

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = { dryRun: false, csv: null, years: DEFAULT_YEARS };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--csv=')) args.csv = arg.slice('--csv='.length);
    else if (arg.startsWith('--years=')) {
      args.years = arg.slice('--years='.length).split(',')
        .map((y) => parseInt(y.trim(), 10))
        .filter((y) => Number.isInteger(y));
      if (args.years.length === 0) {
        console.error('No valid years in --years=. Example: --years=2020,2022,2024');
        process.exit(1);
      }
    } else {
      console.error(`Unknown argument: ${arg}`);
      console.error('Supported: --dry-run --csv=path --years=2020,2022,2024');
      process.exit(1);
    }
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Download from Harvard Dataverse (guestbook flow)
// ---------------------------------------------------------------------------

async function httpWithRetry(label, fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.response && err.response.status;
      const body = err.response && err.response.data;
      if (attempt < 2) {
        const backoff = 5000 * (attempt + 1);
        console.warn(`  ${label} failed (${status || err.message}) — retrying in ${backoff / 1000}s`);
        await sleep(backoff);
        continue;
      }
      if (body) console.error(`  ${label} response body: ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
      throw new Error(`${label} failed after ${attempt + 1} attempts: ${err.message}`);
    }
  }
}

/**
 * Resolve the "<start>-<end>-house" data file id from the latest published
 * dataset version, so the script keeps working when MEDSL publishes a new
 * version (e.g. 1976-2026-house) under the same DOI.
 */
async function resolveHouseFile() {
  const url = `${DATAVERSE_BASE}/api/datasets/:persistentId?persistentId=${DATASET_PERSISTENT_ID}`;
  const resp = await httpWithRetry('dataset metadata fetch', () => axios.get(url, { timeout: 60000 }));
  const version = resp.data && resp.data.data && resp.data.data.latestVersion;
  if (!version || !Array.isArray(version.files)) {
    throw new Error('Unexpected Dataverse metadata shape — no latestVersion.files');
  }
  const entry = version.files.find((f) => /^\d{4}-\d{4}-house\.(tab|csv)$/i.test(f.label || ''));
  if (!entry || !entry.dataFile || !entry.dataFile.id) {
    const labels = version.files.map((f) => f.label).join(', ');
    throw new Error(`Could not find a house returns file in dataset. Files present: ${labels}`);
  }
  console.log(`Dataset version ${version.versionNumber}.${version.versionMinorNumber} — file "${entry.label}" (id ${entry.dataFile.id})`);
  return { fileId: entry.dataFile.id, label: entry.label };
}

/**
 * The file is behind a required guestbook: a plain GET returns
 * "You may not download this file without the required Guestbook response".
 * POSTing a guestbookResponse JSON to the access endpoint returns a signed
 * URL (verified against guestbook id 458: name/email/institution/position
 * required, no custom questions).
 */
async function requestSignedUrl(fileId) {
  const guestbookResponse = {
    name: process.env.DATAVERSE_GUESTBOOK_NAME || 'WhosRunningUSA data importer',
    email: process.env.DATAVERSE_GUESTBOOK_EMAIL || 'contact@whosrunningusa.org',
    institution: process.env.DATAVERSE_GUESTBOOK_INSTITUTION || 'WhosRunningUSA',
    position: process.env.DATAVERSE_GUESTBOOK_POSITION || 'Automated civic data import'
  };
  console.log(`Recording Dataverse guestbook entry as "${guestbookResponse.name}" <${guestbookResponse.email}> (override via DATAVERSE_GUESTBOOK_* env vars)`);

  // format=original returns the originally uploaded CSV instead of the
  // Dataverse-ingested .tab derivative.
  const url = `${DATAVERSE_BASE}/api/access/datafile/${fileId}?format=original`;
  const resp = await httpWithRetry('guestbook signed-URL request', () =>
    axios.post(url, { guestbookResponse }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    })
  );
  const signedUrl = resp.data && resp.data.data && resp.data.data.signedUrl;
  if (!signedUrl) {
    throw new Error(`No signedUrl in guestbook response: ${JSON.stringify(resp.data).slice(0, 500)}`);
  }
  return signedUrl;
}

async function downloadCsv() {
  const { fileId, label } = await resolveHouseFile();
  await sleep(1000); // polite pacing between Dataverse calls
  const signedUrl = await requestSignedUrl(fileId);
  await sleep(1000);

  const destPath = path.join(os.tmpdir(), `whosrunningusa-${label.replace(/\.tab$/i, '.csv')}`);
  console.log(`Downloading to ${destPath} ...`);

  const resp = await httpWithRetry('file download', () =>
    axios.get(signedUrl, { responseType: 'stream', timeout: 300000 })
  );
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    resp.data.pipe(out);
    resp.data.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
  });

  const size = fs.statSync(destPath).size;
  if (size < 1000000) {
    throw new Error(`Downloaded file is suspiciously small (${size} bytes) — expected ~4 MB. Inspect ${destPath}.`);
  }
  console.log(`Downloaded ${(size / 1024 / 1024).toFixed(1)} MB. (File kept for reuse via --csv=${destPath})`);
  return destPath;
}

// ---------------------------------------------------------------------------
// CSV parsing (no external CSV dependency in backend/package.json)
// ---------------------------------------------------------------------------

/**
 * RFC-4180-style parser: quoted fields, doubled quotes, embedded
 * commas/newlines, CRLF. Sniffs tab-delimiting in case someone passes the
 * Dataverse .tab derivative via --csv.
 */
function parseDelimited(text) {
  const firstLine = text.slice(0, text.indexOf('\n'));
  const delim = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';

  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

/** The source CSV escapes embedded quotes as \" inside quoted fields. */
function cleanName(name) {
  return name.replace(/\\"/g, '"').trim();
}

// ---------------------------------------------------------------------------
// Aggregation: candidate-level rows -> per-district DEM/REP/other totals
// ---------------------------------------------------------------------------

function classifyParty(party) {
  if (/DEMOCRAT/i.test(party)) return 'dem';
  if (/REPUBLICAN/i.test(party)) return 'rep';
  return 'other';
}

/**
 * Ballot-status pseudo-rows that are not votes for any candidate.
 * (Exact label variants enumerated from the 2020-2024 rows of the file.)
 */
const BALLOT_STATUS_RE = /^(BLANKS?|BLANK VOTES|VOID|UNDER ?VOTES?|OVER ?VOTES?|EXHAUSTED BALLOTS?)$/i;

function aggregate(rawRows, header, years, warnings) {
  const col = {};
  header.forEach((h, i) => { col[h.replace(/^\uFEFF/, '').trim()] = i; });
  for (const required of ['year', 'state_po', 'state_fips', 'office', 'district', 'stage', 'runoff', 'special', 'candidate', 'party', 'candidatevotes', 'totalvotes', 'mode']) {
    if (!(required in col)) {
      throw new Error(`CSV is missing expected column "${required}". Header: ${header.join(', ')}`);
    }
  }

  const yearSet = new Set(years);
  const counts = { total: 0, wrongOffice: 0, wrongStage: 0, wrongYear: 0, special: 0, badVotes: 0, ballotStatusRows: 0, ballotStatusVotes: 0 };

  // Group candidate rows by district
  const districts = new Map(); // key -> { meta, rows }
  for (const r of rawRows) {
    counts.total++;
    const year = parseInt(r[col.year], 10);
    if (!yearSet.has(year)) { counts.wrongYear++; continue; }
    if (r[col.office] !== 'US HOUSE') { counts.wrongOffice++; continue; }
    if (r[col.stage] !== 'GEN') { counts.wrongStage++; continue; }
    if (r[col.special] === 'TRUE') {
      counts.special++;
      warnings.push(`Excluded special-election row: ${year} ${r[col.state_po]}-${r[col.district]} ${cleanName(r[col.candidate])}`);
      continue;
    }

    const stateFips = String(parseInt(r[col.state_fips], 10)).padStart(2, '0');
    const districtNumber = String(parseInt(r[col.district], 10)); // "0" = at-large
    const key = `${stateFips}|${districtNumber}|${year}`;
    if (!districts.has(key)) {
      districts.set(key, {
        stateFips,
        stateAbbr: r[col.state_po],
        districtNumber,
        year,
        rows: []
      });
    }
    districts.get(key).rows.push(r);
  }

  const results = [];
  for (const d of districts.values()) {
    let rows = d.rows;
    const label = `${d.year} ${d.stateAbbr}-${d.districtNumber}`;

    // If a runoff decided this seat, only the runoff rows count.
    if (rows.some((r) => r[col.runoff] === 'TRUE')) {
      rows = rows.filter((r) => r[col.runoff] === 'TRUE');
      warnings.push(`${label}: runoff rows present — using only the runoff result (${rows.length} rows)`);
    }
    // The house file uses mode=TOTAL throughout; guard against per-mode
    // breakouts that would double-count.
    const modes = new Set(rows.map((r) => r[col.mode]));
    if (modes.size > 1 && modes.has('TOTAL')) {
      rows = rows.filter((r) => r[col.mode] === 'TOTAL');
      warnings.push(`${label}: mixed vote modes ${[...modes].join('/')} — using TOTAL rows only`);
    }

    // Group party lines by candidate (fusion tickets: same candidate on
    // several party lines — sum them, classify by best party line).
    const candidates = new Map();
    let reportedTotal = 0;
    let districtBallotStatusVotes = 0;
    for (const r of rows) {
      const name = cleanName(r[col.candidate]) || '(unnamed)';
      const votesRaw = r[col.candidatevotes];
      const votes = parseInt(votesRaw, 10);
      if (BALLOT_STATUS_RE.test(name)) {
        counts.ballotStatusRows++;
        if (Number.isFinite(votes)) {
          counts.ballotStatusVotes += votes;
          districtBallotStatusVotes += votes;
        }
        const reportedBS = parseInt(r[col.totalvotes], 10);
        if (Number.isFinite(reportedBS)) reportedTotal = Math.max(reportedTotal, reportedBS);
        continue;
      }
      if (!Number.isFinite(votes)) {
        counts.badVotes++;
        warnings.push(`${label}: non-numeric candidatevotes "${votesRaw}" for ${name} — counted as 0`);
      }
      const reported = parseInt(r[col.totalvotes], 10);
      if (Number.isFinite(reported)) reportedTotal = Math.max(reportedTotal, reported);

      if (!candidates.has(name)) candidates.set(name, { name, votes: 0, dem: false, rep: false });
      const c = candidates.get(name);
      c.votes += Number.isFinite(votes) ? votes : 0;
      const cls = classifyParty(r[col.party] || '');
      if (cls === 'dem') c.dem = true;
      if (cls === 'rep') c.rep = true;
    }

    let demVotes = 0, repVotes = 0, otherVotes = 0;
    let topDem = null, topRep = null;
    const ranked = [...candidates.values()].sort((a, b) => b.votes - a.votes);
    for (const c of ranked) {
      if (c.dem) {
        demVotes += c.votes;
        if (!topDem) topDem = c;
      } else if (c.rep) {
        repVotes += c.votes;
        if (!topRep) topRep = c;
      } else {
        otherVotes += c.votes;
      }
    }
    const totalVotes = demVotes + repVotes + otherVotes;

    if (totalVotes === 0) {
      warnings.push(`${label}: DROPPED — zero total votes across ${rows.length} rows`);
      continue;
    }
    // Cross-check against MIT's reported totalvotes. Some years include
    // ballot-status rows (blank/void) in totalvotes and some exclude them,
    // so accept either reconciliation.
    const closeTo = (v) => Math.abs(v - reportedTotal) / reportedTotal <= 0.005;
    if (reportedTotal > 0 && !closeTo(totalVotes) && !closeTo(totalVotes + districtBallotStatusVotes)) {
      warnings.push(`${label}: summed votes ${totalVotes} (+${districtBallotStatusVotes} blank/void) differ from reported totalvotes ${reportedTotal} by >0.5%`);
    }

    // Winner = top individual candidate (handles CA/WA top-two same-party
    // generals correctly, unlike comparing party buckets).
    const winner = ranked[0];
    const runnerUp = ranked[1];
    const winnerParty = winner.dem ? 'Democratic' : winner.rep ? 'Republican' : 'Other';
    const margin = runnerUp
      ? ((winner.votes - runnerUp.votes) / totalVotes) * 100
      : 100;

    results.push({
      stateFips: d.stateFips,
      stateAbbr: d.stateAbbr,
      districtNumber: d.districtNumber,
      year: d.year,
      demVotes,
      repVotes,
      otherVotes,
      totalVotes,
      demCandidate: topDem ? topDem.name.slice(0, 200) : null,
      repCandidate: topRep ? topRep.name.slice(0, 200) : null,
      winnerParty,
      winnerMargin: parseFloat(margin.toFixed(2))
    });
  }

  return { results, counts };
}

// ---------------------------------------------------------------------------
// DB write: wipe-and-replace per election year, in one transaction
// ---------------------------------------------------------------------------

async function writeResults(results, years) {
  const { Pool } = require('pg');
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set (backend/.env). Use --dry-run to test without a database.');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const del = await client.query(
      'DELETE FROM district_election_results WHERE election_year = ANY($1::int[])',
      [years]
    );
    console.log(`Deleted ${del.rowCount} existing row(s) for year(s) ${years.join(', ')}.`);

    let inserted = 0;
    for (const r of results) {
      await client.query(
        `INSERT INTO district_election_results
           (state_fips, state_abbr, district_number, election_year,
            dem_votes, rep_votes, other_votes, total_votes,
            dem_candidate, rep_candidate, winner_party, winner_margin, source_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (state_fips, district_number, election_year) DO UPDATE SET
           state_abbr = EXCLUDED.state_abbr,
           dem_votes = EXCLUDED.dem_votes,
           rep_votes = EXCLUDED.rep_votes,
           other_votes = EXCLUDED.other_votes,
           total_votes = EXCLUDED.total_votes,
           dem_candidate = EXCLUDED.dem_candidate,
           rep_candidate = EXCLUDED.rep_candidate,
           winner_party = EXCLUDED.winner_party,
           winner_margin = EXCLUDED.winner_margin,
           source_url = EXCLUDED.source_url`,
        [
          r.stateFips, r.stateAbbr, r.districtNumber, r.year,
          r.demVotes, r.repVotes, r.otherVotes, r.totalVotes,
          r.demCandidate, r.repCandidate, r.winnerParty, r.winnerMargin,
          SOURCE_URL
        ]
      );
      inserted++;
    }

    await client.query('COMMIT');
    console.log(`Inserted ${inserted} district result row(s).`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  console.log('=== Import District Election Results (MIT Election Lab / Harvard Dataverse) ===');
  console.log(`Source: ${SOURCE_URL}`);
  console.log(`Years: ${args.years.join(', ')}${args.dryRun ? ' | DRY RUN (no DB writes)' : ''}\n`);

  let csvPath = args.csv;
  if (csvPath) {
    if (!fs.existsSync(csvPath)) {
      console.error(`--csv file not found: ${csvPath}`);
      process.exit(1);
    }
    console.log(`Using local file: ${csvPath}`);
  } else {
    csvPath = await downloadCsv();
  }

  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseDelimited(text);
  if (rows.length < 2) throw new Error(`Parsed only ${rows.length} row(s) from ${csvPath} — not a valid returns file.`);
  const header = rows[0];
  console.log(`Parsed ${rows.length - 1} data rows.\n`);

  const warnings = [];
  const { results, counts } = aggregate(rows.slice(1), header, args.years, warnings);

  // Per-year sanity report
  const byYear = new Map();
  for (const r of results) {
    if (!byYear.has(r.year)) byYear.set(r.year, { districts: 0, dem: 0, rep: 0 });
    const y = byYear.get(r.year);
    y.districts++;
    if (r.winnerParty === 'Democratic') y.dem++;
    if (r.winnerParty === 'Republican') y.rep++;
  }
  for (const year of args.years) {
    const y = byYear.get(year);
    if (!y) {
      console.warn(`WARNING: no districts found for ${year} — the dataset may not cover that year yet.`);
      continue;
    }
    console.log(`${year}: ${y.districts} districts | winners: ${y.dem} D / ${y.rep} R / ${y.districts - y.dem - y.rep} other`);
    if (y.districts < 400) {
      console.warn(`WARNING: ${year} has only ${y.districts} districts (expected ~435) — inspect the source file.`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n--- ${warnings.length} warning(s) / exclusion(s) ---`);
    for (const w of warnings) console.log(`  ${w}`);
  }

  console.log('\n--- Row accounting ---');
  console.log(`CSV rows read: ${counts.total}`);
  console.log(`Outside target years: ${counts.wrongYear} | non-House: ${counts.wrongOffice} | non-general: ${counts.wrongStage}`);
  console.log(`Special-election rows excluded: ${counts.special} | non-numeric vote values: ${counts.badVotes}`);
  console.log(`Ballot-status rows excluded (blank/void/under/over/exhausted): ${counts.ballotStatusRows} rows, ${counts.ballotStatusVotes} ballots`);
  console.log(`District results built: ${results.length}`);

  if (args.dryRun) {
    console.log('\nDry run — sample of first 5 results:');
    for (const r of results.slice(0, 5)) {
      console.log(`  ${r.year} ${r.stateAbbr}-${r.districtNumber} (fips ${r.stateFips}): D ${r.demVotes} / R ${r.repVotes} / O ${r.otherVotes} -> ${r.winnerParty} by ${r.winnerMargin}%`);
    }
    console.log('\nDry run complete. No database changes made.');
    return;
  }

  if (results.length === 0) {
    console.error('\nNo results to import — refusing to wipe existing data. Exiting with error.');
    process.exit(1);
  }

  console.log('');
  await writeResults(results, args.years);
  console.log('\nDone. Next step: npm run compute:gerrymandering (in backend/).');
}

main().catch((err) => {
  console.error(`\nFatal error: ${err.message}`);
  process.exit(1);
});
