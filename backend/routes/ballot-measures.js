const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /ballot-measures — list ballot measures with funding info
router.get('/', async (req, res, next) => {
  try {
    const { state, category, election_id, status, search, sort = 'recent', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (state) {
      conditions.push(`bm.state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }
    if (category) {
      conditions.push(`bm.category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    if (election_id) {
      conditions.push(`bm.election_id = $${paramIndex}`);
      params.push(election_id);
      paramIndex++;
    }
    if (status) {
      conditions.push(`bm.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    if (search) {
      conditions.push(`bm.title ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'bm.created_at DESC';
    if (sort === 'funding') orderBy = 'total_support_funding DESC NULLS LAST';
    if (sort === 'votes') orderBy = 'bm.votes_yes DESC NULLS LAST';

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM ballot_measures bm ${where}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT bm.*,
             COALESCE(fs.total_support, 0) as total_support_funding,
             COALESCE(fo.total_oppose, 0) as total_oppose_funding,
             COALESCE(fs.support_count, 0) + COALESCE(fo.oppose_count, 0) as funder_count
      FROM ballot_measures bm
      LEFT JOIN (
        SELECT measure_id,
               SUM(amount) as total_support,
               COUNT(*) as support_count
        FROM ballot_measure_funding
        WHERE side = 'support'
        GROUP BY measure_id
      ) fs ON fs.measure_id = bm.id
      LEFT JOIN (
        SELECT measure_id,
               SUM(amount) as total_oppose,
               COUNT(*) as oppose_count
        FROM ballot_measure_funding
        WHERE side = 'oppose'
        GROUP BY measure_id
      ) fo ON fo.measure_id = bm.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      measures: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// GET /ballot-measures/:id — measure detail with funding breakdown
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const measureResult = await db.query(
      `SELECT * FROM ballot_measures WHERE id = $1`,
      [id]
    );
    if (measureResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ballot measure not found' });
    }
    const measure = measureResult.rows[0];

    const positionsResult = await db.query(
      `SELECT cmp.id, cmp.candidate_id, cmp.position, cmp.statement, cmp.source_url,
              cp.display_name, cp.party_affiliation, cp.profile_photo_url,
              cp.fec_state, cp.fec_office_type
       FROM candidate_measure_positions cmp
       JOIN candidate_profiles cp ON cmp.candidate_id = cp.id
       WHERE cmp.measure_id = $1
       ORDER BY cp.display_name`,
      [id]
    );

    const fundingResult = await db.query(
      `SELECT side, funder_type, SUM(amount) as total
       FROM ballot_measure_funding
       WHERE measure_id = $1
       GROUP BY side, funder_type
       ORDER BY side, total DESC`,
      [id]
    );

    const fundingSummary = { support: { total: 0, byType: {} }, oppose: { total: 0, byType: {} } };
    for (const row of fundingResult.rows) {
      const sideKey = row.side === 'support' ? 'support' : 'oppose';
      const amount = parseFloat(row.total);
      fundingSummary[sideKey].total += amount;
      fundingSummary[sideKey].byType[row.funder_type] = amount;
    }

    res.json({
      measure,
      positions: positionsResult.rows,
      fundingSummary
    });
  } catch (error) {
    next(error);
  }
});

// GET /ballot-measures/:id/funding — paginated funding list
router.get('/:id/funding', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { side, funder_type, sort = 'amount', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [`bmf.measure_id = $1`];
    const params = [id];
    let paramIndex = 2;

    if (side) {
      conditions.push(`bmf.side = $${paramIndex}`);
      params.push(side);
      paramIndex++;
    }
    if (funder_type) {
      conditions.push(`bmf.funder_type = $${paramIndex}`);
      params.push(funder_type);
      paramIndex++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    let orderBy = 'bmf.amount DESC';
    if (sort === 'date') orderBy = 'bmf.created_at DESC';

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM ballot_measure_funding bmf ${where}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT bmf.*
      FROM ballot_measure_funding bmf
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      funding: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
