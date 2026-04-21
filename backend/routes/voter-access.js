const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /voter-access/states — all state scores ranked
router.get('/states', async (req, res, next) => {
  try {
    const { sort = 'overall' } = req.query;

    const allowedSorts = {
      overall: 'vas.overall_score',
      voter_id: 'vas.voter_id_score',
      early_voting: 'vas.early_voting_score',
      mail_voting: 'vas.mail_voting_score',
      registration: 'vas.registration_score'
    };
    const orderCol = allowedSorts[sort] || allowedSorts.overall;

    const result = await db.query(
      `SELECT vas.*,
              vas.state AS state_code,
              vas.state_name AS name
       FROM voter_access_state_scores vas
       ORDER BY ${orderCol} DESC`
    );

    res.json({ states: result.rows });
  } catch (error) {
    console.warn('/voter-access/states fallback:', error.message);
    res.json({ states: [] });
  }
});

// GET /voter-access/state/:state — laws for one state with impacts, sponsors, donors
router.get('/state/:state', async (req, res, next) => {
  try {
    const { state } = req.params;

    // Fetch state score
    const scoreResult = await db.query(
      `SELECT * FROM voter_access_state_scores WHERE state = $1`,
      [state]
    );
    const stateScore = scoreResult.rows[0] || null;

    // Fetch laws for this state
    const lawsResult = await db.query(
      `SELECT val.*
       FROM voter_access_laws val
       WHERE val.state = $1
       ORDER BY val.enacted_date DESC NULLS LAST`,
      [state]
    );

    // Build enriched laws with impacts, sponsor info, and sponsor donors
    const laws = [];
    for (const law of lawsResult.rows) {
      // Get impacts
      const impactsResult = await db.query(
        `SELECT * FROM voter_access_impacts WHERE law_id = $1`,
        [law.id]
      );

      // Get sponsor info
      let sponsor = null;
      let sponsorDonors = [];
      if (law.sponsor_candidate_id) {
        const sponsorResult = await db.query(
          `SELECT id, display_name, party_affiliation
           FROM candidate_profiles WHERE id = $1`,
          [law.sponsor_candidate_id]
        );
        sponsor = sponsorResult.rows[0] || null;

        if (sponsor) {
          const donorsResult = await db.query(
            `SELECT c.donor_name, c.amount, c.contribution_date, c.donor_type
             FROM contributions c
             WHERE c.candidate_id = $1
             ORDER BY c.amount DESC
             LIMIT 5`,
            [sponsor.id]
          );
          sponsorDonors = donorsResult.rows;
        }
      }

      laws.push({
        ...law,
        impacts: impactsResult.rows,
        sponsor: sponsor ? {
          name: sponsor.display_name,
          party: sponsor.party_affiliation,
          topDonors: sponsorDonors
        } : null
      });
    }

    res.json({ stateScore, laws });
  } catch (error) {
    next(error);
  }
});

// GET /voter-access/laws — filtered law list across all states
router.get('/laws', async (req, res, next) => {
  try {
    const { state, law_type, is_restrictive, search, sort = 'date', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (state) {
      conditions.push(`val.state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }
    if (law_type) {
      conditions.push(`val.law_type = $${paramIndex}`);
      params.push(law_type);
      paramIndex++;
    }
    if (is_restrictive !== undefined) {
      conditions.push(`val.is_restrictive = $${paramIndex}`);
      params.push(is_restrictive === 'true');
      paramIndex++;
    }
    if (search) {
      conditions.push(`(val.title ILIKE $${paramIndex} OR val.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'val.enacted_date DESC NULLS LAST';
    if (sort === 'state') orderBy = 'val.state ASC, val.enacted_date DESC NULLS LAST';

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM voter_access_laws val ${where}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT val.*
      FROM voter_access_laws val
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      laws: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// GET /voter-access/law/:id — single law detail with impacts, sponsor, donors
router.get('/law/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const lawResult = await db.query(
      `SELECT * FROM voter_access_laws WHERE id = $1`, [id]
    );
    if (lawResult.rows.length === 0) {
      return res.status(404).json({ error: 'Law not found' });
    }
    const law = lawResult.rows[0];

    // Impacts
    const impactsResult = await db.query(
      `SELECT * FROM voter_access_impacts WHERE law_id = $1`, [id]
    );

    // Sponsor info and donors
    let sponsor = null;
    let sponsorDonors = [];
    if (law.sponsor_candidate_id) {
      const sponsorResult = await db.query(
        `SELECT id, display_name, party_affiliation
         FROM candidate_profiles WHERE id = $1`,
        [law.sponsor_candidate_id]
      );
      sponsor = sponsorResult.rows[0] || null;

      if (sponsor) {
        const donorsResult = await db.query(
          `SELECT c.donor_name, c.amount, c.contribution_date, c.donor_type
           FROM contributions c
           WHERE c.candidate_id = $1
           ORDER BY c.amount DESC
           LIMIT 10`,
          [sponsor.id]
        );
        sponsorDonors = donorsResult.rows;
      }
    }

    res.json({
      law,
      impacts: impactsResult.rows,
      sponsor,
      sponsorDonors
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
