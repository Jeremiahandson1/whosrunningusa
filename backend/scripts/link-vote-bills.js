#!/usr/bin/env node

/**
 * Link vote_events (and voting_records) to bills by parsing the bill
 * reference out of motion_text.
 *
 * The vote sync has never populated bill_id: House Clerk questions carry the
 * bill in <legis-num> (now appended to motion_text as "On Passage — H R 22")
 * and Senate LIS questions embed it ("On Cloture on the Motion to Proceed
 * H.R. 7147"). Without the link, the AI donor-vote/gap analysis has no bill
 * subject matter to reason over, and profile vote lists can't show titles.
 *
 * Matching: normalized reference ("H.R. 7147" -> "HR 7147") against
 * bills.bill_number, preferring the bill most recently introduced on or
 * before the vote date (bill numbers recycle each congress).
 *
 * Usage:
 *   node scripts/link-vote-bills.js [--dry-run]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

// Longest-prefix-first so "H.J. Res. 12" doesn't half-match as "H.R." etc.
const REF_RE = /\b(H\.?\s?J\.?\s?RES|S\.?\s?J\.?\s?RES|H\.?\s?CON\.?\s?RES|S\.?\s?CON\.?\s?RES|H\.?\s?RES|S\.?\s?RES|H\.?\s?R|S)\.?\s+(\d{1,5})\b/i;

function normalizeRef(kind, num) {
  const k = kind.toUpperCase().replace(/[.\s]/g, '');
  const map = { HJRES: 'HJRES', SJRES: 'SJRES', HCONRES: 'HCONRES', SCONRES: 'SCONRES', HRES: 'HRES', SRES: 'SRES', HR: 'HR', S: 'S' };
  return map[k] ? `${map[k]} ${parseInt(num, 10)}` : null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`\n=== Link Vote Events to Bills ${dryRun ? '(dry run)' : ''} ===`);

  const events = await db.query(
    `SELECT id, motion_text, vote_date FROM vote_events
      WHERE bill_id IS NULL AND motion_text ~* '\\m(H|S)\\.?\\s?(J|CON)?\\.?\\s?(R|RES)'`
  );
  console.log(`  Unlinked vote events with a possible bill reference: ${events.rows.length}`);

  let linked = 0, noMatch = 0, noRef = 0;
  for (const ev of events.rows) {
    const m = ev.motion_text.match(REF_RE);
    if (!m) { noRef++; continue; }
    const ref = normalizeRef(m[1], m[2]);
    if (!ref) { noRef++; continue; }

    const bill = await db.query(
      `SELECT id FROM bills
        WHERE UPPER(REPLACE(REPLACE(bill_number, '.', ''), '  ', ' ')) = $1
          AND (introduced_date IS NULL OR introduced_date <= COALESCE($2::date, NOW()::date))
        ORDER BY introduced_date DESC NULLS LAST
        LIMIT 1`,
      [ref, ev.vote_date]
    );
    if (bill.rows.length === 0) { noMatch++; continue; }

    if (!dryRun) {
      await db.query(`UPDATE vote_events SET bill_id = $1 WHERE id = $2`, [bill.rows[0].id, ev.id]);
    }
    linked++;
  }

  // Propagate to voting_records so the profile vote list (which joins bills
  // via voting_records.bill_id) picks up titles.
  let recordsUpdated = 0;
  if (!dryRun) {
    const r = await db.query(
      `UPDATE voting_records vr SET bill_id = ve.bill_id
         FROM vote_events ve
        WHERE vr.vote_event_id = ve.id
          AND ve.bill_id IS NOT NULL
          AND vr.bill_id IS DISTINCT FROM ve.bill_id`
    );
    recordsUpdated = r.rowCount;
  }

  console.log(`  Linked: ${linked}  No bill match: ${noMatch}  No parseable ref: ${noRef}`);
  console.log(`  voting_records propagated: ${dryRun ? '(dry run)' : recordsUpdated}`);
  await db.pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('link-vote-bills failed:', err.message);
  try { await db.pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
