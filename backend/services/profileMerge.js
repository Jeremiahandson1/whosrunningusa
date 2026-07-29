/**
 * Shared candidate-profile merge logic.
 *
 * Used by the admin merge endpoint (backend/routes/admin.js) and the nightly
 * dedup script (backend/scripts/dedup-candidate-profiles.js). Merging means:
 * fold the duplicate's profile columns into the keeper (COALESCE), re-point
 * every foreign key that references candidate_profiles, then delete the
 * duplicate row.
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
 * Re-point one referencing column from removeId to keepId.
 * Bulk update first; on a unique violation fall back to row-by-row, dropping
 * duplicate rows whose keeper-equivalent already exists (candidacies for the
 * same race, source links for the same external id, per-politician score
 * rows, ...). Must run inside an open transaction on `client`.
 */
async function transferColumn(client, table, column, keepId, removeId) {
  await client.query(`SAVEPOINT bulk_transfer`);
  try {
    await client.query(
      `UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" = $2`,
      [keepId, removeId]
    );
    await client.query(`RELEASE SAVEPOINT bulk_transfer`);
    return;
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT bulk_transfer`);
    if (err.code !== '23505') throw err;
  }

  const rows = await client.query(
    `SELECT ctid::text AS tid FROM "${table}" WHERE "${column}" = $1`,
    [removeId]
  );
  for (const row of rows.rows) {
    await client.query(`SAVEPOINT row_transfer`);
    try {
      await client.query(
        `UPDATE "${table}" SET "${column}" = $1 WHERE ctid = $2::tid`,
        [keepId, row.tid]
      );
      await client.query(`RELEASE SAVEPOINT row_transfer`);
    } catch (err) {
      await client.query(`ROLLBACK TO SAVEPOINT row_transfer`);
      if (err.code !== '23505') throw err;
      // Keeper already has this unique row — the duplicate's copy is redundant.
      await client.query(`DELETE FROM "${table}" WHERE ctid = $1::tid`, [row.tid]);
    }
  }
}

/**
 * Merge one duplicate profile into a keeper and delete it.
 * Must run inside an open transaction on `client`.
 */
async function mergeProfileInto(client, refCols, keepId, removeId) {
  const setClauses = COALESCE_COLUMNS
    .map(c => `${c} = COALESCE(keep.${c}, rm.${c})`)
    .join(', ');

  await client.query(
    `UPDATE candidate_profiles keep SET
        ${setClauses},
        is_shadow_profile = keep.is_shadow_profile AND rm.is_shadow_profile,
        candidate_verified = keep.candidate_verified OR rm.candidate_verified,
        updated_at = NOW()
      FROM candidate_profiles rm
     WHERE keep.id = $1 AND rm.id = $2`,
    [keepId, removeId]
  );

  for (const { table_name, column_name } of refCols) {
    await transferColumn(client, table_name, column_name, keepId, removeId);
  }

  await client.query(`DELETE FROM candidate_profiles WHERE id = $1`, [removeId]);
}

module.exports = { COALESCE_COLUMNS, discoverReferencingColumns, transferColumn, mergeProfileInto };
