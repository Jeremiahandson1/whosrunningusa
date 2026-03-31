const express = require('express');
const router = express.Router();
const db = require('../db');

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
         COUNT(*) FILTER (WHERE severity = 'low') as low
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

    res.json({
      totalConflicts: parseInt(stats.total),
      bySeverity: {
        critical: parseInt(stats.critical),
        high: parseInt(stats.high),
        medium: parseInt(stats.medium),
        low: parseInt(stats.low)
      },
      topOffenders: topResult.rows.map(r => ({
        ...r,
        conflict_count: parseInt(r.conflict_count)
      }))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
