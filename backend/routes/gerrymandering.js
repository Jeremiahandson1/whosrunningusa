const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /gerrymandering/states — all state metrics for an election year
router.get('/states', async (req, res, next) => {
  try {
    const { election_year, sort = 'efficiency_gap' } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (election_year) {
      conditions.push(`gm.election_year = $${paramIndex}`);
      params.push(parseInt(election_year));
      paramIndex++;
    } else {
      conditions.push(`gm.election_year = (SELECT MAX(election_year) FROM gerrymandering_metrics)`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    let orderBy = 'ABS(gm.efficiency_gap) DESC';
    if (sort === 'seats_votes') orderBy = 'ABS(gm.seats_votes_gap) DESC';
    if (sort === 'advantage') orderBy = 'ABS(gm.partisan_advantage) DESC NULLS LAST';

    const query = `
      SELECT gm.*
      FROM gerrymandering_metrics gm
      ${where}
      ORDER BY ${orderBy}
    `;

    const result = await db.query(query, params);

    const yearResult = election_year
      ? { rows: [{ election_year: parseInt(election_year) }] }
      : await db.query(`SELECT MAX(election_year) as election_year FROM gerrymandering_metrics`);

    res.json({
      states: result.rows,
      electionYear: yearResult.rows[0]?.election_year || null
    });
  } catch (error) {
    next(error);
  }
});

// GET /gerrymandering/worst — worst gerrymandered states
router.get('/worst', async (req, res, next) => {
  try {
    const { election_year, limit = 10 } = req.query;
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit)));

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (election_year) {
      conditions.push(`gm.election_year = $${paramIndex}`);
      params.push(parseInt(election_year));
      paramIndex++;
    } else {
      conditions.push(`gm.election_year = (SELECT MAX(election_year) FROM gerrymandering_metrics)`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT gm.*
      FROM gerrymandering_metrics gm
      ${where}
      ORDER BY ABS(gm.efficiency_gap) DESC
      LIMIT $${paramIndex}
    `;
    params.push(parsedLimit);

    const result = await db.query(query, params);

    const yearResult = election_year
      ? { rows: [{ election_year: parseInt(election_year) }] }
      : await db.query(`SELECT MAX(election_year) as election_year FROM gerrymandering_metrics`);

    res.json({
      states: result.rows,
      electionYear: yearResult.rows[0]?.election_year || null
    });
  } catch (error) {
    next(error);
  }
});

// GET /gerrymandering/state/:fips — state detail with district results
router.get('/state/:fips', async (req, res, next) => {
  try {
    const { fips } = req.params;
    const { election_year } = req.query;

    const conditions = [`gm.state_fips = $1`];
    const params = [fips];
    let paramIndex = 2;

    if (election_year) {
      conditions.push(`gm.election_year = $${paramIndex}`);
      params.push(parseInt(election_year));
      paramIndex++;
    } else {
      conditions.push(`gm.election_year = (SELECT MAX(election_year) FROM gerrymandering_metrics WHERE state_fips = $1)`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const metricsResult = await db.query(
      `SELECT gm.* FROM gerrymandering_metrics gm ${where}`,
      params
    );
    if (metricsResult.rows.length === 0) {
      return res.status(404).json({ error: 'State metrics not found' });
    }
    const metrics = metricsResult.rows[0];

    const districtParams = [fips, metrics.election_year];
    const districtsResult = await db.query(
      `SELECT der.*
       FROM district_election_results der
       WHERE der.state_fips = $1 AND der.election_year = $2
       ORDER BY der.district_number`,
      districtParams
    );

    res.json({
      metrics,
      districts: districtsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
