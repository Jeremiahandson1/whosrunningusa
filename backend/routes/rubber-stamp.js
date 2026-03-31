const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /rubber-stamp/leaderboard — Politicians ranked by party loyalty or donor alignment
router.get('/leaderboard', async (req, res, next) => {
  try {
    const { party, chamber, state, cycle = '2026', sort = 'party_loyalty', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    conditions.push(`rss.cycle_year = $${paramIndex}`);
    params.push(parseInt(cycle));
    paramIndex++;

    if (party) {
      conditions.push(`cp.party_affiliation = $${paramIndex}`);
      params.push(party);
      paramIndex++;
    }
    if (chamber) {
      conditions.push(`cp.fec_office_type = $${paramIndex}`);
      params.push(chamber);
      paramIndex++;
    }
    if (state) {
      conditions.push(`cp.fec_state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    let orderBy = 'rss.party_loyalty_pct DESC NULLS LAST';
    if (sort === 'donor_alignment') orderBy = 'rss.donor_alignment_pct DESC NULLS LAST';
    if (sort === 'independent') orderBy = 'rss.independent_votes DESC NULLS LAST';

    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM rubber_stamp_scores rss
       JOIN candidate_profiles cp ON rss.politician_id = cp.id
       ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT rss.politician_id as id,
             cp.display_name, cp.party_affiliation as party,
             cp.fec_state as state, cp.fec_office_type as office_level,
             rss.party_loyalty_pct, rss.donor_alignment_pct,
             rss.total_votes, rss.party_line_votes, rss.independent_votes
      FROM rubber_stamp_scores rss
      JOIN candidate_profiles cp ON rss.politician_id = cp.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      politicians: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// GET /rubber-stamp/politician/:id — Scores for one politician across all cycles
router.get('/politician/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const politicianResult = await db.query(
      `SELECT display_name, party_affiliation as party, fec_state as state
       FROM candidate_profiles
       WHERE id = $1`,
      [id]
    );

    if (politicianResult.rows.length === 0) {
      return res.status(404).json({ error: 'Politician not found' });
    }

    const scoresResult = await db.query(
      `SELECT cycle_year, party_loyalty_pct, donor_alignment_pct,
              total_votes, party_line_votes, cross_party_votes,
              donor_aligned_votes, donor_opposed_votes, independent_votes,
              last_computed_at
       FROM rubber_stamp_scores
       WHERE politician_id = $1
       ORDER BY cycle_year DESC`,
      [id]
    );

    res.json({
      politician: politicianResult.rows[0],
      scores: scoresResult.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
