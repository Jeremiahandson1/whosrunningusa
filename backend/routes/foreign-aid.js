const express = require('express');
const router = express.Router();
const db = require('../db');

// GET / — List countries with aid totals
router.get('/', async (req, res, next) => {
  try {
    const { year, category, search, sort, page: pageParam } = req.query;
    const limit = 20;
    const page = Math.max(1, parseInt(pageParam) || 1);
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (year) {
      conditions.push(`fiscal_year = $${paramIndex}`);
      params.push(parseInt(year));
      paramIndex++;
    }
    // Summaries carry one amount column per category rather than a category
    // column — "filter by category" means countries with aid in that bucket.
    const categoryColumns = {
      military: 'military_amount',
      economic: 'economic_amount',
      humanitarian: 'humanitarian_amount',
      democracy: 'democracy_amount',
      health: 'health_amount',
      other: 'other_amount',
    };
    if (category && categoryColumns[category]) {
      conditions.push(`${categoryColumns[category]} > 0`);
    }
    if (search) {
      conditions.push(`country_name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortColumns = {
      total: 'total_obligation DESC',
      military: 'military_amount DESC',
      economic: 'economic_amount DESC',
      humanitarian: 'humanitarian_amount DESC',
    };
    const orderBy = sortColumns[sort] || 'total_obligation DESC';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM foreign_aid_country_summaries ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const rows = await db.query(
      `SELECT * FROM foreign_aid_country_summaries
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    res.json({
      countries: rows.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /stats — Aggregate statistics
// snake_case + *_pct: ForeignAidPage reads stats.total_countries,
// stats.military_pct etc. — the old camelCase/dollar payload left the
// header stat cards stuck at 0.
const EMPTY_FOREIGN_AID_STATS = {
  total_countries: 0,
  total_obligation: 0,
  military_pct: 0,
  economic_pct: 0,
  humanitarian_pct: 0,
  by_category: { military: 0, economic: 0, humanitarian: 0, democracy: 0, health: 0, other: 0 },
  top_recipients: [],
};
router.get('/stats', async (req, res) => {
  try {
    const totals = await db.query(`
      SELECT
        COUNT(DISTINCT country_code) AS total_countries,
        COALESCE(SUM(total_obligation), 0) AS total_obligation,
        COALESCE(SUM(military_amount), 0) AS military,
        COALESCE(SUM(economic_amount), 0) AS economic,
        COALESCE(SUM(humanitarian_amount), 0) AS humanitarian,
        COALESCE(SUM(democracy_amount), 0) AS democracy,
        COALESCE(SUM(health_amount), 0) AS health,
        COALESCE(SUM(other_amount), 0) AS other
      FROM foreign_aid_country_summaries
    `);

    const recentYear = await db.query(
      `SELECT MAX(fiscal_year) AS max_year FROM foreign_aid_country_summaries`
    );
    const maxYear = recentYear.rows[0].max_year;

    let topRecipients = [];
    if (maxYear) {
      const top = await db.query(`
        SELECT country_code, country_name, total_obligation
        FROM foreign_aid_country_summaries
        WHERE fiscal_year = $1
        ORDER BY total_obligation DESC
        LIMIT 5
      `, [maxYear]);
      topRecipients = top.rows;
    }

    const row = totals.rows[0];
    const totalObligation = parseFloat(row.total_obligation);
    const pct = (v) => totalObligation > 0 ? Math.round((parseFloat(v) / totalObligation) * 100) : 0;
    res.json({
      total_countries: parseInt(row.total_countries),
      total_obligation: totalObligation,
      military_pct: pct(row.military),
      economic_pct: pct(row.economic),
      humanitarian_pct: pct(row.humanitarian),
      by_category: {
        military: parseFloat(row.military),
        economic: parseFloat(row.economic),
        humanitarian: parseFloat(row.humanitarian),
        democracy: parseFloat(row.democracy),
        health: parseFloat(row.health),
        other: parseFloat(row.other),
      },
      top_recipients: topRecipients,
    });
  } catch (error) {
    console.warn('/foreign-aid/stats fallback:', error.message);
    res.json(EMPTY_FOREIGN_AID_STATS);
  }
});

// GET /countries/:countryCode — Country detail with yearly summaries
router.get('/countries/:countryCode', async (req, res, next) => {
  try {
    const { countryCode } = req.params;
    const { year } = req.query;

    const conditions = ['country_code = $1'];
    const params = [countryCode];
    let paramIndex = 2;

    if (year) {
      conditions.push(`fiscal_year = $${paramIndex}`);
      params.push(parseInt(year));
      paramIndex++;
    }

    const summaries = await db.query(
      `SELECT * FROM foreign_aid_country_summaries
       WHERE ${conditions.join(' AND ')}
       ORDER BY fiscal_year DESC`,
      params
    );

    if (summaries.rows.length === 0) {
      return res.status(404).json({ error: 'No aid data found for this country' });
    }

    const totalResult = await db.query(
      `SELECT COALESCE(SUM(total_obligation), 0) AS total_all_time
       FROM foreign_aid_country_summaries
       WHERE country_code = $1`,
      [countryCode]
    );

    res.json({
      country: {
        country_code: countryCode,
        country_name: summaries.rows[0].country_name,
      },
      summaries: summaries.rows,
      totalAllTime: parseFloat(totalResult.rows[0].total_all_time),
    });
  } catch (error) {
    next(error);
  }
});

// GET /countries/:countryCode/programs — Paginated programs for a country
router.get('/countries/:countryCode/programs', async (req, res, next) => {
  try {
    const { countryCode } = req.params;
    const { year, category, page: pageParam } = req.query;
    const limit = 20;
    const page = Math.max(1, parseInt(pageParam) || 1);
    const offset = (page - 1) * limit;

    const conditions = ['country_code = $1'];
    const params = [countryCode];
    let paramIndex = 2;

    if (year) {
      conditions.push(`fiscal_year = $${paramIndex}`);
      params.push(parseInt(year));
      paramIndex++;
    }
    if (category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*) FROM foreign_aid_programs WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const rows = await db.query(
      `SELECT * FROM foreign_aid_programs
       WHERE ${whereClause}
       ORDER BY total_obligation DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    res.json({
      programs: rows.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /countries/:countryCode/influence — Influence chain: FARA agents → contacts → donations → votes
router.get('/countries/:countryCode/influence', async (req, res, next) => {
  try {
    const { countryCode } = req.params;

    // FARA agents registered for this country
    const agents = await db.query(`
      SELECT
        fr.id AS registrant_id,
        fr.registrant_name,
        fc.contract_date,
        fc.contract_amount,
        fp.principal_name,
        fp.country_code
      FROM fara_principals fp
      JOIN fara_contracts fc ON fc.principal_id = fp.id
      JOIN fara_registrants fr ON fr.id = fc.registrant_id
      WHERE fp.country_code = $1
      ORDER BY fc.contract_amount DESC NULLS LAST
    `, [countryCode]);

    // Politicians those agents contacted, with donation totals
    const fundedPoliticians = await db.query(`
      SELECT DISTINCT
        cp.id AS candidate_id,
        cp.display_name,
        cp.party_affiliation,
        cp.official_title,
        fcon.contact_date,
        fcon.contact_type,
        fcon.description AS contact_description,
        COALESCE(donor_totals.total_donated, 0) AS total_donated
      FROM fara_contacts fcon
      JOIN fara_principals fp ON fp.id = fcon.principal_id
      JOIN candidate_profiles cp ON cp.id = fcon.candidate_id
      LEFT JOIN LATERAL (
        SELECT SUM(amount) AS total_donated
        FROM contributions
        WHERE candidate_id = cp.id
          AND contributor_id IN (
            SELECT fr.id FROM fara_registrants fr
            JOIN fara_contracts fc2 ON fc2.registrant_id = fr.id
            JOIN fara_principals fp2 ON fp2.id = fc2.principal_id
            WHERE fp2.country_code = $1
          )
      ) donor_totals ON true
      WHERE fp.country_code = $1
        AND fcon.candidate_id IS NOT NULL
      ORDER BY total_donated DESC NULLS LAST
    `, [countryCode]);

    // Relevant votes those politicians cast
    const relatedVotes = await db.query(`
      SELECT
        vr.candidate_id,
        cp.display_name,
        vr.vote AS vote_position,
        ve.vote_date,
        ve.motion_text AS vote_question,
        ve.result AS vote_result,
        b.title AS bill_title,
        b.bill_number
      FROM voting_records vr
      JOIN vote_events ve ON ve.id = vr.vote_event_id
      JOIN bills b ON b.id = ve.bill_id
      JOIN candidate_profiles cp ON cp.id = vr.candidate_id
      WHERE vr.candidate_id IN (
        SELECT DISTINCT fcon.candidate_id
        FROM fara_contacts fcon
        JOIN fara_principals fp ON fp.id = fcon.principal_id
        WHERE fp.country_code = $1
          AND fcon.candidate_id IS NOT NULL
      )
      ORDER BY ve.vote_date DESC
      LIMIT 50
    `, [countryCode]);

    // Total lobbying spend for this country
    const lobbyResult = await db.query(`
      SELECT COALESCE(SUM(fc.contract_amount), 0) AS total_lobbying_spend
      FROM fara_contracts fc
      JOIN fara_principals fp ON fp.id = fc.principal_id
      WHERE fp.country_code = $1
    `, [countryCode]);

    res.json({
      agents: agents.rows,
      fundedPoliticians: fundedPoliticians.rows,
      relatedVotes: relatedVotes.rows,
      totalLobbyingSpend: parseFloat(lobbyResult.rows[0].total_lobbying_spend),
    });
  } catch (error) {
    next(error);
  }
});

// GET /countries/:countryCode/policies — Hypocrisy index data
router.get('/countries/:countryCode/policies', async (req, res, next) => {
  try {
    const { countryCode } = req.params;

    const policies = await db.query(
      `SELECT * FROM hypocrisy_index_data
       WHERE country_code = $1
       ORDER BY policy_name`,
      [countryCode]
    );

    // Derive country name from aid summaries if policies exist, otherwise from policies themselves
    let countryName = null;
    if (policies.rows.length > 0 && policies.rows[0].country_name) {
      countryName = policies.rows[0].country_name;
    } else {
      const nameResult = await db.query(
        `SELECT country_name FROM foreign_aid_country_summaries
         WHERE country_code = $1 LIMIT 1`,
        [countryCode]
      );
      countryName = nameResult.rows.length > 0 ? nameResult.rows[0].country_name : null;
    }

    res.json({
      policies: policies.rows,
      countryName,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
