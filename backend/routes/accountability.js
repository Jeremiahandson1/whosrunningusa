const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const adminAuth = async (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY.length > 0) {
    const expected = Buffer.from(process.env.ADMIN_API_KEY);
    const provided = Buffer.from(String(adminKey));
    if (expected.length === provided.length && crypto.timingSafeEqual(expected, provided)) {
      return next();
    }
  }

  authenticate(req, res, (err) => {
    if (err) return res.status(401).json({ error: 'Authentication required' });
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.user_type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

router.get('/politicians/:id/gaps', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { topic, page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    let query = `
      SELECT ag.id, ag.gap_type, ag.stated_position, ag.actual_action,
             ag.supporting_vote_ids, ag.supporting_donor_ids, ag.gap_severity,
             ag.ai_analysis, ag.topic_tag, ag.verified_at, ag.published_at, ag.created_at,
             cp.display_name as politician_name, cp.party_affiliation, cp.official_title
      FROM accountability_gaps ag
      JOIN candidate_profiles cp ON ag.politician_id = cp.id
      WHERE ag.politician_id = $1 AND ag.published = true AND ag.verified = true
    `;
    const params = [id];
    let paramIndex = 2;

    if (topic) {
      query += ` AND ag.topic_tag = $${paramIndex}`;
      params.push(topic);
      paramIndex++;
    }

    const countQuery = query.replace(
      /SELECT ag\.id.*?FROM accountability_gaps/s,
      'SELECT COUNT(*) as total FROM accountability_gaps'
    );
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    query += ` ORDER BY ag.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      data: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/politicians/:id/donors', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cycle_year } = req.query;

    let query = `
      SELECT pdi.industry_name, pdi.total_amount, pdi.donor_count,
             pdi.cycle_year, pdi.source, pdi.source_url
      FROM politician_donor_industries pdi
      WHERE pdi.politician_id = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (cycle_year) {
      query += ` AND pdi.cycle_year = $${paramIndex}`;
      params.push(parseInt(cycle_year));
      paramIndex++;
    }

    query += ` ORDER BY pdi.total_amount DESC`;

    const result = await db.query(query, params);

    // CandidatePage reads .donors; keep .data as a compat alias
    res.json({ donors: result.rows, data: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/leaderboard', async (req, res, next) => {
  try {
    const { party, state, chamber, topic, sort = 'desc', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;
    const sortDir = sort === 'asc' ? 'ASC' : 'DESC';

    let query = `
      SELECT asc2.consistency_score, asc2.donor_influence_score,
             asc2.total_gaps_found, asc2.last_computed,
             cp.id as politician_id, cp.display_name, cp.party_affiliation,
             cp.official_title, cp.profile_photo_url, cp.fec_state, cp.fec_office_type
      FROM accountability_scores asc2
      JOIN candidate_profiles cp ON asc2.politician_id = cp.id
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];

    if (topic) {
      query += ` JOIN accountability_gaps ag ON ag.politician_id = cp.id AND ag.topic_tag = $${paramIndex}`;
      params.push(topic);
      paramIndex++;
    }

    if (party) {
      conditions.push(`cp.party_affiliation = $${paramIndex}`);
      params.push(party);
      paramIndex++;
    }

    if (state) {
      conditions.push(`cp.fec_state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }

    if (chamber) {
      const officeType = chamber === 'H' ? 'H' : chamber === 'S' ? 'S' : chamber;
      conditions.push(`cp.fec_office_type = $${paramIndex}`);
      params.push(officeType);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (topic) {
      query += ` GROUP BY asc2.politician_id, asc2.consistency_score, asc2.donor_influence_score,
                 asc2.total_gaps_found, asc2.last_computed,
                 cp.id, cp.display_name, cp.party_affiliation,
                 cp.official_title, cp.profile_photo_url, cp.fec_state, cp.fec_office_type`;
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    query += ` ORDER BY asc2.consistency_score ${sortDir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      data: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/mirror', async (req, res, next) => {
  try {
    const { belief, topic_tag } = req.query;

    if (!belief && !topic_tag) {
      return res.status(400).json({ error: 'Either belief or topic_tag parameter is required' });
    }

    const params = [];
    let paramIndex = 1;

    let statementCondition;
    if (belief) {
      statementCondition = `ps.statement_text ILIKE $${paramIndex}`;
      params.push(`%${belief}%`);
      paramIndex++;
    }

    let gapCondition = '';
    if (topic_tag) {
      gapCondition = ` AND ag.topic_tag = $${paramIndex}`;
      params.push(topic_tag);
      paramIndex++;
    }

    let query;
    if (belief) {
      query = `
        SELECT cp.id as politician_id, cp.display_name, cp.party_affiliation,
               cp.official_title, cp.profile_photo_url, cp.fec_state, cp.fec_office_type,
               asc2.consistency_score, asc2.donor_influence_score,
               COUNT(DISTINCT ag.id) as gap_count,
               json_agg(DISTINCT jsonb_build_object(
                 'statement', ps.statement_text,
                 'statement_date', ps.statement_date,
                 'source_url', ps.source_url
               )) as matching_statements,
               json_agg(DISTINCT jsonb_build_object(
                 'gap_type', ag.gap_type,
                 'stated_position', ag.stated_position,
                 'actual_action', ag.actual_action,
                 'gap_severity', ag.gap_severity,
                 'topic_tag', ag.topic_tag
               )) as gaps,
               json_agg(DISTINCT jsonb_build_object(
                 'industry_name', pdi.industry_name,
                 'total_amount', pdi.total_amount
               )) FILTER (WHERE pdi.industry_name IS NOT NULL) as top_donors
        FROM candidate_profiles cp
        JOIN public_statements ps ON ps.politician_id = cp.id AND ${statementCondition}
        JOIN accountability_gaps ag ON ag.politician_id = cp.id AND ag.published = true AND ag.verified = true${gapCondition}
        LEFT JOIN accountability_scores asc2 ON asc2.politician_id = cp.id
        LEFT JOIN politician_donor_industries pdi ON pdi.politician_id = cp.id
        GROUP BY cp.id, cp.display_name, cp.party_affiliation, cp.official_title,
                 cp.profile_photo_url, cp.fec_state, cp.fec_office_type,
                 asc2.consistency_score, asc2.donor_influence_score
        ORDER BY gap_count DESC
      `;
    } else {
      query = `
        SELECT cp.id as politician_id, cp.display_name, cp.party_affiliation,
               cp.official_title, cp.profile_photo_url, cp.fec_state, cp.fec_office_type,
               asc2.consistency_score, asc2.donor_influence_score,
               COUNT(DISTINCT ag.id) as gap_count,
               json_agg(DISTINCT jsonb_build_object(
                 'gap_type', ag.gap_type,
                 'stated_position', ag.stated_position,
                 'actual_action', ag.actual_action,
                 'gap_severity', ag.gap_severity,
                 'topic_tag', ag.topic_tag
               )) as gaps,
               json_agg(DISTINCT jsonb_build_object(
                 'industry_name', pdi.industry_name,
                 'total_amount', pdi.total_amount
               )) FILTER (WHERE pdi.industry_name IS NOT NULL) as top_donors
        FROM candidate_profiles cp
        JOIN accountability_gaps ag ON ag.politician_id = cp.id AND ag.published = true AND ag.verified = true${gapCondition}
        LEFT JOIN accountability_scores asc2 ON asc2.politician_id = cp.id
        LEFT JOIN politician_donor_industries pdi ON pdi.politician_id = cp.id
        GROUP BY cp.id, cp.display_name, cp.party_affiliation, cp.official_title,
                 cp.profile_photo_url, cp.fec_state, cp.fec_office_type,
                 asc2.consistency_score, asc2.donor_influence_score
        ORDER BY gap_count DESC
      `;
    }

    const result = await db.query(query, params);

    // AccountabilityMirrorPage reads data.politicians and each row's
    // top_donors — the old { data } / donor_connections shape rendered an
    // empty list even with published gaps.
    res.json({ politicians: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /accountability/admin/pending — Unpublished gaps awaiting human review
router.get('/admin/pending', adminAuth, async (req, res, next) => {
  try {
    const { page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM accountability_gaps
       WHERE published = false`
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await db.query(
      `SELECT ag.id, ag.politician_id, ag.gap_type, ag.stated_position,
              ag.actual_action, ag.gap_severity, ag.ai_analysis, ag.topic_tag,
              ag.verified, ag.verified_at, ag.created_at,
              cp.display_name as politician_name, cp.party_affiliation, cp.official_title
       FROM accountability_gaps ag
       JOIN candidate_profiles cp ON ag.politician_id = cp.id
       WHERE ag.published = false
       ORDER BY ag.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      data: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/gaps/:id/verify', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE accountability_gaps
       SET verified = true, verified_at = NOW(), verified_by = $2
       WHERE id = $1
       RETURNING *`,
      [id, req.user?.id || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gap not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/gaps/:id/publish', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const gap = await db.query('SELECT verified FROM accountability_gaps WHERE id = $1', [id]);

    if (gap.rows.length === 0) {
      return res.status(404).json({ error: 'Gap not found' });
    }

    if (!gap.rows[0].verified) {
      return res.status(400).json({ error: 'Gap must be verified before publishing' });
    }

    const result = await db.query(
      `UPDATE accountability_gaps
       SET published = true, published_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get('/politicians/:id/score', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT asc2.consistency_score, asc2.donor_influence_score,
              asc2.total_gaps_found, asc2.last_computed,
              cp.display_name, cp.party_affiliation
       FROM accountability_scores asc2
       JOIN candidate_profiles cp ON asc2.politician_id = cp.id
       WHERE asc2.politician_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Score not found for this politician' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
