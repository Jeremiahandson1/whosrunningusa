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

    // Registered FARA agents for this country. DOJ's API publishes no
    // compensation amounts, so compensation is null (UI hides it).
    const agents = await db.query(`
      SELECT DISTINCT fr.id, fr.registrant_name AS name, fr.source_url,
             fp.principal_name
      FROM fara_principals fp
      JOIN fara_contracts fc ON fc.principal_id = fp.id
      JOIN fara_registrants fr ON fr.id = fc.registrant_id
      WHERE fp.country_code = $1
      ORDER BY fr.registrant_name
    `, [countryCode]);

    // FEC linkage: DOJ removed its agent-contacts endpoint, so instead match
    // FEC contributions whose donor employer (firms) or donor name (individual
    // "Last, First" registrants) equals a FARA registrant for this country.
    // Exact normalized matches only — conservative on purpose.
    const firmNames = new Set();
    const personNames = new Set();
    const SUFFIXES = /\s+(LLC|LLP|L L P|INC|CORP|CO|COMPANY|GROUP|USA|PLLC|LTD|PC)$/;
    for (const a of agents.rows) {
      const raw = a.name || '';
      if (raw.includes(',')) {
        const [last, rest] = raw.split(',', 2)
          .map(s => s.toUpperCase().replace(/[^A-Za-z ]/g, ' ').replace(/\s+/g, ' ').trim());
        if (last && rest) personNames.add(`${rest} ${last}`);
      } else {
        let n = raw.toUpperCase().replace(/[^A-Za-z ]/g, ' ').replace(/\s+/g, ' ').trim();
        if (n.length >= 5) firmNames.add(n);
        for (;;) { const s = n.replace(SUFFIXES, ''); if (s === n) break; n = s; }
        if (n.length >= 5) firmNames.add(n);
      }
    }
    const normSql = (col) =>
      `TRIM(regexp_replace(UPPER(regexp_replace(COALESCE(${col}, ''), '[^A-Za-z ]', ' ', 'g')), '\\s+', ' ', 'g'))`;
    let donations = { rows: [] };
    if (firmNames.size > 0 || personNames.size > 0) {
      donations = await db.query(`
        SELECT c.contributor_name AS donor_name, c.amount, c.contribution_date,
               c.source_url, cp.id AS recipient_id, cp.display_name AS recipient_name,
               cp.party_affiliation, cp.fec_state AS state
        FROM contributions c
        JOIN candidate_profiles cp ON cp.id = c.candidate_id
        WHERE ${normSql('c.contributor_employer')} = ANY($1)
           OR ${normSql('c.contributor_name')} = ANY($2)
        ORDER BY c.amount DESC NULLS LAST
        LIMIT 100
      `, [[...firmNames], [...personNames]]);
    }

    const politicians = new Map();
    let totalDonations = 0;
    for (const d of donations.rows) {
      totalDonations += parseFloat(d.amount) || 0;
      const p = politicians.get(d.recipient_id) || {
        politician_id: d.recipient_id, display_name: d.recipient_name,
        party_affiliation: d.party_affiliation, state: d.state, contact_count: 0,
      };
      p.contact_count++;
      politicians.set(d.recipient_id, p);
    }

    // Recent votes cast by the linked politicians
    let votes = { rows: [] };
    if (politicians.size > 0) {
      votes = await db.query(`
        SELECT vr.candidate_id AS politician_id, cp.display_name AS politician_name,
               vr.vote, ve.vote_date AS date, b.title AS bill_title,
               b.bill_number AS bill_id
        FROM voting_records vr
        JOIN vote_events ve ON ve.id = vr.vote_event_id
        JOIN candidate_profiles cp ON cp.id = vr.candidate_id
        LEFT JOIN bills b ON b.id = ve.bill_id
        WHERE vr.candidate_id = ANY($1)
        ORDER BY ve.vote_date DESC
        LIMIT 50
      `, [[...politicians.keys()]]);
    }

    // Disclosed lobbying dollars from Senate LDA filings (synced by
    // sync-lda.cjs). Null — not zero — when nothing is synced/disclosed.
    let ldaSpend = null;
    try {
      const lda = await db.query(
        `SELECT SUM(COALESCE(income, expenses)) AS total
         FROM lda_filings WHERE client_country_code = $1`,
        [countryCode]
      );
      if (lda.rows[0].total != null) ldaSpend = parseFloat(lda.rows[0].total);
    } catch (_) { /* lda_filings may not exist yet */ }

    res.json({
      registered_agents: agents.rows.map(a => ({
        name: a.name, firm: a.principal_name || null, compensation: null,
        source_url: a.source_url, source_label: 'FARA Registration',
      })),
      politicians_contacted: [...politicians.values()]
        .sort((a, b) => b.contact_count - a.contact_count),
      donations: donations.rows.slice(0, 25),
      votes: votes.rows,
      total_donations: totalDonations,
      lda_spend: ldaSpend,
      donation_method: 'FEC contributions whose donor name or employer matches a registered FARA agent for this country',
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
