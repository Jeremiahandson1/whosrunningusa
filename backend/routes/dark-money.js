const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /dark-money — candidates ranked by dark money exposure
router.get('/', async (req, res, next) => {
  try {
    const { party, office, state, cycle = '2026', sort = 'unaccounted', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = ['dms.cycle_year = $1'];
    const params = [cycle];
    let paramIndex = 2;

    if (party) {
      conditions.push(`cp.party_affiliation = $${paramIndex}`);
      params.push(party);
      paramIndex++;
    }
    // candidate_profiles has no office_level column — federal candidates are
    // the ones with an FEC office type (H/S/P); everyone else is state-level.
    if (office === 'federal') {
      conditions.push(`cp.fec_office_type IS NOT NULL`);
    } else if (office === 'state') {
      conditions.push(`cp.fec_office_type IS NULL`);
    }
    if (state) {
      conditions.push(`cp.fec_state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    let orderBy = 'dms.unaccounted_amount DESC NULLS LAST';
    if (sort === 'percentage') orderBy = 'dms.dark_money_percentage DESC NULLS LAST';
    if (sort === 'total') orderBy = 'dms.total_outside_spending DESC NULLS LAST';

    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM dark_money_summaries dms
       JOIN candidate_profiles cp ON dms.candidate_id = cp.id
       ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT cp.id, cp.display_name, cp.party_affiliation as party,
             cp.fec_state as state,
             CASE WHEN cp.fec_office_type IS NOT NULL THEN 'federal' ELSE 'state' END as office_level,
             dms.total_outside_spending, dms.disclosed_amount,
             dms.unaccounted_amount, dms.dark_money_percentage,
             dms.c4_group_count, dms.c4_total_spent
      FROM dark_money_summaries dms
      JOIN candidate_profiles cp ON dms.candidate_id = cp.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      candidates: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.warn('/dark-money fallback:', error.message);
    res.json({ candidates: [], total: 0, page: parseInt(req.query.page || 1), totalPages: 0 });
  }
});

// GET /dark-money/stats — aggregate dark money statistics
const EMPTY_DARK_MONEY_STATS = {
  totalOutsideSpending: 0,
  totalUnaccounted: 0,
  candidatesTracked: 0,
  avgDarkMoneyPct: 0,
  topGroups: [],
};
router.get('/stats', async (req, res) => {
  try {
    const cycle = req.query.cycle || '2026';

    const summaryResult = await db.query(
      `SELECT COALESCE(SUM(total_outside_spending), 0) as total_outside_spending,
              COALESCE(SUM(unaccounted_amount), 0) as total_unaccounted,
              COUNT(*) as candidates_tracked,
              COALESCE(ROUND(AVG(dark_money_percentage), 2), 0) as avg_dark_money_pct
       FROM dark_money_summaries
       WHERE cycle_year = $1`,
      [cycle]
    );

    const topGroupsResult = await db.query(
      `SELECT id, name, is_501c4, total_spent, donor_disclosure_percentage
       FROM outside_spending_groups
       WHERE cycle_year = $1
       ORDER BY total_spent DESC NULLS LAST
       LIMIT 5`,
      [cycle]
    );

    const stats = summaryResult.rows[0];

    res.json({
      totalOutsideSpending: stats.total_outside_spending,
      totalUnaccounted: stats.total_unaccounted,
      candidatesTracked: parseInt(stats.candidates_tracked),
      avgDarkMoneyPct: parseFloat(stats.avg_dark_money_pct),
      topGroups: topGroupsResult.rows,
    });
  } catch (error) {
    console.warn('/dark-money/stats fallback:', error.message);
    res.json(EMPTY_DARK_MONEY_STATS);
  }
});

// GET /dark-money/candidates/:id — detailed dark money breakdown for one candidate
router.get('/candidates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const candidateResult = await db.query(
      `SELECT cp.id, cp.display_name, cp.party_affiliation as party,
              cp.fec_state as state,
              CASE WHEN cp.fec_office_type IS NOT NULL THEN 'federal' ELSE 'state' END as office_level,
              cp.profile_photo_url
       FROM candidate_profiles cp
       WHERE cp.id = $1`,
      [id]
    );

    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const summaryResult = await db.query(
      `SELECT cycle_year as cycle, total_outside_spending, disclosed_amount,
              unaccounted_amount, dark_money_percentage,
              c4_group_count, c4_total_spent
       FROM dark_money_summaries
       WHERE candidate_id = $1
       ORDER BY cycle_year DESC`,
      [id]
    );

    const transactionsResult = await db.query(
      `SELECT ost.id as transaction_id, ost.amount,
              ost.expenditure_description as purpose, ost.support_oppose,
              ost.expenditure_date as filing_date, ost.cycle_year as cycle,
              osg.id as group_id, osg.name as group_name, osg.is_501c4,
              osg.total_spent as group_total_spent,
              osg.donor_disclosure_percentage
       FROM outside_spending_transactions ost
       JOIN outside_spending_groups osg ON ost.group_id = osg.id
       WHERE ost.candidate_id = $1
       ORDER BY osg.total_spent DESC NULLS LAST, ost.expenditure_date DESC`,
      [id]
    );

    // Group transactions by spending group
    const groupMap = new Map();
    for (const tx of transactionsResult.rows) {
      const key = tx.group_id;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          name: tx.group_name,
          is_501c4: tx.is_501c4,
          total_spent: tx.group_total_spent,
          donor_disclosure_percentage: tx.donor_disclosure_percentage,
          transactions: [],
        });
      }
      groupMap.get(key).transactions.push({
        id: tx.transaction_id,
        amount: tx.amount,
        purpose: tx.purpose,
        support_oppose: tx.support_oppose,
        filing_date: tx.filing_date,
        cycle: tx.cycle,
      });
    }

    res.json({
      candidate: candidateResult.rows[0],
      summary: summaryResult.rows,
      groups: Array.from(groupMap.values()),
    });
  } catch (error) {
    next(error);
  }
});

// GET /dark-money/groups — outside spending groups ranked
router.get('/groups', async (req, res, next) => {
  try {
    const { is_501c4, cycle, sort = 'spent', search, page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (is_501c4 !== undefined) {
      conditions.push(`osg.is_501c4 = $${paramIndex}`);
      params.push(is_501c4 === 'true');
      paramIndex++;
    }
    if (cycle) {
      conditions.push(`osg.cycle_year = $${paramIndex}`);
      params.push(cycle);
      paramIndex++;
    }
    if (search) {
      conditions.push(`osg.name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'osg.total_spent DESC NULLS LAST';
    if (sort === 'disclosure') orderBy = 'osg.donor_disclosure_percentage ASC NULLS LAST';

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM outside_spending_groups osg ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT osg.id, osg.name, osg.is_501c4, osg.total_spent,
             osg.donor_disclosure_percentage, osg.cycle_year as cycle,
             COUNT(DISTINCT ost.candidate_id) as candidates_targeted
      FROM outside_spending_groups osg
      LEFT JOIN outside_spending_transactions ost ON ost.group_id = osg.id
      ${where}
      GROUP BY osg.id, osg.name, osg.is_501c4, osg.total_spent,
               osg.donor_disclosure_percentage, osg.cycle_year
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      groups: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
