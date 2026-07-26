const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /finance-map/politicians/:id — donor-to-vote connections for one politician
router.get('/politicians/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { correlation_type, industry } = req.query;

    const politician = await db.query(
      `SELECT id, display_name, party_affiliation, official_title, profile_photo_url, fec_state
       FROM candidate_profiles WHERE id = $1`,
      [id]
    );
    if (politician.rows.length === 0) return res.status(404).json({ error: 'Politician not found' });

    const conditions = ['dvc.politician_id = $1'];
    const params = [id];
    let paramIndex = 2;

    if (correlation_type) {
      conditions.push(`dvc.correlation_type = $${paramIndex}`);
      params.push(correlation_type);
      paramIndex++;
    }
    if (industry) {
      conditions.push(`dvc.industry_name ILIKE $${paramIndex}`);
      params.push(`%${industry}%`);
      paramIndex++;
    }

    const connections = await db.query(`
      SELECT dvc.*,
             ve.vote_date, ve.motion_text as vote_question, ve.result as vote_result,
             b.title as bill_title, b.bill_number,
             pdi.total_amount as industry_total, pdi.donor_count
      FROM donor_vote_connections dvc
      LEFT JOIN vote_events ve ON dvc.vote_event_id = ve.id
      LEFT JOIN bills b ON dvc.bill_id = b.id
      LEFT JOIN politician_donor_industries pdi ON dvc.donor_industry_id = pdi.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY dvc.donation_total DESC NULLS LAST
    `, params);

    // Donor industries summary
    const donors = await db.query(`
      SELECT industry_name, total_amount, donor_count, cycle_year
      FROM politician_donor_industries
      WHERE politician_id = $1
      ORDER BY total_amount DESC
    `, [id]);

    // Correlation summary
    const summary = await db.query(`
      SELECT correlation_type, COUNT(*) as count
      FROM donor_vote_connections
      WHERE politician_id = $1
      GROUP BY correlation_type
    `, [id]);

    const summaryMap = {};
    summary.rows.forEach(r => { summaryMap[r.correlation_type] = parseInt(r.count); });

    res.json({
      politician: politician.rows[0],
      connections: connections.rows,
      donors: donors.rows,
      summary: {
        aligned: summaryMap.aligned || 0,
        contradicted: summaryMap.contradicted || 0,
        neutral: summaryMap.neutral || 0,
        total_connections: connections.rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /finance-map/search — search donor-vote connections across all politicians
router.get('/search', async (req, res, next) => {
  try {
    const { industry, bill, correlation_type, page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (industry) {
      conditions.push(`dvc.industry_name ILIKE $${paramIndex}`);
      params.push(`%${industry}%`);
      paramIndex++;
    }
    if (bill) {
      conditions.push(`(b.title ILIKE $${paramIndex} OR b.bill_number ILIKE $${paramIndex})`);
      params.push(`%${bill}%`);
      paramIndex++;
    }
    if (correlation_type) {
      conditions.push(`dvc.correlation_type = $${paramIndex}`);
      params.push(correlation_type);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM donor_vote_connections dvc
      LEFT JOIN bills b ON dvc.bill_id = b.id
      ${where}
    `, params);
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT dvc.id, dvc.industry_name, dvc.donation_total, dvc.vote_cast,
             dvc.correlation_type, dvc.description, dvc.confidence_score,
             cp.id as politician_id, cp.display_name, cp.party_affiliation,
             cp.profile_photo_url, cp.fec_state,
             b.title as bill_title, b.bill_number,
             ve.vote_date
      FROM donor_vote_connections dvc
      JOIN candidate_profiles cp ON dvc.politician_id = cp.id
      LEFT JOIN bills b ON dvc.bill_id = b.id
      LEFT JOIN vote_events ve ON dvc.vote_event_id = ve.id
      ${where}
      ORDER BY dvc.donation_total DESC NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      connections: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /finance-map/vote-explanations/:voteEventId — plain language explanation for a vote
router.get('/vote-explanations/:voteEventId', async (req, res, next) => {
  try {
    const { voteEventId } = req.params;

    const result = await db.query(`
      SELECT ve.*, b.title as bill_title, b.bill_number, b.summary as bill_summary
      FROM vote_explanations ve
      LEFT JOIN bills b ON ve.bill_id = b.id
      WHERE ve.vote_event_id = $1
    `, [voteEventId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No explanation found for this vote' });
    }

    res.json({ explanation: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /finance-map/bill-explanations/:billId — plain language explanation for a bill
router.get('/bill-explanations/:billId', async (req, res, next) => {
  try {
    const { billId } = req.params;

    const result = await db.query(`
      SELECT ve.*
      FROM vote_explanations ve
      WHERE ve.bill_id = $1
    `, [billId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No explanation found for this bill' });
    }

    res.json({ explanation: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
