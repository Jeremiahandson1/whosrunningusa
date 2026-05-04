const express = require('express');
const router = express.Router();
const db = require('../db');

// Postgres error code 42P01 = "undefined_table". When the transparency
// migrations haven't run on a given environment, treat that as "no data
// yet" rather than a 500 — the UI then renders its empty state.
function isMissingTable(err) {
  return err && err.code === '42P01';
}

// Tiny in-process cache for the heavy aggregation routes. Entries live for
// `ttlMs`, after which the next request recomputes. Keeps the leaderboard
// page snappy without standing up pg_cron / a materialized view.
const ROUTE_CACHE = new Map();
function cacheGet(key) {
  const entry = ROUTE_CACHE.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    ROUTE_CACHE.delete(key);
    return null;
  }
  return entry.value;
}
function cacheSet(key, value, ttlMs) {
  ROUTE_CACHE.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Run a callback against a dedicated client with the per-query timeout
// raised for this transaction only. The pool-wide statement_timeout
// protects the rest of the API; transparency aggregations need more room.
async function withExtendedTimeout(timeoutMs, fn) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

const LEADERBOARD_TTL_MS = 5 * 60 * 1000;   // 5 minutes
const STATS_TTL_MS = 10 * 60 * 1000;        // 10 minutes
const QUERY_TIMEOUT_MS = 60_000;            // per-route cap, 60s

// GET /transparency — compliance leaderboard
router.get('/', async (req, res, next) => {
  try {
    const { state, requirement_type, compliance_status, sort = 'score', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    // Short-circuit when there are no compliance records at all.
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

    const cacheKey = `leaderboard|${state || ''}|${requirement_type || ''}|${compliance_status || ''}|${sort}|${page}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

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

    const orderBy = sort === 'score_desc' ? 'stats.avg_score_raw DESC NULLS LAST'
                  : sort === 'name'       ? 'cp.display_name ASC'
                  :                         'stats.avg_score_raw ASC NULLS LAST';

    const payload = await withExtendedTimeout(QUERY_TIMEOUT_MS, async (client) => {
      const countSql = `
        SELECT COUNT(*)::int AS total FROM (
          SELECT cr.politician_id
          FROM compliance_records cr
          JOIN transparency_requirements tr ON cr.requirement_id = tr.id
          ${where}
          GROUP BY cr.politician_id
        ) t
      `;
      const countResult = await client.query(countSql, params);
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
        ORDER BY ${orderBy}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      const result = await client.query(aggSql, aggParams);

      let politicians = result.rows;
      if (politicians.length > 0) {
        const ids = politicians.map(p => p.politician_id);
        const reqs = await client.query(
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

      return {
        politicians,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit),
      };
    });

    cacheSet(cacheKey, payload, LEADERBOARD_TTL_MS);
    res.json(payload);
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

    const cached = cacheGet('stats');
    if (cached) return res.json(cached);

    // Two LEFT JOIN aggregates over the same row source. The previous
    // version made two trips through compliance_records; doing them in a
    // single CTE saves a sequential scan and keeps us under the 60s cap
    // on real-sized data.
    const payload = await withExtendedTimeout(QUERY_TIMEOUT_MS, async (client) => {
      const combined = await client.query(`
        WITH joined AS (
          SELECT tr.id AS req_id,
                 tr.requirement_type,
                 cr.id AS rec_id,
                 cr.politician_id,
                 cr.compliance_status,
                 cr.compliance_score
          FROM transparency_requirements tr
          LEFT JOIN compliance_records cr ON cr.requirement_id = tr.id
        )
        SELECT
          (SELECT COUNT(DISTINCT req_id)::int FROM joined) AS total_requirements,
          (SELECT COUNT(DISTINCT politician_id)::int FROM joined WHERE politician_id IS NOT NULL) AS total_politicians_tracked,
          (SELECT COUNT(rec_id)::int FROM joined WHERE rec_id IS NOT NULL) AS total_records,
          (SELECT ROUND(AVG(compliance_score), 1) FROM joined WHERE compliance_score IS NOT NULL) AS avg_compliance_score,
          (SELECT COUNT(*)::int FROM joined WHERE compliance_status = 'compliant') AS compliant_total,
          (SELECT COUNT(*)::int FROM joined WHERE compliance_status = 'non_compliant') AS non_compliant_total
      `);

      const byType = await client.query(`
        SELECT tr.requirement_type,
               COUNT(DISTINCT tr.id)::int AS requirement_count,
               ROUND(AVG(cr.compliance_score), 1) AS avg_score,
               COUNT(*) FILTER (WHERE cr.compliance_status = 'non_compliant')::int AS non_compliant
        FROM transparency_requirements tr
        LEFT JOIN compliance_records cr ON cr.requirement_id = tr.id
        GROUP BY tr.requirement_type
        ORDER BY tr.requirement_type
      `);

      return { ...combined.rows[0], by_type: byType.rows };
    });

    cacheSet('stats', payload, STATS_TTL_MS);
    res.json(payload);
  } catch (error) {
    console.error('[transparency] query failed:', error.message, error.code || '');
    next(error);
  }
});

module.exports = router;
