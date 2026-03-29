const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, optionalAuth } = require('../middleware/auth');

// GET /petitions — list active petitions with filters
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { state, target_type, status = 'active', sort = 'newest', q, page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`p.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    if (state) {
      conditions.push(`p.state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }
    if (target_type) {
      conditions.push(`p.target_type = $${paramIndex}`);
      params.push(target_type);
      paramIndex++;
    }
    if (q) {
      conditions.push(`(p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'p.created_at DESC';
    if (sort === 'signatures') orderBy = 'p.current_signatures DESC';
    if (sort === 'deadline') orderBy = 'p.deadline ASC NULLS LAST';
    if (sort === 'trending') orderBy = 'recent_sigs DESC';

    // Count total
    const countResult = await db.query(`SELECT COUNT(*) as total FROM petitions p ${where}`, params);
    const total = parseInt(countResult.rows[0].total);

    // Fetch petitions with progress percentage
    let selectExtra = '';
    let joinExtra = '';
    if (sort === 'trending') {
      selectExtra = `, (SELECT COUNT(*) FROM petition_signatures ps2 WHERE ps2.petition_id = p.id AND ps2.signed_at > NOW() - INTERVAL '7 days') as recent_sigs`;
    }

    const query = `
      SELECT p.id, p.title, p.description, p.plain_language_summary,
             p.target_type, p.target_entity, p.state,
             p.required_signatures, p.current_signatures, p.status,
             p.identity_verification_required, p.deadline,
             p.created_at,
             ROUND((p.current_signatures::decimal / NULLIF(p.required_signatures, 0)) * 100, 1) as progress_pct,
             u.first_name as creator_first_name, u.last_name as creator_last_name,
             cp.display_name as target_politician_name
             ${selectExtra}
      FROM petitions p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN candidate_profiles cp ON p.target_politician_id = cp.id
      ${joinExtra}
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // If user is logged in, check which petitions they signed
    let signedIds = new Set();
    if (req.user) {
      const signed = await db.query(
        `SELECT petition_id FROM petition_signatures WHERE user_id = $1`,
        [req.user.id]
      );
      signedIds = new Set(signed.rows.map(r => r.petition_id));
    }

    const petitions = result.rows.map(p => ({
      ...p,
      user_signed: signedIds.has(p.id),
      progress_pct: parseFloat(p.progress_pct) || 0,
    }));

    res.json({ petitions, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

// GET /petitions/:id — single petition with full details
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT p.*,
             u.first_name as creator_first_name, u.last_name as creator_last_name,
             cp.display_name as target_politician_name,
             ROUND((p.current_signatures::decimal / NULLIF(p.required_signatures, 0)) * 100, 1) as progress_pct,
             (SELECT COUNT(*) FROM petition_volunteers pv WHERE pv.petition_id = p.id) as volunteer_count
      FROM petitions p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN candidate_profiles cp ON p.target_politician_id = cp.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Petition not found' });
    }

    const petition = result.rows[0];

    // Recent signatures
    const signatures = await db.query(`
      SELECT ps.signed_at, ps.verified, u.first_name, u.last_name
      FROM petition_signatures ps
      JOIN users u ON ps.user_id = u.id
      WHERE ps.petition_id = $1
      ORDER BY ps.signed_at DESC LIMIT 20
    `, [id]);

    // Volunteers
    const volunteers = await db.query(`
      SELECT pv.role, pv.joined_at, u.first_name, u.last_name
      FROM petition_volunteers pv
      JOIN users u ON pv.user_id = u.id
      WHERE pv.petition_id = $1
      ORDER BY pv.joined_at ASC
    `, [id]);

    // State requirements if applicable
    let stateRequirements = null;
    if (petition.state) {
      const reqResult = await db.query(
        `SELECT * FROM petition_state_requirements WHERE state = $1`,
        [petition.state]
      );
      if (reqResult.rows.length > 0) stateRequirements = reqResult.rows;
    }

    let userSigned = false;
    let userVolunteered = false;
    if (req.user) {
      const sig = await db.query(
        `SELECT id FROM petition_signatures WHERE petition_id = $1 AND user_id = $2`,
        [id, req.user.id]
      );
      userSigned = sig.rows.length > 0;
      const vol = await db.query(
        `SELECT id FROM petition_volunteers WHERE petition_id = $1 AND user_id = $2`,
        [id, req.user.id]
      );
      userVolunteered = vol.rows.length > 0;
    }

    res.json({
      petition: {
        ...petition,
        progress_pct: parseFloat(petition.progress_pct) || 0,
        user_signed: userSigned,
        user_volunteered: userVolunteered,
      },
      signatures: signatures.rows,
      volunteers: volunteers.rows,
      stateRequirements,
    });
  } catch (error) {
    next(error);
  }
});

