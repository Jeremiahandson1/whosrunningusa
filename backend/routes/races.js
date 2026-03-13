const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, requireCandidate } = require('../middleware/auth');

// Get races with filters
router.get('/', async (req, res, next) => {
  try {
    const { electionId, officeLevel, state, county, city, limit = 20, offset = 0 } = req.query;
    
    let query = `
      SELECT r.*, o.name as office_name, o.office_level, o.state, o.county, o.city,
             e.election_date, e.name as election_name,
             COUNT(c.id) as candidate_count
      FROM races r
      JOIN offices o ON r.office_id = o.id
      JOIN elections e ON r.election_id = e.id
      LEFT JOIN candidacies c ON r.id = c.race_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (electionId) {
      query += ` AND r.election_id = $${paramIndex}`;
      params.push(electionId);
      paramIndex++;
    }
    
    if (officeLevel) {
      query += ` AND o.office_level = $${paramIndex}`;
      params.push(officeLevel);
      paramIndex++;
    }
    
    if (state) {
      query += ` AND (o.state = $${paramIndex} OR o.office_level = 'federal')`;
      params.push(state);
      paramIndex++;
    }
    
    if (county) {
      query += ` AND o.county = $${paramIndex}`;
      params.push(county);
      paramIndex++;
    }
    
    if (city) {
      query += ` AND o.city = $${paramIndex}`;
      params.push(city);
      paramIndex++;
    }
    
    query += ` GROUP BY r.id, o.id, e.id ORDER BY e.election_date, o.sort_order LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    res.json({ races: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get user's watched races (must be before /:id to avoid route conflict)
router.get('/watching/list', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT r.*, o.name as office_name, o.office_level,
              e.election_date, e.name as election_name,
              COUNT(c.id) as candidate_count,
              rw.created_at as watched_at
       FROM race_watchers rw
       JOIN races r ON rw.race_id = r.id
       JOIN offices o ON r.office_id = o.id
       JOIN elections e ON r.election_id = e.id
       LEFT JOIN candidacies c ON r.id = c.race_id
       WHERE rw.user_id = $1
       GROUP BY r.id, o.id, e.id, rw.created_at
       ORDER BY e.election_date, o.sort_order`,
      [req.user.id]
    );
    res.json({ races: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get single race with candidates
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const raceResult = await db.query(
      `SELECT r.*, o.name as office_name, o.office_level, o.term_length_years,
              e.election_date, e.name as election_name, e.registration_deadline
       FROM races r
       JOIN offices o ON r.office_id = o.id
       JOIN elections e ON r.election_id = e.id
       WHERE r.id = $1`,
      [id]
    );
    
    if (raceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }
    
    const race = raceResult.rows[0];
    
    // Get candidates
    const candidatesResult = await db.query(
      `SELECT cp.*, c.filing_status, c.filed_at, c.votes_received, c.result,
              u.first_name, u.last_name
       FROM candidacies c
       JOIN candidate_profiles cp ON c.candidate_id = cp.id
       LEFT JOIN users u ON cp.user_id = u.id
       WHERE c.race_id = $1
       ORDER BY cp.display_name`,
      [id]
    );
    
    res.json({
      ...race,
      candidates: candidatesResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// File for a race (candidate registers for a race)
router.post('/:id/file', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { filingStatus = 'exploring' } = req.body;
    
    // Get candidate profile
    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }
    
    const candidateId = profileResult.rows[0].id;
    
    // Check race exists
    const raceResult = await db.query('SELECT id FROM races WHERE id = $1', [id]);
    if (raceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }
    
    const result = await db.query(
      `INSERT INTO candidacies (candidate_id, race_id, filing_status)
       VALUES ($1, $2, $3)
       ON CONFLICT (candidate_id, race_id) DO UPDATE SET filing_status = $3, updated_at = NOW()
       RETURNING *`,
      [candidateId, id, filingStatus]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Withdraw from a race
router.delete('/:id/file', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }
    
    await db.query(
      `UPDATE candidacies SET filing_status = 'withdrawn', updated_at = NOW()
       WHERE candidate_id = $1 AND race_id = $2`,
      [profileResult.rows[0].id, id]
    );
    
    res.json({ message: 'Withdrawn from race' });
  } catch (error) {
    next(error);
  }
});

// Compare candidates in a race
router.get('/:id/compare', async (req, res, next) => {
  try {
    const { id } = req.params;
    let { candidateIds } = req.query;

    let ids;
    if (candidateIds) {
      ids = candidateIds.split(',');
    } else {
      // If no candidateIds provided, compare all candidates in the race
      const candidacies = await db.query(
        'SELECT candidate_id FROM candidacies WHERE race_id = $1',
        [id]
      );
      ids = candidacies.rows.map(r => r.candidate_id);
    }

    if (ids.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 candidates to compare' });
    }

    // Get race info
    const raceResult = await db.query(
      `SELECT r.*, o.name as office_name, e.name as election_name
       FROM races r
       JOIN offices o ON r.office_id = o.id
       JOIN elections e ON r.election_id = e.id
       WHERE r.id = $1`,
      [id]
    );

    // Get candidates with positions
    const candidates = [];

    for (const candidateId of ids) {
      const candidateResult = await db.query(
        `SELECT cp.*, u.first_name, u.last_name
         FROM candidate_profiles cp
         LEFT JOIN users u ON cp.user_id = u.id
         WHERE cp.id = $1`,
        [candidateId]
      );

      if (candidateResult.rows.length === 0) continue;

      const candidate = candidateResult.rows[0];

      // Get positions
      const positionsResult = await db.query(
        `SELECT cp.*, i.name as issue_name, i.id as issue_id, ic.name as category_name, ic.id as category_id
         FROM candidate_positions cp
         JOIN issues i ON cp.issue_id = i.id
         JOIN issue_categories ic ON i.category_id = ic.id
         WHERE cp.candidate_id = $1
         ORDER BY ic.sort_order, i.sort_order`,
        [candidateId]
      );

      candidates.push({
        ...candidate,
        verified: candidate.candidate_verified,
        positions: positionsResult.rows
      });
    }

    // Collect all unique issues across candidates for the comparison grid
    const issueMap = new Map();
    candidates.forEach(c => {
      (c.positions || []).forEach(p => {
        if (!issueMap.has(p.issue_id)) {
          issueMap.set(p.issue_id, { id: p.issue_id, name: p.category_name + ': ' + p.issue_name });
        }
      });
    });

    res.json({
      race: raceResult.rows[0] || null,
      candidates,
      issues: Array.from(issueMap.values()),
    });
  } catch (error) {
    next(error);
  }
});

// Toggle watching a race
router.post('/:id/watch', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check race exists
    const raceResult = await db.query('SELECT id FROM races WHERE id = $1', [id]);
    if (raceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }

    // Check if already watching
    const existing = await db.query(
      'SELECT id FROM race_watchers WHERE user_id = $1 AND race_id = $2',
      [req.user.id, id]
    );

    if (existing.rows.length > 0) {
      // Remove watch
      await db.query(
        'DELETE FROM race_watchers WHERE user_id = $1 AND race_id = $2',
        [req.user.id, id]
      );
      res.json({ watching: false });
    } else {
      // Add watch
      await db.query(
        'INSERT INTO race_watchers (user_id, race_id) VALUES ($1, $2)',
        [req.user.id, id]
      );
      res.json({ watching: true });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
