const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// Same dual-auth as accountability.js admin routes: ADMIN_API_KEY header
// (timing-safe compare) OR a JWT belonging to an admin user.
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

// GET /conflicts — List all published conflicts
router.get('/', async (req, res, next) => {
  try {
    const { politician_id, severity, sort = 'severity', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = ['coi.published = TRUE'];
    const params = [];
    let paramIndex = 1;

    if (politician_id) {
      conditions.push(`coi.politician_id = $${paramIndex}`);
      params.push(politician_id);
      paramIndex++;
    }
    if (severity) {
      conditions.push(`coi.severity = $${paramIndex}`);
      params.push(severity);
      paramIndex++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    let orderBy = `CASE coi.severity
      WHEN 'critical' THEN 1 WHEN 'high' THEN 2
      WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END`;
    if (sort === 'date') orderBy = 'coi.trade_date DESC NULLS LAST';
    if (sort === 'amount') orderBy = 'coi.trade_amount_range_high DESC NULLS LAST';

    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM conflict_of_interest_flags coi
       ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT coi.id, coi.politician_id,
             cp.display_name as politician_name,
             cp.party_affiliation as party, cp.fec_state as state,
             coi.trade_ticker, coi.trade_asset_name, coi.trade_type,
             coi.trade_amount_range_low, coi.trade_amount_range_high,
             coi.trade_date, coi.vote_date, coi.time_gap_days,
             coi.description, coi.severity,
             b.title as bill_title
      FROM conflict_of_interest_flags coi
      JOIN candidate_profiles cp ON coi.politician_id = cp.id
      LEFT JOIN bills b ON coi.bill_id = b.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      conflicts: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// GET /conflicts/politician/:id — Conflicts for one politician
router.get('/politician/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT coi.id, coi.trade_ticker, coi.trade_asset_name, coi.trade_type,
              coi.trade_amount_range_low, coi.trade_amount_range_high,
              coi.trade_date, coi.vote_date, coi.time_gap_days,
              coi.description, coi.severity,
              b.title as bill_title
       FROM conflict_of_interest_flags coi
       LEFT JOIN bills b ON coi.bill_id = b.id
       WHERE coi.politician_id = $1 AND coi.published = TRUE
       ORDER BY coi.trade_date DESC NULLS LAST`,
      [id]
    );

    const summaryResult = await db.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE severity = 'critical') as critical,
         COUNT(*) FILTER (WHERE severity = 'high') as high,
         COUNT(*) FILTER (WHERE severity = 'medium') as medium,
         COUNT(*) FILTER (WHERE severity = 'low') as low
       FROM conflict_of_interest_flags
       WHERE politician_id = $1 AND published = TRUE`,
      [id]
    );

    const summary = summaryResult.rows[0];

    res.json({
      conflicts: result.rows,
      summary: {
        total: parseInt(summary.total),
        critical: parseInt(summary.critical),
        high: parseInt(summary.high),
        medium: parseInt(summary.medium),
        low: parseInt(summary.low)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /conflicts/stats — Aggregate statistics
router.get('/stats', async (req, res, next) => {
  try {
    const totalResult = await db.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE severity = 'critical') as critical,
         COUNT(*) FILTER (WHERE severity = 'high') as high,
         COUNT(*) FILTER (WHERE severity = 'medium') as medium,
         COUNT(*) FILTER (WHERE severity = 'low') as low,
         COUNT(DISTINCT politician_id) as officials_flagged,
         COALESCE(SUM(trade_amount_range_high), 0) as total_trade_value
       FROM conflict_of_interest_flags
       WHERE published = TRUE`
    );

    const topResult = await db.query(
      `SELECT coi.politician_id as id,
              cp.display_name, cp.party_affiliation as party,
              cp.fec_state as state,
              COUNT(*) as conflict_count
       FROM conflict_of_interest_flags coi
       JOIN candidate_profiles cp ON coi.politician_id = cp.id
       WHERE coi.published = TRUE
       GROUP BY coi.politician_id, cp.display_name, cp.party_affiliation, cp.fec_state
       ORDER BY conflict_count DESC
       LIMIT 5`
    );

    const stats = totalResult.rows[0];

    // snake_case, flat: ConflictsPage reads stats.total_conflicts,
    // stats.critical_count etc. — the camelCase/nested payload left the
    // stat tiles undefined.
    res.json({
      total_conflicts: parseInt(stats.total),
      critical_count: parseInt(stats.critical),
      high_count: parseInt(stats.high),
      medium_count: parseInt(stats.medium),
      low_count: parseInt(stats.low),
      officials_flagged: parseInt(stats.officials_flagged),
      total_trade_value: parseFloat(stats.total_trade_value) || 0,
      top_offenders: topResult.rows.map(r => ({
        ...r,
        conflict_count: parseInt(r.conflict_count)
      }))
    });
  } catch (error) {
    next(error);
  }
});

// GET /conflicts/admin/pending — Unpublished flags awaiting human review
router.get('/admin/pending', adminAuth, async (req, res, next) => {
  try {
    const { page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM conflict_of_interest_flags
       WHERE published = FALSE`
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await db.query(
      `SELECT coi.id, coi.politician_id,
              cp.display_name as politician_name,
              cp.party_affiliation as party, cp.fec_state as state,
              coi.trade_ticker, coi.trade_asset_name, coi.trade_type,
              coi.trade_amount_range_low, coi.trade_amount_range_high,
              coi.trade_date, coi.vote_date, coi.time_gap_days,
              coi.description, coi.severity, coi.ai_reasoning,
              coi.confidence, coi.verified, coi.source_url, coi.created_at,
              b.title as bill_title
       FROM conflict_of_interest_flags coi
       JOIN candidate_profiles cp ON coi.politician_id = cp.id
       LEFT JOIN bills b ON coi.bill_id = b.id
       WHERE coi.published = FALSE
       ORDER BY coi.created_at DESC
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

// POST /conflicts/admin/:id/verify — Mark a flag as human-verified
router.post('/admin/:id/verify', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE conflict_of_interest_flags
       SET verified = TRUE, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conflict flag not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /conflicts/admin/:id/publish — Publish a verified flag
router.post('/admin/:id/publish', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const flag = await db.query(
      'SELECT verified FROM conflict_of_interest_flags WHERE id = $1',
      [id]
    );

    if (flag.rows.length === 0) {
      return res.status(404).json({ error: 'Conflict flag not found' });
    }

    if (!flag.rows[0].verified) {
      return res.status(400).json({ error: 'Flag must be verified before publishing' });
    }

    const result = await db.query(
      `UPDATE conflict_of_interest_flags
       SET published = TRUE, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /conflicts/admin/:id/reject — Delete a flag that failed review
router.post('/admin/:id/reject', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM conflict_of_interest_flags WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conflict flag not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
