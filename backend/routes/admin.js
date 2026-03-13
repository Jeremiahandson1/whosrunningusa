/**
 * Admin routes for data ingestion and verification
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const ingestionService = require('../services/ingestion');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// Track which sync jobs are currently running
const activeSyncs = new Set();

// Admin middleware: require both JWT auth + admin user type, or valid API key
const adminAuth = async (req, res, next) => {
  // Check for API key first (for automated scripts)
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY.length > 0) {
    const expected = Buffer.from(process.env.ADMIN_API_KEY);
    const provided = Buffer.from(String(adminKey));
    if (expected.length === provided.length && crypto.timingSafeEqual(expected, provided)) {
      return next();
    }
  }

  // Otherwise require JWT auth + admin user type
  authenticate(req, res, (err) => {
    if (err) return res.status(401).json({ error: 'Authentication required' });
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.user_type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

/**
 * GET /api/admin/ingestion/status
 */
router.get('/ingestion/status', adminAuth, async (req, res, next) => {
  try {
    const status = await ingestionService.getSyncStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/ingestion/sync/fec
 */
router.post('/ingestion/sync/fec', adminAuth, async (req, res, next) => {
  try {
    if (activeSyncs.has('fec')) {
      return res.status(409).json({ error: 'Sync already in progress', source: 'fec' });
    }
    const { cycle = 2024, state } = req.body;
    activeSyncs.add('fec');

    ingestionService.syncFECCandidates(cycle, state)
      .then(stats => console.log('FEC sync completed:', stats))
      .catch(err => console.error('FEC sync error:', err))
      .finally(() => activeSyncs.delete('fec'));

    res.json({ message: 'FEC sync started', cycle, state: state || 'all' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/ingestion/sync/openstates
 */
router.post('/ingestion/sync/openstates', adminAuth, async (req, res, next) => {
  try {
    if (activeSyncs.has('open_states')) {
      return res.status(409).json({ error: 'Sync already in progress', source: 'open_states' });
    }
    const { state } = req.body;
    activeSyncs.add('open_states');

    ingestionService.syncOpenStatesLegislators(state)
      .then(stats => console.log('Open States sync completed:', stats))
      .catch(err => console.error('Open States sync error:', err))
      .finally(() => activeSyncs.delete('open_states'));

    res.json({
      message: 'Open States sync started',
      state: state || 'all states',
      note: 'This may take several minutes for all states'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/ingestion/verify/:candidateId
 */
router.post('/ingestion/verify/:candidateId', adminAuth, async (req, res, next) => {
  try {
    const result = await ingestionService.verifyCandidate(req.params.candidateId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/ingestion/sync-runs
 */
router.get('/ingestion/sync-runs', adminAuth, async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const result = await db.query(`
      SELECT sr.*, ds.name as source_name, ds.display_name as source_display_name
      FROM sync_runs sr
      JOIN data_sources ds ON sr.data_source_id = ds.id
      ORDER BY sr.started_at DESC
      LIMIT $1
    `, [parseInt(limit)]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/ingestion/candidates/:source
 */
router.get('/ingestion/candidates/:source', adminAuth, async (req, res, next) => {
  try {
    const candidates = await ingestionService.getCandidatesBySource(req.params.source);
    res.json(candidates);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/stats
 */
router.get('/stats', adminAuth, async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM candidate_profiles WHERE is_active = TRUE) as total_candidates,
        (SELECT COUNT(*) FROM candidate_profiles WHERE candidate_verified = TRUE) as verified_candidates,
        (SELECT COUNT(*) FROM offices) as total_offices,
        (SELECT COUNT(*) FROM races) as total_races,
        (SELECT COUNT(*) FROM elections WHERE is_active = TRUE) as active_elections,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM candidate_criminal_records WHERE moderation_status = 'pending') as pending_criminal_records
    `);
    res.json(stats.rows[0] || {});
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/unverified-candidates
 */
router.get('/unverified-candidates', adminAuth, async (req, res, next) => {
  try {
    const { limit = 20, state } = req.query;
    let query = `
      SELECT cp.id, cp.display_name, cp.party_affiliation,
             cp.candidate_verified
      FROM candidate_profiles cp
      WHERE cp.candidate_verified = FALSE OR cp.candidate_verified IS NULL
    `;
    const params = [];

    if (state) {
      params.push(state);
      query += ` AND EXISTS (
        SELECT 1 FROM candidacies c
        JOIN races r ON c.race_id = r.id
        JOIN offices o ON r.office_id = o.id
        WHERE c.candidate_id = cp.id AND o.state = $${params.length}
      )`;
    }

    params.push(parseInt(limit));
    query += ` ORDER BY cp.display_name LIMIT $${params.length}`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/bulk-verify
 */
router.post('/bulk-verify', adminAuth, async (req, res, next) => {
  try {
    const { candidateIds } = req.body;
    if (!candidateIds || !Array.isArray(candidateIds)) {
      return res.status(400).json({ error: 'candidateIds array required' });
    }

    const results = [];
    for (const id of candidateIds.slice(0, 50)) {
      const result = await ingestionService.verifyCandidate(id);
      results.push({ candidateId: id, ...result });
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    res.json({
      processed: results.length,
      verified: results.filter(r => r.verified).length,
      results
    });
  } catch (err) {
    next(err);
  }
});

// =====================================================
// CANDIDATES MANAGEMENT
// =====================================================

/**
 * GET /api/admin/candidates - searchable list
 */
router.get('/candidates', adminAuth, async (req, res, next) => {
  try {
    const { search, limit = 20, offset = 0, verified } = req.query;
    let query = `
      SELECT cp.*, u.email, u.username
      FROM candidate_profiles cp
      LEFT JOIN users u ON cp.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (cp.display_name ILIKE $${params.length} OR cp.party_affiliation ILIKE $${params.length})`;
    }
    if (verified === 'true') {
      query += ` AND cp.candidate_verified = TRUE`;
    } else if (verified === 'false') {
      query += ` AND (cp.candidate_verified = FALSE OR cp.candidate_verified IS NULL)`;
    }

    query += ` ORDER BY cp.display_name`;
    params.push(parseInt(limit));
    query += ` LIMIT $${params.length}`;
    params.push(parseInt(offset));
    query += ` OFFSET $${params.length}`;

    const result = await db.query(query, params);

    let countQuery = `SELECT COUNT(*) FROM candidate_profiles cp WHERE 1=1`;
    const countParams = [];
    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (cp.display_name ILIKE $${countParams.length} OR cp.party_affiliation ILIKE $${countParams.length})`;
    }
    if (verified === 'true') {
      countQuery += ` AND cp.candidate_verified = TRUE`;
    } else if (verified === 'false') {
      countQuery += ` AND (cp.candidate_verified = FALSE OR cp.candidate_verified IS NULL)`;
    }
    const countResult = await db.query(countQuery, countParams);

    res.json({ candidates: result.rows, total: parseInt(countResult.rows[0]?.count || 0) });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/candidates/:id - update candidate
 */
router.put('/candidates/:id', adminAuth, async (req, res, next) => {
  try {
    const { displayName, partyAffiliation, officialTitle, fullBio } = req.body;
    const result = await db.query(`
      UPDATE candidate_profiles SET
        display_name = COALESCE($2, display_name),
        party_affiliation = COALESCE($3, party_affiliation),
        official_title = COALESCE($4, official_title),
        full_bio = COALESCE($5, full_bio),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id, displayName, partyAffiliation, officialTitle, fullBio]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Candidate not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/candidates/:id/verify - toggle verification
 */
router.post('/candidates/:id/verify', adminAuth, async (req, res, next) => {
  try {
    const { verified } = req.body;
    const result = await db.query(`
      UPDATE candidate_profiles SET
        candidate_verified = $2,
        candidate_verified_at = CASE WHEN $2 = TRUE THEN COALESCE(candidate_verified_at, NOW()) ELSE NULL END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, display_name, candidate_verified
    `, [req.params.id, verified]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Candidate not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/candidates/:id
 */
router.delete('/candidates/:id', adminAuth, async (req, res, next) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const candidateId = req.params.id;

    // Check candidate exists
    const check = await client.query('SELECT id FROM candidate_profiles WHERE id = $1', [candidateId]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Delete all related data (order matters for FK constraints)
    await client.query('DELETE FROM candidate_criminal_records WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM community_notes WHERE content_type = $1 AND content_id = $2', ['candidate', candidateId]);
    await client.query('DELETE FROM answers WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM questions WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM voting_records WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM bill_sponsorships WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM interest_group_ratings WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM campaign_finance_summaries WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM promises WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM endorsements WHERE endorser_id = $1 OR endorsed_id = $1', [candidateId]);
    await client.query('DELETE FROM posts WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM town_hall_questions WHERE town_hall_id IN (SELECT id FROM town_halls WHERE candidate_id = $1)', [candidateId]);
    await client.query('DELETE FROM town_hall_rsvps WHERE town_hall_id IN (SELECT id FROM town_halls WHERE candidate_id = $1)', [candidateId]);
    await client.query('DELETE FROM town_halls WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM candidate_source_links WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM candidacies WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM candidate_positions WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM follows WHERE candidate_id = $1', [candidateId]);
    await client.query('DELETE FROM candidate_profiles WHERE id = $1', [candidateId]);

    await client.query('COMMIT');
    res.json({ message: 'Candidate deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * POST /api/admin/candidates/merge
 */
router.post('/candidates/merge', adminAuth, async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { keepId, mergeId } = req.body;
    if (!keepId || !mergeId) return res.status(400).json({ error: 'keepId and mergeId required' });
    if (keepId === mergeId) return res.status(400).json({ error: 'Cannot merge a candidate with itself' });

    await client.query('BEGIN');

    // Validate both candidates exist
    const [keepResult, mergeResult] = await Promise.all([
      client.query('SELECT id FROM candidate_profiles WHERE id = $1', [keepId]),
      client.query('SELECT id FROM candidate_profiles WHERE id = $1', [mergeId]),
    ]);
    if (keepResult.rows.length === 0) return res.status(404).json({ error: 'Keep candidate not found' });
    if (mergeResult.rows.length === 0) return res.status(404).json({ error: 'Merge candidate not found' });

    // Move all references from mergeId to keepId
    await client.query('UPDATE candidacies SET candidate_id = $1 WHERE candidate_id = $2 AND NOT EXISTS (SELECT 1 FROM candidacies WHERE candidate_id = $1 AND race_id = candidacies.race_id)', [keepId, mergeId]);
    await client.query('UPDATE candidate_positions SET candidate_id = $1 WHERE candidate_id = $2 AND NOT EXISTS (SELECT 1 FROM candidate_positions WHERE candidate_id = $1 AND issue_id = candidate_positions.issue_id)', [keepId, mergeId]);
    await client.query('UPDATE questions SET candidate_id = $1 WHERE candidate_id = $2', [keepId, mergeId]);
    await client.query('UPDATE posts SET candidate_id = $1 WHERE candidate_id = $2', [keepId, mergeId]);
    await client.query('UPDATE town_halls SET candidate_id = $1 WHERE candidate_id = $2', [keepId, mergeId]);
    await client.query('UPDATE candidate_source_links SET candidate_id = $1 WHERE candidate_id = $2', [keepId, mergeId]);

    // Delete the merged candidate
    await client.query('DELETE FROM candidacies WHERE candidate_id = $1', [mergeId]);
    await client.query('DELETE FROM candidate_positions WHERE candidate_id = $1', [mergeId]);
    await client.query('DELETE FROM follows WHERE candidate_id = $1', [mergeId]);
    await client.query('DELETE FROM candidate_profiles WHERE id = $1', [mergeId]);

    await client.query('COMMIT');
    res.json({ message: 'Candidates merged', keptId: keepId });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// =====================================================
// MODERATION
// =====================================================

/**
 * GET /api/admin/moderation - flagged content queue
 */
router.get('/moderation', adminAuth, async (req, res, next) => {
  try {
    const { status = 'pending', limit = 20 } = req.query;
    const result = await db.query(`
      SELECT mf.*,
        u.username as flagged_by_username,
        admin.username as reviewed_by_username
      FROM moderation_flags mf
      LEFT JOIN users u ON mf.flagged_by_user_id = u.id
      LEFT JOIN users admin ON mf.reviewed_by_admin_id = admin.id
      WHERE mf.status = $1
      ORDER BY mf.created_at DESC
      LIMIT $2
    `, [status, parseInt(limit)]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/moderation/:id - resolve flag
 */
router.put('/moderation/:id', adminAuth, async (req, res, next) => {
  try {
    const { status, actionTaken } = req.body;
    if (!['reviewed', 'actioned', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(`
      UPDATE moderation_flags SET
        status = $2,
        action_taken = $3,
        reviewed_by_admin_id = $4,
        reviewed_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id, status, actionTaken, req.user?.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Flag not found' });

    // If actioned, handle the flagged content
    if (status === 'actioned') {
      const flag = result.rows[0];
      if (flag.content_type === 'post') {
        await db.query('UPDATE posts SET is_flagged = TRUE, flagged_reason = $2 WHERE id = $1', [flag.content_id, flag.reason]);
      } else if (flag.content_type === 'question') {
        await db.query('UPDATE questions SET is_flagged = TRUE, flagged_reason = $2, status = $3 WHERE id = $1', [flag.content_id, flag.reason, 'flagged']);
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// =====================================================
// ELECTIONS & RACES CRUD
// =====================================================

/**
 * GET /api/admin/elections
 */
router.get('/elections', adminAuth, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT e.*,
        (SELECT COUNT(*) FROM races r WHERE r.election_id = e.id) as race_count
      FROM elections e
      ORDER BY e.election_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/elections
 */
router.post('/elections', adminAuth, async (req, res, next) => {
  try {
    const { name, electionDate, electionType, scope, state, registrationDeadline, earlyVotingStart, earlyVotingEnd } = req.body;
    if (!name || !electionDate || !electionType) {
      return res.status(400).json({ error: 'name, electionDate, and electionType required' });
    }
    const result = await db.query(`
      INSERT INTO elections (name, election_date, election_type, scope, state, registration_deadline, early_voting_start, early_voting_end, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      RETURNING *
    `, [name, electionDate, electionType, scope || 'state', state, registrationDeadline, earlyVotingStart, earlyVotingEnd]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/elections/:id
 */
router.put('/elections/:id', adminAuth, async (req, res, next) => {
  try {
    const { name, electionDate, electionType, scope, state, isActive, registrationDeadline, earlyVotingStart, earlyVotingEnd } = req.body;
    const result = await db.query(`
      UPDATE elections SET
        name = COALESCE($2, name),
        election_date = COALESCE($3, election_date),
        election_type = COALESCE($4, election_type),
        scope = COALESCE($5, scope),
        state = COALESCE($6, state),
        is_active = COALESCE($7, is_active),
        registration_deadline = COALESCE($8, registration_deadline),
        early_voting_start = COALESCE($9, early_voting_start),
        early_voting_end = COALESCE($10, early_voting_end),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id, name, electionDate, electionType, scope, state, isActive, registrationDeadline, earlyVotingStart, earlyVotingEnd]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Election not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/elections/:id
 */
router.delete('/elections/:id', adminAuth, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM elections WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Election not found' });
    res.json({ message: 'Election deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/races
 */
router.get('/races', adminAuth, async (req, res, next) => {
  try {
    const { electionId } = req.query;
    let query = `
      SELECT r.*, o.name as office_name, o.office_level, o.state as office_state,
        e.name as election_name, e.election_date,
        (SELECT COUNT(*) FROM candidacies c WHERE c.race_id = r.id) as candidate_count
      FROM races r
      JOIN offices o ON r.office_id = o.id
      JOIN elections e ON r.election_id = e.id
    `;
    const params = [];
    if (electionId) {
      params.push(electionId);
      query += ` WHERE r.election_id = $1`;
    }
    query += ` ORDER BY e.election_date DESC, o.name`;
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/races
 */
router.post('/races', adminAuth, async (req, res, next) => {
  try {
    const { electionId, officeId, name, description } = req.body;
    if (!electionId || !officeId || !name) {
      return res.status(400).json({ error: 'electionId, officeId, and name required' });
    }
    const result = await db.query(`
      INSERT INTO races (election_id, office_id, name, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [electionId, officeId, name, description]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/races/:id
 */
router.delete('/races/:id', adminAuth, async (req, res, next) => {
  try {
    await db.query('DELETE FROM candidacies WHERE race_id = $1', [req.params.id]);
    const result = await db.query('DELETE FROM races WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Race not found' });
    res.json({ message: 'Race deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/races/:id/candidates - add candidate to race
 */
router.post('/races/:id/candidates', adminAuth, async (req, res, next) => {
  try {
    const { candidateId, filingStatus = 'filed' } = req.body;
    const result = await db.query(`
      INSERT INTO candidacies (candidate_id, race_id, filing_status, filed_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (candidate_id, race_id) DO UPDATE SET filing_status = $3
      RETURNING *
    `, [candidateId, req.params.id, filingStatus]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/races/:raceId/candidates/:candidateId
 */
router.delete('/races/:raceId/candidates/:candidateId', adminAuth, async (req, res, next) => {
  try {
    await db.query('DELETE FROM candidacies WHERE race_id = $1 AND candidate_id = $2', [req.params.raceId, req.params.candidateId]);
    res.json({ message: 'Candidate removed from race' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/offices - for dropdowns
 */
router.get('/offices', adminAuth, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM offices ORDER BY office_level, state, name LIMIT 500');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// =====================================================
// USERS MANAGEMENT
// =====================================================

/**
 * GET /api/admin/users
 */
router.get('/users', adminAuth, async (req, res, next) => {
  try {
    const { search, limit = 20, offset = 0, userType } = req.query;
    let query = `SELECT id, email, username, user_type, first_name, last_name, state, city, is_active, is_banned, ban_reason, created_at, last_login_at FROM users WHERE 1=1`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (username ILIKE $${params.length} OR email ILIKE $${params.length} OR first_name ILIKE $${params.length} OR last_name ILIKE $${params.length})`;
    }
    if (userType) {
      params.push(userType);
      query += ` AND user_type = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC`;
    params.push(parseInt(limit));
    query += ` LIMIT $${params.length}`;
    params.push(parseInt(offset));
    query += ` OFFSET $${params.length}`;

    const result = await db.query(query, params);
    // Build matching count query with same filters (without LIMIT/OFFSET)
    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const countParams = [];
    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (username ILIKE $${countParams.length} OR email ILIKE $${countParams.length} OR first_name ILIKE $${countParams.length} OR last_name ILIKE $${countParams.length})`;
    }
    if (userType) {
      countParams.push(userType);
      countQuery += ` AND user_type = $${countParams.length}`;
    }
    const countResult = await db.query(countQuery, countParams);
    res.json({ users: result.rows, total: parseInt(countResult.rows[0]?.count || 0) });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/users/:id/suspend
 */
router.put('/users/:id/suspend', adminAuth, async (req, res, next) => {
  try {
    const { banned, banReason } = req.body;
    const result = await db.query(`
      UPDATE users SET
        is_banned = $2,
        ban_reason = $3,
        banned_at = CASE WHEN $2 = TRUE THEN NOW() ELSE NULL END,
        is_active = CASE WHEN $2 = TRUE THEN FALSE ELSE TRUE END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, username, is_banned, ban_reason
    `, [req.params.id, banned, banReason || null]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/users/:id/role
 */
router.put('/users/:id/role', adminAuth, async (req, res, next) => {
  try {
    const { userType } = req.body;
    if (!['voter', 'candidate', 'admin'].includes(userType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }
    const result = await db.query(
      'UPDATE users SET user_type = $2, updated_at = NOW() WHERE id = $1 RETURNING id, email, username, user_type',
      [req.params.id, userType]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/users/:id/activity
 */
router.get('/users/:id/activity', adminAuth, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT * FROM audit_log
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// =====================================================
// CRIMINAL RECORDS MODERATION
// =====================================================

/**
 * GET /api/admin/criminal-records/queue - pending records for review
 */
router.get('/criminal-records/queue', adminAuth, async (req, res, next) => {
  try {
    const { status = 'pending', limit = 20 } = req.query;
    const result = await db.query(`
      SELECT cr.*, cp.display_name as candidate_name
      FROM candidate_criminal_records cr
      JOIN candidate_profiles cp ON cr.candidate_id = cp.id
      WHERE cr.moderation_status = $1
      ORDER BY cr.created_at ASC
      LIMIT $2
    `, [status, parseInt(limit)]);
    res.json({ records: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/criminal-records/:id/moderate - approve or reject a record
 */
router.put('/criminal-records/:id/moderate', adminAuth, async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const isPublic = status === 'approved';
    const result = await db.query(`
      UPDATE candidate_criminal_records SET
        moderation_status = $2,
        is_public = $3,
        moderated_by = $4,
        moderated_at = NOW(),
        moderation_notes = $5,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id, status, isPublic, req.user?.id || null, notes || null]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/criminal-records - admin adds a system-pulled record (goes to pending)
 */
router.post('/criminal-records', adminAuth, async (req, res, next) => {
  try {
    const { candidateId, offense, year, jurisdiction, jurisdictionLevel, disposition, sentence } = req.body;
    if (!candidateId || !offense || !disposition) {
      return res.status(400).json({ error: 'candidateId, offense, and disposition required' });
    }

    const result = await db.query(`
      INSERT INTO candidate_criminal_records
        (candidate_id, offense, year, jurisdiction, jurisdiction_level, disposition, sentence, source, is_public, moderation_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'system_pulled', FALSE, 'pending')
      RETURNING *
    `, [candidateId, offense, year || null, jurisdiction || null, jurisdictionLevel || null, disposition, sentence || null]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// =====================================================
// SYNC: Congress.gov trigger
// =====================================================

/**
 * POST /api/admin/ingestion/sync/congress
 */
router.post('/ingestion/sync/congress', adminAuth, async (req, res, next) => {
  try {
    if (activeSyncs.has('congress_gov')) {
      return res.status(409).json({ error: 'Sync already in progress', source: 'congress_gov' });
    }
    const { state, bills } = req.body;
    // Validate state to prevent command injection
    if (state && !/^[A-Za-z]{2}$/.test(state)) {
      return res.status(400).json({ error: 'Invalid state code' });
    }
    activeSyncs.add('congress_gov');
    const { execFile } = require('child_process');
    const args = [bills ? '--bills' : '--members'];
    if (state) args.push(`--state=${state.toUpperCase()}`);
    execFile('node', ['scripts/sync-congress-gov.js', ...args], { cwd: __dirname + '/..', env: process.env }, (error, stdout, stderr) => {
      if (error) console.error('Congress.gov sync error:', error.message);
      activeSyncs.delete('congress_gov');
    });
    res.json({ message: `Congress.gov sync started (${bills ? 'bills' : 'members'})`, state: state || 'all' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/ingestion/sync/bills
 */
router.post('/ingestion/sync/bills', adminAuth, async (req, res, next) => {
  try {
    if (activeSyncs.has('bills')) {
      return res.status(409).json({ error: 'Sync already in progress', source: 'bills' });
    }
    const { state = 'WI' } = req.body;
    if (!/^[A-Za-z]{2}$/.test(state)) {
      return res.status(400).json({ error: 'Invalid state code' });
    }
    activeSyncs.add('bills');
    const { execFile } = require('child_process');
    execFile('node', ['scripts/sync-open-states-bills.js', state.toUpperCase()], { cwd: __dirname + '/..', env: process.env }, (error, stdout, stderr) => {
      if (error) console.error('Bills sync error:', error.message);
      activeSyncs.delete('bills');
    });
    res.json({ message: `Bills sync started for ${state}` });
  } catch (err) {
    next(err);
  }
});

// =====================================================
// COMMUNITY NOTES MODERATION
// =====================================================

/**
 * GET /api/admin/community-notes — list all notes (paginated, filter by is_visible)
 */
router.get('/community-notes', adminAuth, async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, visible } = req.query;
    let query = `
      SELECT cn.*, u.username as author_username
      FROM community_notes cn
      LEFT JOIN users u ON cn.author_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (visible === 'true') {
      query += ` AND cn.is_visible = TRUE`;
    } else if (visible === 'false') {
      query += ` AND cn.is_visible = FALSE`;
    }

    query += ` ORDER BY cn.created_at DESC`;
    params.push(parseInt(limit));
    query += ` LIMIT $${params.length}`;
    params.push(parseInt(offset));
    query += ` OFFSET $${params.length}`;

    const result = await db.query(query, params);

    const countResult = await db.query('SELECT COUNT(*) FROM community_notes');

    res.json({ notes: result.rows, total: parseInt(countResult.rows[0]?.count || 0) });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/community-notes/:noteId — admin delete any note
 */
router.delete('/community-notes/:noteId', adminAuth, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM community_notes WHERE id = $1 RETURNING id', [req.params.noteId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    res.json({ message: 'Note deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/community-notes/:noteId/visibility — toggle visibility override
 */
router.put('/community-notes/:noteId/visibility', adminAuth, async (req, res, next) => {
  try {
    const { visible } = req.body;
    if (typeof visible !== 'boolean') {
      return res.status(400).json({ error: 'visible (boolean) is required' });
    }

    const result = await db.query(
      'UPDATE community_notes SET is_visible = $2 WHERE id = $1 RETURNING *',
      [req.params.noteId, visible]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
