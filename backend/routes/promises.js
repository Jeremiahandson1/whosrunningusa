const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /promises/leaderboard — Politicians ranked by promise_score
router.get('/leaderboard', async (req, res, next) => {
  try {
    const { party, chamber, state, sort = 'score_desc', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = ['ps.locked_promises > 0'];
    const params = [];
    let paramIndex = 1;

    if (party) {
      conditions.push(`cp.party_affiliation = $${paramIndex}`);
      params.push(party);
      paramIndex++;
    }
    if (chamber) {
      conditions.push(`cp.fec_office_type = $${paramIndex}`);
      params.push(chamber);
      paramIndex++;
    }
    if (state) {
      conditions.push(`cp.fec_state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    let orderBy = 'ps.promise_score DESC';
    if (sort === 'kept') orderBy = 'ps.kept DESC';
    if (sort === 'broken') orderBy = 'ps.broken DESC';

    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM promise_scores ps
       JOIN candidate_profiles cp ON ps.politician_id = cp.id
       ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT ps.politician_id as id,
             cp.display_name, cp.party_affiliation as party,
             cp.fec_state as state, cp.fec_office_type as office_level,
             ps.promise_score, ps.total_promises, ps.locked_promises,
             ps.kept, ps.broken, ps.in_progress, ps.compromised, ps.pending
      FROM promise_scores ps
      JOIN candidate_profiles cp ON ps.politician_id = cp.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      politicians: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// GET /promises/politician/:id — All promises for a specific politician
router.get('/politician/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const promisesResult = await db.query(
      `SELECT p.id, p.promise_text, p.category_id, p.is_locked, p.locked_at,
              p.status, p.status_explanation, p.status_updated_at, p.created_at,
              ic.name as category_name,
              json_agg(
                DISTINCT jsonb_build_object(
                  'id', pac.id,
                  'match_type', pac.match_type,
                  'confidence', pac.confidence,
                  'ai_reasoning', pac.ai_reasoning,
                  'reviewed', pac.reviewed,
                  'created_at', pac.created_at
                )
              ) FILTER (WHERE pac.id IS NOT NULL) as auto_checks
       FROM promises p
       LEFT JOIN issue_categories ic ON p.category_id = ic.id
       LEFT JOIN promise_auto_checks pac ON pac.promise_id = p.id
       WHERE p.candidate_id = $1
       GROUP BY p.id, ic.name
       ORDER BY p.is_locked DESC, p.created_at DESC`,
      [id]
    );

    const scoreResult = await db.query(
      `SELECT promise_score, total_promises, locked_promises,
              kept, broken, in_progress, compromised, pending
       FROM promise_scores
       WHERE politician_id = $1`,
      [id]
    );

    res.json({
      promises: promisesResult.rows,
      score: scoreResult.rows[0] || null
    });
  } catch (error) {
    next(error);
  }
});

// GET /promises/politician/:id/score — Just the score summary
router.get('/politician/:id/score', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT promise_score, total_promises, locked_promises,
              kept, broken, in_progress, compromised, pending,
              last_computed_at
       FROM promise_scores
       WHERE politician_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No promise score found for this politician' });
    }

    res.json({ score: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
