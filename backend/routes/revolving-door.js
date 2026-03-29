const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /revolving-door — leaderboard of officials with post-service employment issues
router.get('/', async (req, res, next) => {
  try {
    const { state, is_lobbying, flag_type, sort = 'flags', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (state) {
      conditions.push(`cp.fec_state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }
    if (is_lobbying === 'true') {
      conditions.push(`pse.is_lobbying = true`);
    }
    if (flag_type) {
      conditions.push(`rdf.flag_type = $${paramIndex}`);
      params.push(flag_type);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'flag_count DESC';
    if (sort === 'severity') orderBy = 'max_severity DESC';
    if (sort === 'recent') orderBy = 'latest_employment DESC';

    const countQuery = `
      SELECT COUNT(DISTINCT cp.id) as total
      FROM candidate_profiles cp
      JOIN post_service_employment pse ON pse.politician_id = cp.id
      LEFT JOIN revolving_door_flags rdf ON rdf.employment_id = pse.id
      ${where}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT cp.id as politician_id, cp.display_name, cp.party_affiliation,
             cp.official_title, cp.profile_photo_url, cp.fec_state, cp.fec_office_type,
             COUNT(DISTINCT pse.id) as employment_count,
             COUNT(DISTINCT rdf.id) as flag_count,
             COALESCE(MAX(rdf.severity), 0) as max_severity,
             MAX(pse.start_date) as latest_employment,
             BOOL_OR(pse.is_lobbying) as has_lobbying,
             json_agg(DISTINCT jsonb_build_object(
               'employer', pse.employer,
               'position_title', pse.position_title,
               'industry', pse.industry,
               'start_date', pse.start_date,
               'is_lobbying', pse.is_lobbying
             )) as employments
      FROM candidate_profiles cp
      JOIN post_service_employment pse ON pse.politician_id = cp.id
      LEFT JOIN revolving_door_flags rdf ON rdf.employment_id = pse.id
      ${where}
      GROUP BY cp.id, cp.display_name, cp.party_affiliation, cp.official_title,
               cp.profile_photo_url, cp.fec_state, cp.fec_office_type
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      politicians: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /revolving-door/politicians/:id — full revolving door record for one politician
router.get('/politicians/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const politician = await db.query(
      `SELECT id, display_name, party_affiliation, official_title, profile_photo_url, fec_state
       FROM candidate_profiles WHERE id = $1`,
      [id]
    );
    if (politician.rows.length === 0) return res.status(404).json({ error: 'Politician not found' });

    const employments = await db.query(`
      SELECT pse.*,
             json_agg(jsonb_build_object(
               'id', rdf.id,
               'flag_type', rdf.flag_type,
               'description', rdf.description,
               'severity', rdf.severity,
               'related_committee', rdf.related_committee,
               'related_industry', rdf.related_industry,
               'verified', rdf.verified
             )) FILTER (WHERE rdf.id IS NOT NULL) as flags
      FROM post_service_employment pse
      LEFT JOIN revolving_door_flags rdf ON rdf.employment_id = pse.id
      WHERE pse.politician_id = $1
      GROUP BY pse.id
      ORDER BY pse.start_date DESC
    `, [id]);

    const totalFlags = employments.rows.reduce((sum, e) => sum + (e.flags ? e.flags.length : 0), 0);
    const hasViolations = employments.rows.some(e => e.flags && e.flags.some(f => f.flag_type === 'cooling_period_violation'));

    res.json({
      politician: politician.rows[0],
      employments: employments.rows,
      summary: {
        total_employments: employments.rows.length,
        total_flags: totalFlags,
        has_violations: hasViolations,
        lobbying_positions: employments.rows.filter(e => e.is_lobbying).length,
        board_positions: employments.rows.filter(e => e.is_board_position).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /revolving-door/stats — aggregate statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(DISTINCT pse.politician_id) as total_politicians,
        COUNT(DISTINCT pse.id) as total_employments,
        COUNT(DISTINCT CASE WHEN pse.is_lobbying THEN pse.id END) as lobbying_positions,
        COUNT(DISTINCT rdf.id) as total_flags,
        COUNT(DISTINCT CASE WHEN rdf.flag_type = 'cooling_period_violation' THEN rdf.id END) as cooling_violations
      FROM post_service_employment pse
      LEFT JOIN revolving_door_flags rdf ON rdf.employment_id = pse.id
    `);

    const topIndustries = await db.query(`
      SELECT pse.industry, COUNT(*) as count
      FROM post_service_employment pse
      WHERE pse.industry IS NOT NULL
      GROUP BY pse.industry
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      ...stats.rows[0],
      top_industries: topIndustries.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
