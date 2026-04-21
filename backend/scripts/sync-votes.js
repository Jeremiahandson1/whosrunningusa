#!/usr/bin/env node

/**
 * Congressional Votes Sync
 *
 * Pulls roll call votes from the official House Clerk XML and Senate LIS XML
 * endpoints, upserts vote_events + voting_records.
 *
 * Sources (no API key required):
 *   House: https://clerk.house.gov/evs/{year}/roll{NNN}.xml
 *   Senate menu: https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_{congress}_{session}.xml
 *   Senate detail: https://www.senate.gov/legislative/LIS/roll_call_votes/vote{CCCS}/vote_{CCC}_{S}_{NNNNN}.xml
 *
 * Member lookup: bioguide id (House "name-id" attr, Senate "lis_member_id" via
 * a separate lookup in the member XML) against candidate_profiles.congress_gov_id.
 *
 * Usage:
 *   node scripts/sync-votes.js                # current session, both chambers
 *   node scripts/sync-votes.js --chamber=house
 *   node scripts/sync-votes.js --max=50       # cap per-chamber iteration
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

const CURRENT_CONGRESS = 119;
const CURRENT_SESSION = 1;
const CURRENT_YEAR = 2025;

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) return null;
  return res.text();
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

  // Counts
  const yesCount = parseInt(xml.match(/<yea-total>\s*(\d+)\s*<\/yea-total>/)?.[1] || '0', 10);
  const noCount = parseInt(xml.match(/<nay-total>\s*(\d+)\s*<\/nay-total>/)?.[1] || '0', 10);
  const presentCount = parseInt(xml.match(/<present-total>\s*(\d+)\s*<\/present-total>/)?.[1] || '0', 10);
  const notVotingCount = parseInt(xml.match(/<not-voting-total>\s*(\d+)\s*<\/not-voting-total>/)?.[1] || '0', 10);

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
    motion: question,
    result,
    yesCount, noCount, abstainCount: presentCount, absentCount: notVotingCount,
    sourceUrl: url,
    members,
  };
}

// Map House clerk vote text to our standard values
function normalizeVote(v) {
  const s = (v || '').toLowerCase();
  if (s === 'aye' || s === 'yea' || s === 'yes') return 'yes';
  if (s === 'no' || s === 'nay') return 'no';
  if (s === 'present') return 'present';
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
     v.yesCount, v.noCount, v.abstainCount, v.absentCount, 'house-clerk', v.sourceUrl]
  );
  return result.rows[0].id;
}

async function upsertVotingRecords(voteEventId, members) {
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
       VALUES ($1, $2, $3, 'house-clerk', $4)
       ON CONFLICT (candidate_id, vote_event_id) DO UPDATE SET
         vote = EXCLUDED.vote`,
      [candidateId, voteEventId, normalizeVote(m.vote), m.bioguide]
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
      const stats = await upsertVotingRecords(voteEventId, v.members);
      totalVotes++;
      totalRecords += stats.wrote;
      totalUnmatched += stats.unmatched;
      if (roll % 25 === 0) console.log(`  roll ${roll}: +${stats.wrote} records (${stats.unmatched} unmatched)`);
    } catch (err) {
      console.warn(`  roll ${roll}: ${err.message}`);
    }
    // Gentle pacing
    if (roll % 10 === 0) await new Promise(r => setTimeout(r, 250));
  }
  console.log(`House ${year}: ${totalVotes} votes, ${totalRecords} member records written, ${totalUnmatched} unmatched`);
  return { totalVotes, totalRecords };
}

async function main() {
  const args = process.argv.slice(2);
  const options = { chamber: 'both', max: 1000 };
  for (const arg of args) {
    if (arg.startsWith('--chamber=')) options.chamber = arg.split('=')[1];
    if (arg.startsWith('--max=')) options.max = parseInt(arg.split('=')[1], 10);
  }

  console.log('\n=== Votes Sync ===');
  console.log(`  Chamber: ${options.chamber}, max per year: ${options.max}`);
  const startedAt = Date.now();

  try {
    if (options.chamber === 'house' || options.chamber === 'both') {
      await syncHouse(CURRENT_YEAR, options.max);
      // Also try next year in case we're in the 2nd session
      await syncHouse(CURRENT_YEAR + 1, options.max);
    }
    // Senate sync deliberately deferred — their XML uses lis_member_id, not
    // bioguide, so we need a separate mapping step before member records
    // can be matched to candidate_profiles.
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
