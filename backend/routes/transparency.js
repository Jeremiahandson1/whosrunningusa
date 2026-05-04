const express = require('express');
const router = express.Router();
const db = require('../db');

// Postgres error code 42P01 = "undefined_table". When the transparency
// migrations haven't run on a given environment, treat that as "no data
// yet" rather than a 500 — the UI then renders its empty state.
function isMissingTable(err) {
  return err && err.code === '42P01';
}

// GET /transparency — compliance leaderboard
router.get('/', async (req, res, next) => {
  try {
    const { state, requirement_type, compliance_status, sort = 'score', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    // Short-circuit when there are no compliance records at all. Avoids the
    // expensive JOIN + json_agg + DISTINCT hot path while the dataset is empty
    // (which is the entire pre-launch window).
    let fastCheck;
    try {
      fastCheck = await db.query(`SELECT 1 FROM compliance_records LIMIT 1`);
    } catch (err) {
      if (isMissingTable(err)) {
        return res.json({ politicians: [], total: 0, page: parseInt(page), totalPages: 0 });
      }
      throw err;
    }
    if (fastCheck.rows.length === 0) {
      return res.json({ politicians: [], total: 0, page: parseInt(page), totalPages: 0 });
    }

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (state) {
      conditions.push(`tr.state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }
    if (requirement_type) {
      conditions.push(`tr.requirement_type = $${paramIndex}`);
      params.push(requirement_type);
      paramIndex++;
    }
    if (compliance_status) {
      conditions.push(`cr.compliance_status = $${paramIndex}`);
      params.push(compliance_status);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'avg_score ASC NULLS LAST';
    if (sort === 'score_desc') orderBy = 'avg_score DESC NULLS LAST';
    if (sort === 'name') orderBy = 'cp.display_name ASC';

    // Driving the JOIN from compliance_records (vs candidate_profiles) keeps
    // the planner from scanning all 15k+ candidate rows when the supporting
    // tables are sparse.
    const countResult = await db.query(`
      SELECT COUNT(DISTINCT cr.politician_id) as total
      FROM compliance_records cr
      JOIN transparency_requirements tr ON cr.requirement_id = tr.id
      JOIN candidate_profiles cp ON cp.id = cr.politician_id
      ${where}
    `, params);
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT cp.id as politician_id, cp.display_name, cp.party_affiliation,
             cp.official_title, cp.profile_photo_url, cp.fec_state, cp.fec_office_type,
             ROUND(AVG(cr.compliance_score), 1) as avg_score,
             COUNT(cr.id) as total_requirements,
             COUNT(CASE WHEN cr.compliance_status = 'compliant' THEN 1 END) as compliant_count,
             COUNT(CASE WHEN cr.compliance_status = 'non_compliant' THEN 1 END) as non_compliant_count,
             COUNT(CASE WHEN cr.compliance_status = 'partial' THEN 1 END) as partial_count,
             json_agg(DISTINCT jsonb_build_object(
               'requirement_type', tr.requirement_type,
               'title', tr.title,
               'compliance_status', cr.compliance_status,
               'compliance_score', cr.compliance_score
             )) as requirements
      FROM compliance_records cr
      JOIN transparency_requirements tr ON cr.requirement_id = tr.id
      JOIN candidate_profiles cp ON cp.id = cr.politician_id
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

// GET /transparency/politicians/:id — detailed compliance for one politician
router.get('/politicians/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const politician = await db.query(
      `SELECT id, display_name, party_affiliation, official_title, profile_photo_url, fec_state
       FROM candidate_profiles WHERE id = $1`,
      [id]
    );
    if (politician.rows.length === 0) return res.status(404).json({ error: 'Politician not found' });

    const records = await db.query(`
      SELECT cr.*, tr.title as requirement_title, tr.requirement_type,
             tr.description as requirement_description, tr.jurisdiction,
             tr.jurisdiction_type, tr.statute_reference
      FROM compliance_records cr
      JOIN transparency_requirements tr ON cr.requirement_id = tr.id
      WHERE cr.politician_id = $1
      ORDER BY tr.requirement_type, tr.title
    `, [id]);

    // Group by type
    const byType = {};
    for (const r of records.rows) {
      if (!byType[r.requirement_type]) byType[r.requirement_type] = [];
      byType[r.requirement_type].push(r);
    }

    const total = records.rows.length;
    const compliant = records.rows.filter(r => r.compliance_status === 'compliant').length;
    const avgScore = records.rows.reduce((sum, r) => sum + (r.compliance_score || 0), 0) / Math.max(total, 1);

    res.json({
      politician: politician.rows[0],
      records: records.rows,
      by_type: byType,
      summary: {
        total_requirements: total,
        compliant,
        non_compliant: records.rows.filter(r => r.compliance_status === 'non_compliant').length,
        partial: records.rows.filter(r => r.compliance_status === 'partial').length,
        avg_score: Math.round(avgScore * 10) / 10,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /transparency/requirements — list all transparency requirements
router.get('/requirements', async (req, res, next) => {
  try {
    let fastCheck;
    try {
      fastCheck = await db.query(`SELECT 1 FROM transparency_requirements LIMIT 1`);
    } catch (err) {
      if (isMissingTable(err)) return res.json({ requirements: [] });
      throw err;
    }
    if (fastCheck.rows.length === 0) {
      return res.json({ requirements: [] });
    }

    const { state, type } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (state) {
      conditions.push(`state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }
    if (type) {
      conditions.push(`requirement_type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(`
      SELECT tr.*,
             COUNT(cr.id) as total_records,
             COUNT(CASE WHEN cr.compliance_status = 'compliant' THEN 1 END) as compliant_count,
             COUNT(CASE WHEN cr.compliance_status = 'non_compliant' THEN 1 END) as non_compliant_count
      FROM transparency_requirements tr
      LEFT JOIN compliance_records cr ON cr.requirement_id = tr.id
      ${where}
      GROUP BY tr.id
      ORDER BY tr.requirement_type, tr.jurisdiction
    `, params);

    res.json({ requirements: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /transparency/stats — aggregate transparency stats
router.get('/stats', async (req, res, next) => {
  try {
    // Empty-table short-circuit so a quick page load doesn't require a heavy
    // GROUP BY scan when there's nothing to aggregate.
    const emptyStats = {
      total_requirements: 0,
      total_politicians_tracked: 0,
      total_records: 0,
      avg_compliance_score: null,
      compliant_total: 0,
      non_compliant_total: 0,
      by_type: [],
    };
    let fastCheck;
    try {
      fastCheck = await db.query(`SELECT 1 FROM transparency_requirements LIMIT 1`);
    } catch (err) {
      if (isMissingTable(err)) return res.json(emptyStats);
      throw err;
    }
    if (fastCheck.rows.length === 0) {
      return res.json(emptyStats);
    }

    const stats = await db.query(`
      SELECT
        COUNT(DISTINCT tr.id) as total_requirements,
        COUNT(DISTINCT cr.politician_id) as total_politicians_tracked,
        COUNT(cr.id) as total_records,
        ROUND(AVG(cr.compliance_score), 1) as avg_compliance_score,
        COUNT(CASE WHEN cr.compliance_status = 'compliant' THEN 1 END) as compliant_total,
        COUNT(CASE WHEN cr.compliance_status = 'non_compliant' THEN 1 END) as non_compliant_total
      FROM transparency_requirements tr
      LEFT JOIN compliance_records cr ON cr.requirement_id = tr.id
    `);

    const byType = await db.query(`
      SELECT tr.requirement_type,
             COUNT(DISTINCT tr.id) as requirement_count,
             ROUND(AVG(cr.compliance_score), 1) as avg_score,
             COUNT(CASE WHEN cr.compliance_status = 'non_compliant' THEN 1 END) as non_compliant
      FROM transparency_requirements tr
      LEFT JOIN compliance_records cr ON cr.requirement_id = tr.id
      GROUP BY tr.requirement_type
      ORDER BY tr.requirement_type
    `);

    res.json({
      ...stats.rows[0],
      by_type: byType.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
