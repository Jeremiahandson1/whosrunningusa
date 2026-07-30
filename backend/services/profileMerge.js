/**
 * Shared candidate-profile merge logic.
 *
 * Used by the admin merge endpoint (backend/routes/admin.js) and the nightly
 * dedup script (backend/scripts/dedup-candidate-profiles.js). Merging means:
 * fold each duplicate's profile columns into its keeper (COALESCE), re-point
 * every foreign key that references candidate_profiles, then delete the
 * duplicate rows.
 *
 * Everything is SET-BASED against a temp mapping table (remove_id → keep_id).
 * The first implementation walked pairs and rows individually; with 600
 * duplicate groups, 54 referencing columns, and an 18.5M-row
 * compliance_records table that meant tens of thousands of round-trips and
 * hours of wall clock. The bulk form is a few hundred statements total and
 * merges the whole batch in one transaction.
 *
 * Referencing columns are discovered from pg_catalog at call time — 60+
 * tables reference candidate_profiles and the set grows with every feature
 * migration, so a hardcoded list silently loses data (several CASCADE
 * deletes) the first time it goes stale.
 */

const COALESCE_COLUMNS = [
  'twitter_handle', 'facebook_handle', 'instagram_handle', 'youtube_handle',
  'campaign_website', 'campaign_email', 'campaign_phone', 'official_title',
  'open_states_id', 'congress_gov_id', 'vote_smart_candidate_id',
  'profile_photo_url', 'fec_candidate_id', 'fec_office_type', 'fec_state',
  'fec_district', 'party_affiliation', 'user_id',
];

/**
 * Every (table, column) with a foreign key onto candidate_profiles(id).
 * @param queryable - anything with .query() (pool wrapper or client)
 */
async function discoverReferencingColumns(queryable) {
  const result = await queryable.query(`
    SELECT con.conrelid::regclass::text AS table_name, att.attname AS column_name
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
     WHERE con.contype = 'f'
       AND con.confrelid = 'candidate_profiles'::regclass
     ORDER BY 1, 2
  `);
  return result.rows;
}

/**
 * Full (non-partial) unique indexes on `table` whose key includes `column`.
 * Uses pg_index rather than pg_constraint so plain CREATE UNIQUE INDEX
 * uniques are covered too. Returns each index's column-name array.
 */
async function uniqueKeysContaining(client, table, column) {
  const result = await client.query(`
    SELECT ARRAY(
             SELECT att.attname
               FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
               JOIN pg_attribute att
                 ON att.attrelid = i.indrelid AND att.attnum = k.attnum
              ORDER BY k.ord
           )::text[] AS cols
      FROM pg_index i
     WHERE i.indrelid = $1::regclass
       AND i.indisunique
       AND i.indpred IS NULL
       AND (SELECT attnum FROM pg_attribute
             WHERE attrelid = $1::regclass AND attname = $2) = ANY(i.indkey)
  `, [table, column]);
  return result.rows.map(r => r.cols);
}

/**
 * Re-point one referencing column for the whole dedup_map, set-based:
 *   1. For each unique key containing the column, delete remove-side rows
 *      whose keeper equivalent already exists, then dedupe remove-side rows
 *      that would collide with each other after re-pointing.
 *   2. One bulk UPDATE joining dedup_map.
 *   3. Savepoint + per-row fallback only if something exotic (e.g. a partial
 *      unique index) still conflicts — the residue after step 1 is tiny.
 * Must run inside an open transaction that has a dedup_map temp table.
 */
