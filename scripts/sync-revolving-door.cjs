#!/usr/bin/env node

/**
 * Sync Post-Service Employment (Revolving Door) Data
 *
 * Fetches lobbying registration data from Senate LD-1/LD-2 filings and
 * OpenSecrets revolving door data. Cross-references with candidate_profiles
 * and flags cooling period violations.
 *
 * Usage:
 *   node scripts/sync-revolving-door.js
 *   node scripts/sync-revolving-door.js --dry-run
 *   node scripts/sync-revolving-door.js --politician-id <uuid>
 *
 * Required env vars:
 *   DATABASE_URL
 *
 * Optional env vars:
 *   OPENSECRETS_API_KEY — OpenSecrets API for revolving door data
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function parseArgs() {
  const args = { dryRun: false, politicianId: null };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--politician-id=')) args.politicianId = arg.split('=')[1];
  }
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Federal cooling period: 2 years for senior officials, 1 year for others
const COOLING_PERIOD_DAYS = 365 * 2;

// ---------------------------------------------------------------------------
// Industry classification
// ---------------------------------------------------------------------------

const INDUSTRY_PATTERNS = [
  { pattern: /pharma|biotech|drug|medical device/i, industry: 'Pharmaceuticals & Biotech' },
  { pattern: /oil|gas|energy|petroleum|fossil/i, industry: 'Oil & Gas' },
  { pattern: /bank|financ|invest|hedge fund|private equity/i, industry: 'Finance & Banking' },
  { pattern: /tech|software|google|meta|amazon|apple|microsoft/i, industry: 'Technology' },
  { pattern: /defense|military|weapons|lockheed|raytheon|northrop/i, industry: 'Defense & Aerospace' },
  { pattern: /insurance|health plan/i, industry: 'Insurance' },
  { pattern: /telecom|wireless|at&t|verizon|comcast/i, industry: 'Telecommunications' },
  { pattern: /real estate|construction|housing/i, industry: 'Real Estate' },
  { pattern: /agri|farm|food|monsanto/i, industry: 'Agriculture & Food' },
  { pattern: /lobby/i, industry: 'Lobbying' },
  { pattern: /consult/i, industry: 'Consulting' },
  { pattern: /law firm|legal/i, industry: 'Legal' },
];

function classifyIndustry(employer, position) {
  const text = `${employer || ''} ${position || ''}`.toLowerCase();
  for (const { pattern, industry } of INDUSTRY_PATTERNS) {
    if (pattern.test(text)) return industry;
  }
  return 'Other';
}

function isLobbyingPosition(employer, position) {
  const text = `${employer || ''} ${position || ''}`.toLowerCase();
  return /lobby|government (affairs|relations)|public policy|advocacy|k street/i.test(text);
}

// ---------------------------------------------------------------------------
// Fetch revolving door data
// ---------------------------------------------------------------------------

async function fetchRevolvingDoorData() {
  const records = [];

  // Source 1: OpenSecrets Revolving Door API
  if (process.env.OPENSECRETS_API_KEY) {
    console.log('Fetching from OpenSecrets revolving door data...');

    // Get all federal legislators we track
    const { rows: candidates } = await pool.query(
      `SELECT id, display_name, congress_gov_id, govtrack_id, fec_office_type, fec_state
       FROM candidate_profiles
       WHERE fec_office_type IN ('H', 'S')
       ORDER BY display_name`
    );

    console.log(`  Processing ${candidates.length} federal legislators...`);

    for (const candidate of candidates) {
      const cid = candidate.congress_gov_id || candidate.govtrack_id;
      if (!cid) continue;

      try {
        const res = await axios.get(
          `https://www.opensecrets.org/api/?method=memPFDprofile&cid=${cid}&year=2024&apikey=${process.env.OPENSECRETS_API_KEY}&output=json`,
          { timeout: 10000 }
        );

        const profile = res.data?.response?.member_profile;
        if (profile && profile['@attributes']) {
          const attrs = profile['@attributes'];
          // Extract asset/income data that might indicate outside employment
          if (profile.positions && Array.isArray(profile.positions.position)) {
            for (const pos of profile.positions.position) {
              const p = pos['@attributes'] || pos;
              records.push({
                politician_id: candidate.id,
                employer: p.organization_name || p.org_name || 'Unknown',
                position_title: p.position_title || p.title || null,
                industry: classifyIndustry(p.organization_name, p.position_title),
                start_date: p.start_date || null,
                end_date: p.end_date || null,
                is_lobbying: isLobbyingPosition(p.organization_name, p.position_title),
                is_board_position: /board|director|trustee|advisory/i.test(p.position_title || ''),
                source: 'opensecrets',
              });
            }
          }
        }

        await sleep(500);
      } catch (err) {
        if (err.response?.status !== 404) {
          console.warn(`    Error for ${candidate.display_name}: ${err.message}`);
        }
      }
    }
  }

  // Source 2: Senate Lobbying Disclosure Act filings (LD-1)
  console.log('Fetching from Senate LDA filing database...');
  try {
    const res = await axios.get(
      'https://lda.senate.gov/api/v1/filings/?filing_type=1&filing_year=2024&filing_year=2025',
      {
        timeout: 15000,
        headers: { 'User-Agent': 'WhosRunningUSA/1.0 civic-data-project' },
      }
    );

    if (res.data && Array.isArray(res.data.results)) {
      for (const filing of res.data.results.slice(0, 500)) {
        // Look for former government officials in lobbyist list
        if (filing.lobbyists && Array.isArray(filing.lobbyists)) {
          for (const lobbyist of filing.lobbyists) {
            if (lobbyist.covered_position) {
              records.push({
                politician_id: null, // will match by name
                filer_name: `${lobbyist.lobbyist_first_name || ''} ${lobbyist.lobbyist_last_name || ''}`.trim(),
                employer: filing.registrant_name || filing.client_name || 'Unknown',
                position_title: 'Lobbyist',
                former_position: lobbyist.covered_position,
                industry: classifyIndustry(filing.registrant_name || filing.client_name, ''),
                is_lobbying: true,
                is_board_position: false,
                source: 'senate_lda',
                source_url: filing.filing_url || null,
              });
            }
          }
        }
      }
    }
    console.log(`  Fetched ${records.filter(r => r.source === 'senate_lda').length} LDA records`);
  } catch (err) {
    console.warn(`  Senate LDA fetch failed (non-fatal): ${err.message}`);
  }

  return records;
}

// ---------------------------------------------------------------------------
// Match names to candidate_profiles
// ---------------------------------------------------------------------------

async function matchNameToCandidate(name) {
  if (!name) return null;
  const parts = name.split(',').map(s => s.trim());
  const normalized = parts.length >= 2 ? `${parts[1]} ${parts[0]}` : parts[0];

  const { rows } = await pool.query(
    `SELECT id, display_name, fec_office_type, fec_state
     FROM candidate_profiles
     WHERE display_name ILIKE $1 OR display_name ILIKE $2
     LIMIT 1`,
    [`%${normalized}%`, `%${name}%`]
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Flag detection
// ---------------------------------------------------------------------------

async function detectViolations(employment) {
  const flags = [];

  // 1. Cooling period violation
  if (employment.left_office_date && employment.start_date) {
    const leftOffice = new Date(employment.left_office_date);
    const startedJob = new Date(employment.start_date);
    const daysBetween = Math.round((startedJob - leftOffice) / 86400000);

    if (daysBetween < COOLING_PERIOD_DAYS && daysBetween >= 0) {
      flags.push({
        flag_type: 'cooling_period_violation',
        description: `Started new position ${daysBetween} days after leaving office. Federal cooling period is ${COOLING_PERIOD_DAYS / 365} years (${COOLING_PERIOD_DAYS} days).`,
        severity: daysBetween < 365 ? 9 : 7,
        violation_start: employment.left_office_date,
        violation_end: employment.start_date,
      });
    }
  }

  // 2. Lobbying restriction
  if (employment.is_lobbying) {
    flags.push({
      flag_type: 'lobbying_restriction',
      description: `Currently registered as lobbyist at ${employment.employer}. Former officials face lobbying restrictions under 18 U.S.C. 207.`,
      severity: 6,
      related_industry: employment.industry,
    });
  }

  // 3. Industry conflict — check if politician's committees overlap with employer industry
  if (employment.politician_id) {
    const { rows: committees } = await pool.query(
      `SELECT DISTINCT b.categories
       FROM voting_records vr
       JOIN vote_events ve ON vr.vote_event_id = ve.id
       JOIN bills b ON ve.bill_id = b.id
       WHERE vr.candidate_id = $1
       LIMIT 50`,
      [employment.politician_id]
    );

    const votedCategories = committees
      .flatMap(c => c.categories || [])
      .map(c => c.toLowerCase());

    const industryLower = (employment.industry || '').toLowerCase();
    const overlap = votedCategories.some(cat =>
      cat.includes(industryLower) || industryLower.includes(cat)
    );

    if (overlap) {
      flags.push({
        flag_type: 'industry_conflict',
        description: `${employment.employer} operates in ${employment.industry}, which overlaps with legislation this official voted on.`,
        severity: 7,
        related_industry: employment.industry,
      });
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  console.log('=== Revolving Door Sync ===');
  console.log(`Dry run: ${args.dryRun}`);
  if (args.politicianId) console.log(`Filtering to: ${args.politicianId}`);
  console.log('');

  const rawRecords = await fetchRevolvingDoorData();
  console.log(`\nTotal raw records: ${rawRecords.length}`);

  let inserted = 0;
  let flagsCreated = 0;
  let unmatched = 0;
  let skipped = 0;

  for (const record of rawRecords) {
    let politicianId = record.politician_id;

    // If no politician_id, try to match by name
    if (!politicianId && record.filer_name) {
      const candidate = await matchNameToCandidate(record.filer_name);
      if (candidate) politicianId = candidate.id;
    }

    if (!politicianId) {
      unmatched++;
      continue;
    }

    if (args.politicianId && politicianId !== args.politicianId) {
      skipped++;
      continue;
    }

    // Dedup check
    const { rows: existing } = await pool.query(
      `SELECT id FROM post_service_employment
       WHERE politician_id = $1 AND employer = $2
         AND (position_title = $3 OR (position_title IS NULL AND $3 IS NULL))
       LIMIT 1`,
      [politicianId, record.employer, record.position_title]
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Get left_office_date from candidate_profiles if available
    const { rows: [politician] } = await pool.query(
      `SELECT left_office_date FROM candidate_profiles WHERE id = $1`,
      [politicianId]
    );

    const employment = {
      ...record,
      politician_id: politicianId,
      left_office_date: politician?.left_office_date || null,
    };

    const flags = await detectViolations(employment);

    if (args.dryRun) {
      console.log(`  [dry-run] ${record.employer} — ${record.position_title || 'N/A'} (${flags.length} flags)`);
      inserted++;
      flagsCreated += flags.length;
      continue;
    }

    // Insert employment
    const { rows: [newEmp] } = await pool.query(
      `INSERT INTO post_service_employment
         (politician_id, employer, position_title, industry, start_date, end_date,
          left_office_date, is_lobbying, is_board_position, source_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        politicianId, record.employer, record.position_title, record.industry,
        record.start_date || null, record.end_date || null,
        employment.left_office_date, record.is_lobbying, record.is_board_position,
        record.source_url || null,
      ]
    );

    inserted++;

    // Insert flags
    for (const flag of flags) {
      await pool.query(
        `INSERT INTO revolving_door_flags
           (employment_id, flag_type, description, severity, violation_start, violation_end,
            related_committee, related_industry)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newEmp.id, flag.flag_type, flag.description, flag.severity,
          flag.violation_start || null, flag.violation_end || null,
          flag.related_committee || null, flag.related_industry || null,
        ]
      );
      flagsCreated++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Employments inserted: ${inserted}`);
  console.log(`Flags created: ${flagsCreated}`);
  console.log(`Unmatched names: ${unmatched}`);
  console.log(`Skipped (duplicates/filtered): ${skipped}`);
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
