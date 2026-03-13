const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

// Get all elections with filters
router.get('/', async (req, res, next) => {
  try {
    const { state, upcoming, limit = 20, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM elections WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (state) {
      query += ` AND state = $${paramIndex}`;
      params.push(state);
      paramIndex++;
    }
    
    if (upcoming === 'true') {
      query += ` AND election_date >= CURRENT_DATE`;
    }
    
    query += ` ORDER BY election_date ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    res.json({ elections: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get single election with races
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const electionResult = await db.query('SELECT * FROM elections WHERE id = $1', [id]);
    
    if (electionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Election not found' });
    }
    
    const election = electionResult.rows[0];
    
    // Get races
    const racesResult = await db.query(
      `SELECT r.*, o.name as office_name, o.office_level,
              COUNT(c.id) as candidate_count
       FROM races r
       JOIN offices o ON r.office_id = o.id
       LEFT JOIN candidacies c ON r.id = c.race_id
       WHERE r.election_id = $1
       GROUP BY r.id, o.id
       ORDER BY o.sort_order, o.name`,
      [id]
    );
    
    res.json({
      ...election,
      races: racesResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get upcoming elections for user's location
router.get('/local/upcoming', optionalAuth, async (req, res, next) => {
  try {
    const { state, county, city } = req.query;
    
    let query = `
      SELECT DISTINCT e.*
      FROM elections e
      WHERE e.election_date >= CURRENT_DATE
      AND e.is_active = TRUE
    `;
    const params = [];
    let paramIndex = 1;
    
    if (state) {
      query += ` AND (e.state = $${paramIndex} OR e.scope = 'federal')`;
      params.push(state);
      paramIndex++;
    }
    
    query += ' ORDER BY e.election_date ASC LIMIT 10';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
