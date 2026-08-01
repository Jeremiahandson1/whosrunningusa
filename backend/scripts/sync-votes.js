#!/usr/bin/env node

/**
 * Congressional Votes Sync
 *
 * Pulls roll call votes from the official House Clerk XML and Senate LIS XML
 * endpoints, upserts vote_events + voting_records.
 *
 * Sources (no API key required):
 *   House: https://clerk.house.gov/evs/{year}/roll{NNN}.xml
 *   Senate menu: https://www.senate.gov/legislative/LIS/roll_call_votes/vote{CCCS}/vote_menu_{CCC}_{S}.xml
 *                (falls back to /legislative/LIS/roll_call_lists/vote_menu_{CCC}_{S}.xml)
 *   Senate detail: https://www.senate.gov/legislative/LIS/roll_call_votes/vote{CCCS}/vote_{CCC}_{S}_{NNNNN}.xml
 *   lis -> bioguide: https://unitedstates.github.io/congress-legislators/legislators-current.json
 *
 * Member lookup: bioguide id (House "name-id" attr; Senate "lis_member_id"
 * mapped to bioguide via the unitedstates/congress-legislators dataset)
 * against candidate_profiles.congress_gov_id.
 *
 * Usage:
 *   node scripts/sync-votes.js                # current session, both chambers
 *   node scripts/sync-votes.js --chamber=house|senate|both
 *   node scripts/sync-votes.js --max=50       # cap per-chamber iteration
 *   node scripts/sync-votes.js --years=2023,2024   # backfill specific years
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

const CURRENT_CONGRESS = 119;
const CURRENT_SESSION = 1;
const CURRENT_YEAR = 2025;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchText(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null; // timeout or network error — caller treats as "no data"
  } finally {
    clearTimeout(t);
  }
}

// -- House Clerk XML ---------------------------------------------------------

function parseHouseVote(xml, url, year, roll) {
  // Metadata
  const get = (tag) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].trim() : null;
  };
  const voteDate = (get('action-date') || '').trim(); // e.g. "3-Jan-2025"
  const question = get('vote-question');
  const result = get('vote-result');
  // The bill identifier ("H R 22") lives in <legis-num>, not the question —
  // append it so downstream bill linking and the AI analysis have the
  // reference ("On Passage" alone identifies nothing).
  const legisNum = get('legis-num');
  const motion = legisNum && !/^\s*$/.test(legisNum) && question
    ? `${question} — ${legisNum}`
    : (question || legisNum);

  // Counts — MUST come from the <totals-by-vote> chamber-totals block. The
  // document lists <totals-by-party> (Republican first) before it, so a bare
  // first-match regex returns one party's tally, not the floor total — that
  // bug stored "212-0" for votes that were really 232-188.
  const totalsBlock = xml.match(/<totals-by-vote>[\s\S]*?<\/totals-by-vote>/)?.[0] || '';
  const countOf = (tag) =>
    parseInt(totalsBlock.match(new RegExp(`<${tag}>\\s*(\\d+)\\s*</${tag}>`))?.[1] || '0', 10);
  const yesCount = countOf('yea-total');
  const noCount = countOf('nay-total');
  const presentCount = countOf('present-total');
  const notVotingCount = countOf('not-voting-total');

  // Per-member votes
  const members = [];
  const re = /<recorded-vote>\s*<legislator\s+name-id="([A-Z][0-9]+)"[^>]*\/?>([^<]*)<\/legislator>?\s*<vote>([^<]+)<\/vote>\s*<\/recorded-vote>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    members.push({ bioguide: m[1], vote: m[3].trim() });
  }

  // Fall back: self-closing legislator tag
  if (members.length === 0) {
    const re2 = /<recorded-vote>\s*<legislator[^>]*name-id="([A-Z][0-9]+)"[^>]*\/>\s*<vote>([^<]+)<\/vote>\s*<\/recorded-vote>/g;
    while ((m = re2.exec(xml)) !== null) {
      members.push({ bioguide: m[1], vote: m[2].trim() });
    }
  }

  // Normalize date "3-Jan-2025" -> "2025-01-03"
  const monthMap = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
  let isoDate = null;
  const dm = voteDate.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dm) isoDate = `${dm[3]}-${monthMap[dm[2]] || '01'}-${String(dm[1]).padStart(2, '0')}`;

  return {
    externalId: `house-${year}-${roll}`,
    chamber: 'House',
    voteDate: isoDate,
    motion,
    result,
    yesCount, noCount, abstainCount: presentCount, absentCount: notVotingCount,
    source: 'house-clerk',
    sourceUrl: url,
    members,
  };
}

// Map House clerk / Senate LIS vote text to our standard values
function normalizeVote(v) {
  const s = (v || '').toLowerCase();
  if (s === 'aye' || s === 'yea' || s === 'yes') return 'yes';
  if (s === 'no' || s === 'nay') return 'no';
  if (s.startsWith('present')) return 'present'; // incl. "Present, Giving Live Pair"
  if (s === 'not voting') return 'not_voting';
  return s;
}

async function upsertVoteEvent(v) {
  const result = await db.query(
    `INSERT INTO vote_events
       (external_id, motion_text, chamber, vote_date, result,
        yes_count, no_count, abstain_count, absent_count, source, source_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (source, external_id) DO UPDATE SET
       motion_text = EXCLUDED.motion_text,
       result = EXCLUDED.result,
       yes_count = EXCLUDED.yes_count,
       no_count = EXCLUDED.no_count,
       abstain_count = EXCLUDED.abstain_count,
       absent_count = EXCLUDED.absent_count
     RETURNING id`,
    [v.externalId, v.motion, v.chamber, v.voteDate, v.result,
     v.yesCount, v.noCount, v.abstainCount, v.absentCount, v.source, v.sourceUrl]
  );
  return result.rows[0].id;
}

async function upsertVotingRecords(voteEventId, members, source) {
  if (!members.length) return { wrote: 0, unmatched: 0 };
  // Batch fetch candidate ids for all bioguides at once
  const bioguides = [...new Set(members.map(m => m.bioguide))];
  const candLookup = await db.query(
    `SELECT id, congress_gov_id, verification_external_id
       FROM candidate_profiles
      WHERE congress_gov_id = ANY($1::text[])
         OR (verification_source = 'congress_gov' AND verification_external_id = ANY($1::text[]))`,
    [bioguides]
  );
  const byBioguide = new Map();
  for (const row of candLookup.rows) {
    const key = row.congress_gov_id || row.verification_external_id;
    if (key) byBioguide.set(key, row.id);
  }

  let wrote = 0;
  let unmatched = 0;
  for (const m of members) {
    const candidateId = byBioguide.get(m.bioguide);
    if (!candidateId) { unmatched++; continue; }
    await db.query(
      `INSERT INTO voting_records (candidate_id, vote_event_id, vote, source, external_voter_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (candidate_id, vote_event_id) DO UPDATE SET
         vote = EXCLUDED.vote`,
      [candidateId, voteEventId, normalizeVote(m.vote), source, m.bioguide]
    );
    wrote++;
  }
  return { wrote, unmatched };
}

async function syncHouse(year, maxRolls) {
  console.log(`\n--- House ${year} ---`);
  let totalVotes = 0;
  let totalRecords = 0;
  let totalUnmatched = 0;
  let misses = 0;
  for (let roll = 1; roll <= maxRolls; roll++) {
    const url = `https://clerk.house.gov/evs/${year}/roll${String(roll).padStart(3, '0')}.xml`;
    const xml = await fetchText(url);
    if (!xml || xml.length < 1000) {
      misses++;
      // Three consecutive misses means we've run past the last known roll
      if (misses >= 3) break;
      continue;
    }
    misses = 0;
    try {
      const v = parseHouseVote(xml, url, year, roll);
      if (!v.voteDate) continue;
      const voteEventId = await upsertVoteEvent(v);
      const stats = await upsertVotingRecords(voteEventId, v.members, 'house-clerk');
      totalVotes++;
      totalRecords += stats.wrote;
      totalUnmatched += stats.unmatched;
      if (roll % 25 === 0) console.log(`  roll ${roll}: +${stats.wrote} records (${stats.unmatched} unmatched)`);
    } catch (err) {
      console.warn(`  roll ${roll}: ${err.message}`);
    }
    // Gentle pacing — stay well clear of the Clerk's rate limits
    await sleep(250);
  }
  console.log(`House ${year}: ${totalVotes} votes, ${totalRecords} member records written, ${totalUnmatched} unmatched`);
  return { totalVotes, totalRecords };
}

// -- Senate LIS XML ----------------------------------------------------------

// Senate XML identifies members by lis_member_id (e.g. "S355"), not bioguide.
// The unitedstates/congress-legislators dataset carries both ids per member,
// so we load it once per run and translate lis -> bioguide before matching
// against candidate_profiles.
let lisMapCache = null;

async function loadLisToBioguideMap() {
  if (lisMapCache) return lisMapCache;
  const url = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';
  const text = await fetchText(url, 30000);
  if (!text) return null;
  try {
    const legislators = JSON.parse(text);
    const map = new Map();
    for (const leg of legislators) {
      if (leg.id && leg.id.lis && leg.id.bioguide) {
        map.set(leg.id.lis, leg.id.bioguide);
      }
    }
    if (map.size === 0) return null;
    lisMapCache = map;
    return map;
  } catch {
    return null;
  }
}

function senateVoteBaseUrl(congress, session) {
  return `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${session}`;
}

// Returns sorted vote numbers listed in the session's vote menu, or null if
// the menu can't be fetched (caller falls back to sequential probing).
async function fetchSenateVoteMenu(congress, session) {
  const menuUrls = [
    `${senateVoteBaseUrl(congress, session)}/vote_menu_${congress}_${session}.xml`,
    `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${congress}_${session}.xml`,
  ];
  for (const url of menuUrls) {
    const xml = await fetchText(url);
    await sleep(250);
    if (xml && xml.includes('<vote_number>')) {
      const numbers = [];
      const re = /<vote_number>\s*(\d+)\s*<\/vote_number>/g;
      let m;
      while ((m = re.exec(xml)) !== null) numbers.push(parseInt(m[1], 10));
      return [...new Set(numbers)].sort((a, b) => a - b);
    }
  }
  return null;
}

function parseSenateVote(xml, url, congress, session, number) {
  // Exact tag match — '<vote_result[^>]*>' would also match
  // <vote_result_text>, which precedes <vote_result> in the LIS XML, making
  // the non-greedy capture swallow everything between the two tags.
  const get = (tag) => {
    const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].trim() : null;
  };
  const question = get('vote_question_text') || get('question');
  const result = get('vote_result');

  // Counts: top-level <yeas>/<nays>/<present>/<absent> in the header
  // portion (before <members>); some variants nest them in a <count> block —
  // the exact-tag search handles both.
  const header = xml.split('<members>')[0];
  const count = (tag) =>
    parseInt(header.match(new RegExp(`<${tag}>\\s*(\\d+)\\s*</${tag}>`))?.[1] || '0', 10);

  // Normalize date "January 6, 2025, 05:30 PM" -> "2025-01-06"
  const monthMap = {
    January:'01', February:'02', March:'03', April:'04', May:'05', June:'06',
    July:'07', August:'08', September:'09', October:'10', November:'11', December:'12',
  };
  let isoDate = null;
  const dm = (get('vote_date') || '').match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (dm && monthMap[dm[1]]) isoDate = `${dm[3]}-${monthMap[dm[1]]}-${String(dm[2]).padStart(2, '0')}`;

  // Per-member votes: <member> blocks with <lis_member_id> + <vote_cast>
  const members = [];
  const re = /<member>([\s\S]*?)<\/member>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const lis = m[1].match(/<lis_member_id>\s*([A-Z]\d+)\s*<\/lis_member_id>/)?.[1];
    const vote = m[1].match(/<vote_cast>\s*([^<]+?)\s*<\/vote_cast>/)?.[1];
    if (lis && vote) members.push({ lis, vote: vote.trim() });
  }

  return {
    externalId: `senate-${congress}-${session}-${number}`,
    chamber: 'Senate',
    voteDate: isoDate,
    motion: question,
    result,
    yesCount: count('yeas'), noCount: count('nays'),
    abstainCount: count('present'), absentCount: count('absent'),
    source: 'senate-lis',
    sourceUrl: url,
    members,
  };
}

async function syncSenate(congress, session, maxVotes) {
  console.log(`\n--- Senate congress ${congress}, session ${session} ---`);
  const lisMap = await loadLisToBioguideMap();
  if (!lisMap) {
    console.warn('  Skipping Senate: could not load lis -> bioguide mapping from unitedstates.github.io (network error or bad payload)');
    return { totalVotes: 0, totalRecords: 0 };
  }

  let numbers = await fetchSenateVoteMenu(congress, session);
  if (!numbers) {
    console.warn(`  No vote menu for ${congress}-${session}; probing vote numbers sequentially`);
    numbers = Array.from({ length: maxVotes }, (_, i) => i + 1);
  } else if (numbers.length === 0) {
    console.log(`  Vote menu empty for ${congress}-${session} (no roll calls yet)`);
    return { totalVotes: 0, totalRecords: 0 };
  }
  numbers = numbers.slice(0, maxVotes); // honor --max like the House path

  let totalVotes = 0;
  let totalRecords = 0;
  let totalUnmatched = 0;
  let totalUnknownLis = 0;
  let misses = 0;
  for (const number of numbers) {
    const url = `${senateVoteBaseUrl(congress, session)}/vote_${congress}_${session}_${String(number).padStart(5, '0')}.xml`;
    const xml = await fetchText(url);
    if (!xml || xml.length < 1000) {
      misses++;
      // Three consecutive misses means we've run past the last known vote
      if (misses >= 3) break;
      await sleep(250);
      continue;
    }
    misses = 0;
    try {
      const v = parseSenateVote(xml, url, congress, session, number);
      if (!v.voteDate) { await sleep(250); continue; }
      // Translate lis ids to bioguide so member matching mirrors the House path
      const mapped = [];
      for (const m of v.members) {
        const bioguide = lisMap.get(m.lis);
        if (!bioguide) { totalUnknownLis++; continue; }
        mapped.push({ bioguide, vote: m.vote });
      }
      const voteEventId = await upsertVoteEvent(v);
      const stats = await upsertVotingRecords(voteEventId, mapped, 'senate-lis');
      totalVotes++;
      totalRecords += stats.wrote;
      totalUnmatched += stats.unmatched;
      if (number % 25 === 0) console.log(`  vote ${number}: +${stats.wrote} records (${stats.unmatched} unmatched)`);
    } catch (err) {
      console.warn(`  vote ${number}: ${err.message}`);
    }
    // Gentle pacing — stay well clear of senate.gov rate limits
    await sleep(250);
  }
  const lisNote = totalUnknownLis > 0 ? `, ${totalUnknownLis} member entries without a lis mapping` : '';
  console.log(`Senate ${congress}-${session}: ${totalVotes} votes, ${totalRecords} member records written, ${totalUnmatched} unmatched${lisNote}`);
  return { totalVotes, totalRecords };
}

// congress number for a calendar year (119th = 2025-2026); session 1 = odd year
function congressForYear(year) {
  return Math.floor((year - 1789) / 2) + 1;
}

function sessionForYear(year) {
  return ((year - 1789) % 2) + 1;
}

async function main() {
  const args = process.argv.slice(2);
  const options = { chamber: 'both', max: 1000, years: null };
  for (const arg of args) {
    if (arg.startsWith('--chamber=')) options.chamber = arg.split('=')[1];
    if (arg.startsWith('--max=')) options.max = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--years=')) {
      options.years = arg.split('=')[1].split(',')
        .map(y => parseInt(y.trim(), 10))
        .filter(y => Number.isInteger(y) && y >= 1990 && y <= CURRENT_YEAR + 1);
    }
  }

  console.log('\n=== Votes Sync ===');
  console.log(`  Chamber: ${options.chamber}, max per year: ${options.max}${options.years ? `, years: ${options.years.join(',')}` : ''}`);
  const startedAt = Date.now();

  // Default: current congress (both sessions). --years=2023,2024 backfills.
  const years = (options.years && options.years.length)
    ? options.years
    : [CURRENT_YEAR, CURRENT_YEAR + 1];

  try {
    if (options.chamber === 'house' || options.chamber === 'both') {
      for (const year of years) {
        await syncHouse(year, options.max);
      }
    }
    if (options.chamber === 'senate' || options.chamber === 'both') {
      // Dedupe (congress, session) pairs in case years spans repeat
      const seen = new Set();
      for (const year of years) {
        const congress = congressForYear(year);
        const session = sessionForYear(year);
        const key = `${congress}-${session}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await syncSenate(congress, session, options.max);
      }
    }
  } catch (err) {
    console.error('Votes sync error:', err.message);
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`\nDuration: ${(elapsedMs / 1000).toFixed(1)}s`);
  await db.pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('sync-votes failed:', err.message);
  try { await db.pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
