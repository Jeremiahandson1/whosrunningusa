const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /gerrymandering/states (and root alias) — all state metrics for an election year
const statesHandler = async (req, res) => {
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
    console.warn('/gerrymandering states fallback:', error.message);
    res.json({ states: [], electionYear: null });
  }
};
router.get('/states', statesHandler);
router.get('/', statesHandler);

// GET /gerrymandering/stats — aggregate metrics
router.get('/stats', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT
        COUNT(DISTINCT state_fips)::int AS states_tracked,
        COALESCE(ROUND(AVG(ABS(efficiency_gap))::numeric, 2), 0) AS avg_efficiency_gap,
        MAX(election_year)::int AS latest_year
      FROM gerrymandering_metrics
    `);
    const row = r.rows[0];
    res.json({
      statesTracked: row.states_tracked,
      avgEfficiencyGap: parseFloat(row.avg_efficiency_gap),
      latestYear: row.latest_year,
    });
  } catch (error) {
    console.warn('/gerrymandering/stats fallback:', error.message);
    res.json({ statesTracked: 0, avgEfficiencyGap: 0, latestYear: null });
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

// GET /gerrymandering/:stateAbbr — state detail by 2-letter state abbreviation
router.get('/:stateAbbr', async (req, res, next) => {
  const raw = req.params.stateAbbr;
  if (!/^[A-Za-z]{2}$/.test(raw)) return next();
  try {
    const stateAbbr = raw.toUpperCase();
    const { election_year } = req.query;

    const conditions = ['gm.state_abbr = $1'];
    const params = [stateAbbr];
    let paramIndex = 2;

    if (election_year) {
      conditions.push(`gm.election_year = $${paramIndex}`);
      params.push(parseInt(election_year));
      paramIndex++;
    } else {
      conditions.push(`gm.election_year = (SELECT MAX(election_year) FROM gerrymandering_metrics WHERE state_abbr = $1)`);
    }

    const metricsResult = await db.query(
      `SELECT gm.* FROM gerrymandering_metrics gm WHERE ${conditions.join(' AND ')}`,
      params
    );
    if (metricsResult.rows.length === 0) {
      return res.json({ metrics: null, districts: [] });
    }
    const metrics = metricsResult.rows[0];

    const districtsResult = await db.query(
      `SELECT der.*
       FROM district_election_results der
       WHERE der.state_fips = $1 AND der.election_year = $2
       ORDER BY der.district_number`,
      [metrics.state_fips, metrics.election_year]
    ).catch(() => ({ rows: [] }));

    res.json({ metrics, districts: districtsResult.rows });
  } catch (error) {
    console.warn('/gerrymandering/:stateAbbr fallback:', error.message);
    res.json({ metrics: null, districts: [] });
  }
});

// GET /gerrymandering/state/:fips — state detail by FIPS code
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
