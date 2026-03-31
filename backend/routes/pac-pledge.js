const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /pac-pledge/list — all pledges with filters
router.get('/list', async (req, res, next) => {
  try {
    const { status = 'all', party, state, page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status === 'active') {
      conditions.push(`pp.is_active = true`);
    } else if (status === 'violated') {
      conditions.push(`pp.violation_detected = true`);
    } else if (status === 'kept') {
      conditions.push(`pp.is_active = true AND pp.violation_detected = false`);
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

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM pac_pledges pp
       JOIN candidate_profiles cp ON pp.candidate_id = cp.id
       ${where}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT pp.*, cp.display_name, cp.party_affiliation,
             cp.profile_photo_url, cp.fec_state, cp.fec_office_type
      FROM pac_pledges pp
      JOIN candidate_profiles cp ON pp.candidate_id = cp.id
      ${where}
      ORDER BY pp.pledge_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      pledges: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// GET /pac-pledge/stats — summary statistics
router.get('/stats', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_pledged,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE violation_detected = true) as violated,
        COUNT(*) FILTER (WHERE is_active = true AND violation_detected = false) as kept,
        COALESCE(SUM(violation_amount) FILTER (WHERE violation_detected = true), 0) as violation_total
      FROM pac_pledges
    `);

    const row = result.rows[0];
    res.json({
      totalPledged: parseInt(row.total_pledged),
      active: parseInt(row.active),
      violated: parseInt(row.violated),
      kept: parseInt(row.kept),
      violationTotal: parseFloat(row.violation_total)
    });
  } catch (error) {
    next(error);
  }
});

// GET /pac-pledge/candidate/:id — pledge status for one candidate
router.get('/candidate/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const pledgeResult = await db.query(
      `SELECT * FROM pac_pledges WHERE candidate_id = $1`, [id]
    );
    const pledge = pledgeResult.rows[0] || null;

    // Fetch PAC contribution context from campaign_finance_summaries
    const financeResult = await db.query(
      `SELECT pac_contributions, total_raised
       FROM campaign_finance_summaries
       WHERE candidate_id = $1
       ORDER BY cycle DESC
       LIMIT 1`,
      [id]
    );

    let financeContext = { pac_contributions: 0, total_raised: 0, pac_pct: 0 };
    if (financeResult.rows.length > 0) {
      const f = financeResult.rows[0];
      const pacContrib = parseFloat(f.pac_contributions) || 0;
      const totalRaised = parseFloat(f.total_raised) || 0;
      financeContext = {
        pac_contributions: pacContrib,
        total_raised: totalRaised,
        pac_pct: totalRaised > 0 ? Math.round((pacContrib / totalRaised) * 10000) / 100 : 0
      };
    }

    res.json({ pledge, financeContext });
  } catch (error) {
    next(error);
  }
});

// POST /pac-pledge — record a new pledge (admin only)
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { candidate_id, pledge_date, pledge_text, pledge_source_url } = req.body;

    if (!candidate_id || !pledge_date || !pledge_text) {
      return res.status(400).json({ error: 'candidate_id, pledge_date, and pledge_text are required' });
    }

    const result = await db.query(
      `INSERT INTO pac_pledges (candidate_id, pledge_date, pledge_text, pledge_source_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [candidate_id, pledge_date, pledge_text, pledge_source_url || null]
    );

    res.status(201).json({ pledge: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