async function bulkTransferColumn(client, table, column) {
  const uniqueKeys = await uniqueKeysContaining(client, table, column);

  for (const cols of uniqueKeys) {
    const others = cols.filter(c => c !== column);
    const eq = others
      .map(c => `t2."${c}" IS NOT DISTINCT FROM t."${c}"`)
      .join(' AND ');

    // Keeper already has an equivalent unique row — the duplicate's copy is
    // redundant.
    await client.query(`
      DELETE FROM "${table}" t
       USING dedup_map m
       WHERE t."${column}" = m.remove_id
         AND EXISTS (
           SELECT 1 FROM "${table}" t2
            WHERE t2."${column}" = m.keep_id
              ${others.length ? `AND ${eq}` : ''}
         )
    `);

    // Two duplicates of the same keeper carrying the same unique row would
    // collide with each other after re-pointing — keep one.
    await client.query(`
      DELETE FROM "${table}" t
       USING dedup_map m, "${table}" t2, dedup_map m2
       WHERE t."${column}" = m.remove_id
         AND t2."${column}" = m2.remove_id
         AND m.keep_id = m2.keep_id
         AND t.ctid > t2.ctid
         ${others.length ? `AND ${eq}` : ''}
    `);
  }

  await client.query(`SAVEPOINT bulk_col`);
  try {
    await client.query(`
      UPDATE "${table}" t SET "${column}" = m.keep_id
        FROM dedup_map m
       WHERE t."${column}" = m.remove_id
    `);
    await client.query(`RELEASE SAVEPOINT bulk_col`);
    return;
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT bulk_col`);
    if (err.code !== '23505') throw err;
  }

  // Residual conflicts (partial unique indexes etc.) — tiny after the
  // set-based pass, so row-by-row is fine here.
  const rows = await client.query(`
    SELECT t.ctid::text AS tid, m.keep_id
      FROM "${table}" t
      JOIN dedup_map m ON t."${column}" = m.remove_id
  `);
  for (const row of rows.rows) {
    await client.query(`SAVEPOINT row_transfer`);
    try {
      await client.query(
        `UPDATE "${table}" SET "${column}" = $1 WHERE ctid = $2::tid`,
        [row.keep_id, row.tid]
      );
      await client.query(`RELEASE SAVEPOINT row_transfer`);
    } catch (err) {
      await client.query(`ROLLBACK TO SAVEPOINT row_transfer`);
      if (err.code !== '23505') throw err;
      await client.query(`DELETE FROM "${table}" WHERE ctid = $1::tid`, [row.tid]);
    }
  }
}

/**
 * Merge a batch of duplicates into their keepers and delete them.
 * pairs: [{ keepId, removeId }, ...] — a removeId must appear only once and
 * must not itself be a keepId.
 * Runs inside an open transaction on `client`; creates a dedup_map temp
 * table scoped to that transaction. onProgress(label) is optional.
 */
async function mergeProfilesBulk(client, refCols, pairs, onProgress) {
  const progress = onProgress || (() => {});

  await client.query(`
    CREATE TEMP TABLE dedup_map (
      remove_id UUID PRIMARY KEY,
      keep_id UUID NOT NULL
    ) ON COMMIT DROP
  `);
  await client.query(
    `INSERT INTO dedup_map (remove_id, keep_id)
     SELECT * FROM unnest($1::uuid[], $2::uuid[])`,
    [pairs.map(p => p.removeId), pairs.map(p => p.keepId)]
  );

  // Fold profile columns into the keeper. With several duplicates per keeper
  // Postgres picks one source row arbitrarily per column set — same behavior
  // migration 020 shipped with, and acceptable: keepers are chosen as the
  // data-richest profile, so the fold only fills gaps.
  const setClauses = COALESCE_COLUMNS
    .map(c => `${c} = COALESCE(keep.${c}, rm.${c})`)
    .join(', ');
  progress('folding profile columns');
  await client.query(`
    UPDATE candidate_profiles keep SET
        ${setClauses},
        is_shadow_profile = keep.is_shadow_profile AND rm.is_shadow_profile,
        candidate_verified = keep.candidate_verified OR rm.candidate_verified,
        updated_at = NOW()
      FROM candidate_profiles rm
      JOIN dedup_map m ON rm.id = m.remove_id
     WHERE keep.id = m.keep_id
  `);

  for (const { table_name, column_name } of refCols) {
    progress(`re-pointing ${table_name}.${column_name}`);
    await bulkTransferColumn(client, table_name, column_name);
  }

  progress('deleting duplicate profiles');
  await client.query(
    `DELETE FROM candidate_profiles WHERE id IN (SELECT remove_id FROM dedup_map)`
  );
}

/**
 * Merge one duplicate profile into a keeper and delete it.
 * Must run inside an open transaction on `client`.
 */
async function mergeProfileInto(client, refCols, keepId, removeId) {
  await mergeProfilesBulk(client, refCols, [{ keepId, removeId }]);
}

module.exports = {
  COALESCE_COLUMNS,
  discoverReferencingColumns,
  mergeProfilesBulk,
  mergeProfileInto,
};
