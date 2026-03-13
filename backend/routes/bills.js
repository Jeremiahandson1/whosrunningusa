const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/bills
 * List bills with filters
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      state,
      session,
      chamber,
      status,
      search,
      limit = 20,
      offset = 0
    } = req.query;

    let query = `
      SELECT 
        b.*,
        (SELECT COUNT(*) FROM vote_events WHERE bill_id = b.id) as vote_count,
        (SELECT COUNT(*) FROM bill_sponsorships WHERE bill_id = b.id) as sponsor_count
      FROM bills b
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (state) {
      query += ` AND b.state = $${paramIndex}`;
      params.push(state.toUpperCase());
      paramIndex++;
    }

    if (session) {
      query += ` AND b.session = $${paramIndex}`;
      params.push(session);
      paramIndex++;
    }

    if (chamber) {
      query += ` AND b.chamber = $${paramIndex}`;
      params.push(chamber.toLowerCase());
      paramIndex++;
    }

    if (status) {
      query += ` AND b.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND (b.title ILIKE $${paramIndex} OR b.bill_number ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY b.last_action_date DESC NULLS LAST, b.introduced_date DESC
               LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM bills b WHERE 1=1`;
    const countParams = [];
    let countParamIndex = 1;

    if (state) {
      countQuery += ` AND b.state = $${countParamIndex}`;
      countParams.push(state.toUpperCase());
      countParamIndex++;
    }
    if (session) {
      countQuery += ` AND b.session = $${countParamIndex}`;
      countParams.push(session);
      countParamIndex++;
    }
    if (chamber) {
      countQuery += ` AND b.chamber = $${countParamIndex}`;
      countParams.push(chamber.toLowerCase());
      countParamIndex++;
    }
    if (status) {
      countQuery += ` AND b.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }
    if (search) {
      countQuery += ` AND (b.title ILIKE $${countParamIndex} OR b.bill_number ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      bills: result.rows,
      total: parseInt(countResult.rows[0]?.count || 0),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bills/:id
 * Get single bill with votes and sponsors
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get bill
    const billResult = await db.query(
      `SELECT * FROM bills WHERE id = $1`,
      [id]
    );

    if (billResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const bill = billResult.rows[0];

    // Get vote events
    const votesResult = await db.query(
      `SELECT 
        ve.*,
        (SELECT COUNT(*) FROM voting_records WHERE external_vote_id = ve.external_id) as recorded_votes
       FROM vote_events ve
       WHERE ve.bill_id = $1
       ORDER BY ve.vote_date DESC`,
      [id]
    );

    // Get sponsors
    const sponsorsResult = await db.query(
      `SELECT 
        bs.*,
        cp.display_name,
        cp.party_affiliation,
        cp.official_title
       FROM bill_sponsorships bs
       JOIN candidate_profiles cp ON bs.candidate_id = cp.id
       WHERE bs.bill_id = $1
       ORDER BY bs.sponsorship_type, cp.display_name`,
      [id]
    );

    res.json({
      ...bill,
      votes: votesResult.rows,
      sponsors: sponsorsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bills/:id/votes
 * Get all individual votes on a bill
 */
router.get('/:id/votes', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { voteEventId } = req.query;

    let query = `
      SELECT 
        vr.*,
        cp.display_name,
        cp.party_affiliation,
        cp.official_title
      FROM voting_records vr
      JOIN candidate_profiles cp ON vr.candidate_id = cp.id
      WHERE vr.bill_id = $1
    `;
    const params = [id];

    if (voteEventId) {
      query += ` AND vr.external_vote_id = $2`;
      params.push(voteEventId);
    }

    query += ` ORDER BY vr.vote, cp.party_affiliation, cp.display_name`;

    const result = await db.query(query, params);

    // Group by vote
    const grouped = {
      yes: result.rows.filter(r => r.vote === 'yes'),
      no: result.rows.filter(r => r.vote === 'no'),
      not_voting: result.rows.filter(r => r.vote === 'not voting' || r.vote === 'absent'),
      other: result.rows.filter(r => !['yes', 'no', 'not voting', 'absent'].includes(r.vote))
    };

    res.json({
      votes: result.rows,
      grouped,
      summary: {
        yes: grouped.yes.length,
        no: grouped.no.length,
        not_voting: grouped.not_voting.length,
        other: grouped.other.length,
        total: result.rows.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bills/state/:state/recent
 * Get recent bills for a state
 */
router.get('/state/:state/recent', async (req, res, next) => {
  try {
    const { state } = req.params;
    const { limit = 10 } = req.query;

    const result = await db.query(
      `SELECT 
        b.*,
        (SELECT COUNT(*) FROM vote_events WHERE bill_id = b.id) as vote_count
       FROM bills b
       WHERE b.state = $1
       ORDER BY b.last_action_date DESC NULLS LAST
       LIMIT $2`,
      [state.toUpperCase(), parseInt(limit)]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bills/stats
 * Get bill statistics
 */
router.get('/stats/summary', async (req, res, next) => {
  try {
    const { state } = req.query;

    let whereClause = '';
    const params = [];

    if (state) {
      whereClause = 'WHERE state = $1';
      params.push(state.toUpperCase());
    }

    const result = await db.query(`
      SELECT 
        COUNT(*) as total_bills,
        COUNT(DISTINCT state) as states_covered,
        COUNT(DISTINCT session) as sessions,
        COUNT(*) FILTER (WHERE status = 'passed') as passed,
        COUNT(*) FILTER (WHERE status = 'signed') as signed,
        COUNT(*) FILTER (WHERE status = 'vetoed') as vetoed,
        COUNT(*) FILTER (WHERE status = 'introduced') as introduced,
        (SELECT COUNT(*) FROM vote_events ${state ? 'WHERE bill_id IN (SELECT id FROM bills WHERE state = $1)' : ''}) as total_vote_events,
        (SELECT COUNT(*) FROM voting_records ${state ? "WHERE source = 'open_states'" : ''}) as total_voting_records
      FROM bills
      ${whereClause}
    `, params);

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;