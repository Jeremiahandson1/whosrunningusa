const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, requireCandidate } = require('../middleware/auth');

// Get races with filters
router.get('/', async (req, res, next) => {
  try {
    const { electionId, officeLevel, scope, state, county, city, incumbent_id, upcoming, q, limit = 20, offset = 0 } = req.query;

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

    // RacesPage level dropdown ('city' option covers all sub-county levels)
    if (scope && scope !== 'all') {
      if (scope === 'city') {
        query += ` AND o.office_level IN ('city', 'township', 'district')`;
      } else if (['federal', 'state', 'county'].includes(scope)) {
        query += ` AND o.office_level = $${paramIndex}`;
        params.push(scope);
        paramIndex++;
      }
    }

    // RacesPage search box — race, office, or election name
    if (q) {
      query += ` AND (r.name ILIKE $${paramIndex} OR o.name ILIKE $${paramIndex} OR e.name ILIKE $${paramIndex})`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (state) {
      // Match the state's own offices plus nationwide federal offices
      // (President/VP have no state). Federal offices for OTHER states
      // (their Senate/House seats) carry o.state and are excluded.
      query += ` AND (o.state = $${paramIndex} OR (o.office_level = 'federal' AND o.state IS NULL))`;
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

    // Filter to races where a given candidate is either the incumbent or a filed candidate.
    // Used by the profile page to show the next election when the candidate row
    // itself doesn't have a race_id set (e.g. shadow profiles for sitting officials).
    if (incumbent_id) {
      query += ` AND (r.incumbent_id = $${paramIndex} OR EXISTS (
        SELECT 1 FROM candidacies c2 WHERE c2.race_id = r.id AND c2.candidate_id = $${paramIndex}
      ))`;
      params.push(incumbent_id);
      paramIndex++;
    }

    // Restrict to elections whose date is today or later
    if (upcoming === 'true' || upcoming === '1') {
      query += ` AND e.election_date >= CURRENT_DATE`;
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

    // Validate UUID format to prevent SQL errors on named routes
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(404).json({ error: 'Race not found' });
    }

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

// GET /:id/funding-comparison — funding comparison for all candidates in a race
router.get('/:id/funding-comparison', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cycle } = req.query;

    const race = await db.query(`SELECT r.*, o.name as office_name FROM races r LEFT JOIN offices o ON o.id = r.office_id WHERE r.id = $1`, [id]);
    if (race.rows.length === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }

    const cycleYear = cycle || new Date().getFullYear() + (new Date().getFullYear() % 2 === 0 ? 0 : 1);

    const result = await db.query(
      `SELECT
        cp.id,
        cp.display_name,
        cp.party_affiliation as party,
        cp.profile_photo_url,
        c.filing_status,
        c.result,
        CASE WHEN r.incumbent_id = cp.id THEN true ELSE false END as is_incumbent,
        cfs.total_raised,
        cfs.total_spent,
        cfs.cash_on_hand,
        cfs.pac_contributions,
        cfs.individual_contributions,
        cfs.self_financing,
        cfs.small_donor_percent,
        cfs.total_contributors,
        cfs.last_filed_date
      FROM candidacies c
      JOIN candidate_profiles cp ON cp.id = c.candidate_id
      JOIN races r ON r.id = c.race_id
      LEFT JOIN campaign_finance_summaries cfs ON cfs.candidate_id = cp.id AND cfs.election_cycle = $2
      WHERE c.race_id = $1 AND c.filing_status NOT IN ('withdrawn')
      ORDER BY COALESCE(cfs.total_raised, 0) DESC`,
      [id, cycleYear]
    );

    const candidates = result.rows;
    const incumbents = candidates.filter(c => c.is_incumbent);
    const challengers = candidates.filter(c => !c.is_incumbent);

    const totalRaised = candidates.reduce((sum, c) => sum + (parseFloat(c.total_raised) || 0), 0);
    const incumbentTotal = incumbents.reduce((sum, c) => sum + (parseFloat(c.total_raised) || 0), 0);
    const challengerTotal = challengers.reduce((sum, c) => sum + (parseFloat(c.total_raised) || 0), 0);

    res.json({
      race: race.rows[0],
      candidates,
      summary: {
        totalRaised,
        incumbentTotal,
        challengerTotal,
        fundingGap: incumbentTotal - challengerTotal,
        candidateCount: candidates.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
