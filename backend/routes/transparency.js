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

    // Three small queries beat one big one. The previous single-query approach
    // used `json_agg(DISTINCT jsonb_build_object(...))` over a 3-table JOIN,
    // which Postgres has to compute per-row hashes for and was hitting the
    // 15s statement_timeout on real-sized data. Splitting into:
    //   1) per-politician aggregate (no JOIN with candidate_profiles)
    //   2) profile lookup for the 20 politicians on this page only
    //   3) requirements lookup for the same 20 politicians
    // keeps every query under a tight bound regardless of dataset size.

    const countSql = `
      SELECT COUNT(*)::int AS total FROM (
        SELECT cr.politician_id
        FROM compliance_records cr
        JOIN transparency_requirements tr ON cr.requirement_id = tr.id
        ${where}
        GROUP BY cr.politician_id
      ) t
    `;
    const countResult = await db.query(countSql, params);
    const total = countResult.rows[0].total;

    const aggParams = [...params, limit, offset];
    const aggSql = `
      WITH stats AS (
        SELECT cr.politician_id,
               AVG(cr.compliance_score)::numeric AS avg_score_raw,
               COUNT(*)::int AS total_requirements,
               COUNT(*) FILTER (WHERE cr.compliance_status = 'compliant')::int AS compliant_count,
               COUNT(*) FILTER (WHERE cr.compliance_status = 'partial')::int AS partial_count,
               COUNT(*) FILTER (WHERE cr.compliance_status = 'non_compliant')::int AS non_compliant_count
        FROM compliance_records cr
        JOIN transparency_requirements tr ON cr.requirement_id = tr.id
        ${where}
        GROUP BY cr.politician_id
      )
      SELECT cp.id AS politician_id, cp.display_name, cp.party_affiliation,
             cp.official_title, cp.profile_photo_url, cp.fec_state, cp.fec_office_type,
             ROUND(stats.avg_score_raw, 1) AS avg_score,
             stats.total_requirements, stats.compliant_count,
             stats.partial_count, stats.non_compliant_count
      FROM stats
      JOIN candidate_profiles cp ON cp.id = stats.politician_id
      ORDER BY ${orderBy === 'avg_score ASC NULLS LAST' ? 'stats.avg_score_raw ASC NULLS LAST'
              : orderBy === 'avg_score DESC NULLS LAST' ? 'stats.avg_score_raw DESC NULLS LAST'
              : 'cp.display_name ASC'}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const result = await db.query(aggSql, aggParams);

    // Pull requirements for just the politicians on this page.
    let politicians = result.rows;
    if (politicians.length > 0) {
      const ids = politicians.map(p => p.politician_id);
      const reqs = await db.query(
        `SELECT cr.politician_id, tr.requirement_type, tr.title,
                cr.compliance_status, cr.compliance_score
           FROM compliance_records cr
           JOIN transparency_requirements tr ON cr.requirement_id = tr.id
          WHERE cr.politician_id = ANY($1::uuid[])`,
        [ids]
      );
      const byPolitician = new Map();
      for (const row of reqs.rows) {
        if (!byPolitician.has(row.politician_id)) byPolitician.set(row.politician_id, []);
        byPolitician.get(row.politician_id).push({
          requirement_type: row.requirement_type,
          title: row.title,
          compliance_status: row.compliance_status,
          compliance_score: row.compliance_score,
        });
      }
      politicians = politicians.map(p => ({
        ...p,
        requirements: byPolitician.get(p.politician_id) || [],
      }));
    }

    res.json({
      politicians,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[transparency leaderboard] query failed:', error.message, error.code || '');
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
    console.error('[transparency] query failed:', error.message, error.code || '');
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
    console.error('[transparency] query failed:', error.message, error.code || '');
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
    console.error('[transparency] query failed:', error.message, error.code || '');
    next(error);
  }
});

module.exports = router;
