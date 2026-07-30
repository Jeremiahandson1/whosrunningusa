const express = require('express');
const router = express.Router();
const db = require('../db');

// GET / — List revenue violations with filters
router.get('/', async (req, res, next) => {
  try {
    const { category, sort = 'amount', search, page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`rv.category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(rv.title ILIKE $${paramIndex} OR rv.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'rv.amount_dollars DESC NULLS LAST';
    if (sort === 'date') orderBy = 'rv.start_date DESC NULLS LAST';
    if (sort === 'title') orderBy = 'rv.title ASC';

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM revenue_violations rv ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await db.query(
      `SELECT rv.*,
        (SELECT COUNT(*) FROM revenue_violation_sources WHERE violation_id = rv.id) as source_count,
        (SELECT COUNT(*) FROM revenue_violation_actors WHERE violation_id = rv.id) as actor_count,
        (SELECT COUNT(*) FROM revenue_violation_actors WHERE violation_id = rv.id AND candidate_id IS NOT NULL) as linked_politician_count
       FROM revenue_violations rv
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    res.json({
      violations: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /stats — Aggregate statistics
router.get('/stats', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_violations,
        COALESCE(SUM(amount_dollars), 0) as total_dollars,
        COUNT(*) FILTER (WHERE category = 'trust_fund_raid') as trust_fund_raids,
        COUNT(*) FILTER (WHERE category = 'corporate_bailout') as corporate_bailouts,
        COUNT(*) FILTER (WHERE category = 'pension_failure') as pension_failures
      FROM revenue_violations
    `);

    const largest = await db.query(`
      SELECT id, title, amount_dollars, amount_display, category
      FROM revenue_violations
      ORDER BY amount_dollars DESC NULLS LAST
      LIMIT 1
    `);

    const stats = result.rows[0];
    // snake_case, flat: RevenueViolationsPage reads stats.total_violations,
    // stats.trust_fund_raids etc. — the camelCase/nested payload left the
    // header stat cards stuck at 0.
    res.json({
      total_violations: parseInt(stats.total_violations),
      total_dollars: parseFloat(stats.total_dollars) || 0,
      trust_fund_raids: parseInt(stats.trust_fund_raids),
      corporate_bailouts: parseInt(stats.corporate_bailouts),
      pension_failures: parseInt(stats.pension_failures),
      largest: largest.rows[0] || null,
    });
  } catch (error) {
    next(error);
  }
});

// GET /:id — Violation detail with sources, actors, related candidates
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const violationResult = await db.query(
      `SELECT * FROM revenue_violations WHERE id = $1`,
      [id]
    );

    if (violationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Violation not found' });
    }

    const [sourcesResult, actorsResult, gapsResult] = await Promise.all([
      db.query(
        `SELECT * FROM revenue_violation_sources
         WHERE violation_id = $1
         ORDER BY source_date DESC NULLS LAST`,
        [id]
      ),
      db.query(
        `SELECT rva.*, cp.display_name as politician_name,
                cp.party_affiliation as party, cp.fec_state as state,
                CASE WHEN cp.fec_office_type IS NOT NULL THEN 'federal' ELSE 'state' END as office_level
         FROM revenue_violation_actors rva
         LEFT JOIN candidate_profiles cp ON cp.id = rva.candidate_id
         WHERE rva.violation_id = $1
         ORDER BY rva.actor_name`,
        [id]
      ),
      db.query(
        `SELECT ag.id, ag.gap_type, ag.stated_position, ag.actual_action, ag.gap_severity,
                cp.display_name as politician_name
         FROM revenue_violation_actors rva
         JOIN accountability_gaps ag ON ag.id = rva.accountability_gap_id
         LEFT JOIN candidate_profiles cp ON cp.id = ag.politician_id
         WHERE rva.violation_id = $1 AND rva.accountability_gap_id IS NOT NULL`,
        [id]
      ),
    ]);

    res.json({
      violation: violationResult.rows[0],
      sources: sourcesResult.rows,
      actors: actorsResult.rows,
      relatedGaps: gapsResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