// POST /petitions — create a petition
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { title, description, plain_language_summary, target_type, target_entity,
            target_politician_id, state, required_signatures, identity_verification_required, deadline } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const result = await db.query(`
      INSERT INTO petitions (title, description, plain_language_summary, target_type, target_entity,
        target_politician_id, state, required_signatures, identity_verification_required, deadline, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [title, description, plain_language_summary || null, target_type || 'general',
        target_entity || null, target_politician_id || null, state || null,
        required_signatures || 1000, identity_verification_required || false,
        deadline || null, req.user.id]);

    res.status(201).json({ petition: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /petitions/:id/sign — sign a petition
router.post('/:id/sign', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check petition exists and is active
    const petition = await db.query('SELECT id, status FROM petitions WHERE id = $1', [id]);
    if (petition.rows.length === 0) return res.status(404).json({ error: 'Petition not found' });
    if (petition.rows[0].status !== 'active') return res.status(400).json({ error: 'Petition is not accepting signatures' });

    // Insert signature and increment count atomically
    await db.query('BEGIN');
    try {
      await db.query(
        `INSERT INTO petition_signatures (petition_id, user_id, verified)
         VALUES ($1, $2, true)`,
        [id, req.user.id]
      );
      const updated = await db.query(
        `UPDATE petitions SET current_signatures = current_signatures + 1, updated_at = NOW()
         WHERE id = $1 RETURNING current_signatures, required_signatures`,
        [id]
      );
      await db.query('COMMIT');

      const { current_signatures, required_signatures } = updated.rows[0];
      res.json({
        signed: true,
        current_signatures,
        progress_pct: Math.round((current_signatures / required_signatures) * 1000) / 10,
      });
    } catch (err) {
      await db.query('ROLLBACK');
      if (err.code === '23505') {
        return res.status(409).json({ error: 'You have already signed this petition' });
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
});

// DELETE /petitions/:id/sign — remove signature
router.delete('/:id/sign', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query('BEGIN');
    try {
      const del = await db.query(
        `DELETE FROM petition_signatures WHERE petition_id = $1 AND user_id = $2 RETURNING id`,
        [id, req.user.id]
      );
      if (del.rows.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Signature not found' });
      }
      await db.query(
        `UPDATE petitions SET current_signatures = GREATEST(current_signatures - 1, 0), updated_at = NOW() WHERE id = $1`,
        [id]
      );
      await db.query('COMMIT');
      res.json({ signed: false });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    next(error);
  }
});

// POST /petitions/:id/volunteer — volunteer for a petition
router.post('/:id/volunteer', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const result = await db.query(
      `INSERT INTO petition_volunteers (petition_id, user_id, role)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, req.user.id, role || 'general']
    );

    res.status(201).json({ volunteer: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Already volunteering for this petition' });
    }
    next(error);
  }
});

// GET /petitions/:id/progress — real-time progress dashboard data
router.get('/:id/progress', async (req, res, next) => {
  try {
    const { id } = req.params;

    const petition = await db.query(
      `SELECT current_signatures, required_signatures, deadline, created_at
       FROM petitions WHERE id = $1`,
      [id]
    );
    if (petition.rows.length === 0) return res.status(404).json({ error: 'Petition not found' });

    // Daily signature counts for chart
    const daily = await db.query(`
      SELECT DATE(signed_at) as date, COUNT(*) as count
      FROM petition_signatures
      WHERE petition_id = $1
      GROUP BY DATE(signed_at)
      ORDER BY date ASC
    `, [id]);

    // Top states of signers
    const states = await db.query(`
      SELECT u.state, COUNT(*) as count
      FROM petition_signatures ps
      JOIN users u ON ps.user_id = u.id
      WHERE ps.petition_id = $1 AND u.state IS NOT NULL
      GROUP BY u.state
      ORDER BY count DESC LIMIT 10
    `, [id]);

    const p = petition.rows[0];
    const daysSinceCreation = Math.max(1, Math.ceil((Date.now() - new Date(p.created_at).getTime()) / 86400000));
    const avgPerDay = p.current_signatures / daysSinceCreation;
    const remaining = Math.max(0, p.required_signatures - p.current_signatures);
    const estimatedDaysToGoal = avgPerDay > 0 ? Math.ceil(remaining / avgPerDay) : null;

    res.json({
      current_signatures: p.current_signatures,
      required_signatures: p.required_signatures,
      progress_pct: Math.round((p.current_signatures / p.required_signatures) * 1000) / 10,
      deadline: p.deadline,
      avg_signatures_per_day: Math.round(avgPerDay * 10) / 10,
      estimated_days_to_goal: estimatedDaysToGoal,
      daily_counts: daily.rows,
      top_states: states.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
