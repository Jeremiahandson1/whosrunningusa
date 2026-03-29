const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /trades — list official stock trades with filters
router.get('/', async (req, res, next) => {
  try {
    const { politician_id, ticker, trade_type, flagged_only, sort = 'date', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (politician_id) {
      conditions.push(`ot.politician_id = $${paramIndex}`);
      params.push(politician_id);
      paramIndex++;
    }
    if (ticker) {
      conditions.push(`ot.ticker ILIKE $${paramIndex}`);
      params.push(ticker);
      paramIndex++;
    }
    if (trade_type) {
      conditions.push(`ot.trade_type = $${paramIndex}`);
      params.push(trade_type);
      paramIndex++;
    }
    if (flagged_only === 'true') {
      conditions.push(`EXISTS (SELECT 1 FROM trade_flags tf WHERE tf.trade_id = ot.id)`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'ot.trade_date DESC';
    if (sort === 'amount') orderBy = 'ot.amount_range_high DESC NULLS LAST';
    if (sort === 'disclosure_delay') orderBy = 'ot.days_to_disclose DESC NULLS LAST';
    if (sort === 'flags') orderBy = 'flag_count DESC';

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM official_trades ot ${where}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT ot.id, ot.politician_id, ot.filer_name, ot.ticker, ot.asset_name,
             ot.trade_type, ot.amount_range_low, ot.amount_range_high,
             ot.trade_date, ot.disclosure_date, ot.days_to_disclose,
             ot.committee_assignments, ot.source_url,
             cp.display_name, cp.party_affiliation, cp.profile_photo_url,
             cp.fec_state, cp.fec_office_type,
             COUNT(tf.id) as flag_count,
             COALESCE(MAX(tf.severity), 0) as max_flag_severity,
             json_agg(DISTINCT jsonb_build_object(
               'flag_type', tf.flag_type,
               'description', tf.description,
               'severity', tf.severity,
               'related_committee', tf.related_committee
             )) FILTER (WHERE tf.id IS NOT NULL) as flags
      FROM official_trades ot
      JOIN candidate_profiles cp ON ot.politician_id = cp.id
      LEFT JOIN trade_flags tf ON tf.trade_id = ot.id
      ${where}
      GROUP BY ot.id, ot.politician_id, ot.filer_name, ot.ticker, ot.asset_name,
               ot.trade_type, ot.amount_range_low, ot.amount_range_high,
               ot.trade_date, ot.disclosure_date, ot.days_to_disclose,
               ot.committee_assignments, ot.source_url,
               cp.display_name, cp.party_affiliation, cp.profile_photo_url,
               cp.fec_state, cp.fec_office_type
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      trades: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /trades/politicians/:id — trades for a specific politician
router.get('/politicians/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const politician = await db.query(
      `SELECT id, display_name, party_affiliation, official_title, profile_photo_url,
              fec_state, fec_office_type
       FROM candidate_profiles WHERE id = $1`,
      [id]
    );
    if (politician.rows.length === 0) return res.status(404).json({ error: 'Politician not found' });

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM official_trades WHERE politician_id = $1', [id]
    );
    const total = parseInt(countResult.rows[0].total);

    const trades = await db.query(`
      SELECT ot.*,
             json_agg(jsonb_build_object(
               'id', tf.id, 'flag_type', tf.flag_type,
               'description', tf.description, 'severity', tf.severity,
               'related_committee', tf.related_committee,
               'related_event_description', tf.related_event_description,
               'event_date', tf.event_date
             )) FILTER (WHERE tf.id IS NOT NULL) as flags
      FROM official_trades ot
      LEFT JOIN trade_flags tf ON tf.trade_id = ot.id
      WHERE ot.politician_id = $1
      GROUP BY ot.id
      ORDER BY ot.trade_date DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    // Summary stats
    const summary = await db.query(`
      SELECT
        COUNT(*) as total_trades,
        COUNT(DISTINCT ot.ticker) as unique_tickers,
        SUM(CASE WHEN ot.trade_type = 'purchase' THEN 1 ELSE 0 END) as purchases,
        SUM(CASE WHEN ot.trade_type = 'sale' THEN 1 ELSE 0 END) as sales,
        AVG(ot.days_to_disclose) as avg_disclosure_delay,
        (SELECT COUNT(*) FROM trade_flags tf2
         JOIN official_trades ot2 ON tf2.trade_id = ot2.id
         WHERE ot2.politician_id = $1) as total_flags
      FROM official_trades ot
      WHERE ot.politician_id = $1
    `, [id]);

    // Top traded tickers
    const topTickers = await db.query(`
      SELECT ticker, COUNT(*) as trade_count,
             SUM(CASE WHEN trade_type = 'purchase' THEN 1 ELSE 0 END) as buys,
             SUM(CASE WHEN trade_type = 'sale' THEN 1 ELSE 0 END) as sells
      FROM official_trades
      WHERE politician_id = $1 AND ticker IS NOT NULL
      GROUP BY ticker
      ORDER BY trade_count DESC
      LIMIT 10
    `, [id]);

    res.json({
      politician: politician.rows[0],
      trades: trades.rows,
      summary: summary.rows[0],
      top_tickers: topTickers.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /trades/flagged — only flagged trades, sorted by severity
router.get('/flagged', async (req, res, next) => {
  try {
    const { flag_type, page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    let flagCondition = '';
    const params = [];
    let paramIndex = 1;

    if (flag_type) {
      flagCondition = `AND tf.flag_type = $${paramIndex}`;
      params.push(flag_type);
      paramIndex++;
    }

    const countResult = await db.query(`
      SELECT COUNT(DISTINCT ot.id) as total
      FROM official_trades ot
      JOIN trade_flags tf ON tf.trade_id = ot.id ${flagCondition}
    `, params);
    const total = parseInt(countResult.rows[0].total);

    const result = await db.query(`
      SELECT ot.id, ot.ticker, ot.asset_name, ot.trade_type,
             ot.amount_range_low, ot.amount_range_high,
             ot.trade_date, ot.disclosure_date, ot.days_to_disclose,
             cp.display_name, cp.party_affiliation, cp.profile_photo_url,
             cp.fec_state, cp.fec_office_type, cp.id as politician_id,
             MAX(tf.severity) as max_severity,
             json_agg(DISTINCT jsonb_build_object(
               'flag_type', tf.flag_type,
               'description', tf.description,
               'severity', tf.severity,
               'related_event_description', tf.related_event_description,
               'event_date', tf.event_date
             )) as flags
      FROM official_trades ot
      JOIN trade_flags tf ON tf.trade_id = ot.id ${flagCondition}
      JOIN candidate_profiles cp ON ot.politician_id = cp.id
      GROUP BY ot.id, ot.ticker, ot.asset_name, ot.trade_type,
               ot.amount_range_low, ot.amount_range_high,
               ot.trade_date, ot.disclosure_date, ot.days_to_disclose,
               cp.display_name, cp.party_affiliation, cp.profile_photo_url,
               cp.fec_state, cp.fec_office_type, cp.id
      ORDER BY max_severity DESC, ot.trade_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    res.json({
      trades: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /trades/stats — aggregate trading statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_trades,
        COUNT(DISTINCT politician_id) as total_politicians,
        COUNT(DISTINCT ticker) as unique_tickers,
        AVG(days_to_disclose) as avg_disclosure_delay,
        (SELECT COUNT(*) FROM trade_flags) as total_flags,
        (SELECT COUNT(*) FROM trade_flags WHERE flag_type = 'timing_suspicious') as suspicious_timing,
        (SELECT COUNT(*) FROM trade_flags WHERE flag_type = 'late_disclosure') as late_disclosures
      FROM official_trades
    `);

    const topTraders = await db.query(`
      SELECT cp.id as politician_id, cp.display_name, cp.party_affiliation,
             cp.fec_state, cp.profile_photo_url,
             COUNT(ot.id) as trade_count,
             (SELECT COUNT(*) FROM trade_flags tf JOIN official_trades ot2 ON tf.trade_id = ot2.id WHERE ot2.politician_id = cp.id) as flag_count
      FROM official_trades ot
      JOIN candidate_profiles cp ON ot.politician_id = cp.id
      GROUP BY cp.id, cp.display_name, cp.party_affiliation, cp.fec_state, cp.profile_photo_url
      ORDER BY trade_count DESC
      LIMIT 10
    `);

    res.json({
      ...stats.rows[0],
      top_traders: topTraders.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
