const express = require('express');
const router = express.Router();
const db = require('../db');

// GET / — overview stats for foreign influence tracking
router.get('/', async (req, res, next) => {
  try {
    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM fara_registrants) as total_registrants,
        (SELECT COUNT(*) FROM fara_principals) as total_principals,
        (SELECT COALESCE(SUM(contract_amount), 0) FROM fara_contracts) as total_contract_value,
        (SELECT COUNT(*) FROM fara_contacts) as total_contacts
    `;
    const statsResult = await db.query(statsQuery);

    const topCountriesQuery = `
      SELECT country, total_us_lobbying_spend
      FROM fara_principals
      WHERE total_us_lobbying_spend IS NOT NULL
      ORDER BY total_us_lobbying_spend DESC
      LIMIT 5
    `;
    const topCountriesResult = await db.query(topCountriesQuery);

    const row = statsResult.rows[0];
    res.json({
      stats: {
        totalRegistrants: parseInt(row.total_registrants),
        totalPrincipals: parseInt(row.total_principals),
        totalContractValue: parseFloat(row.total_contract_value),
        totalContacts: parseInt(row.total_contacts),
      },
      topCountries: topCountriesResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /agents — list registered foreign agents
router.get('/agents', async (req, res, next) => {
  try {
    const { country, is_active, sort = 'spend', search, page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (country) {
      conditions.push(`fp.country = $${paramIndex}`);
      params.push(country);
      paramIndex++;
    }
    if (is_active === 'true') {
      conditions.push(`fr.is_active = true`);
    } else if (is_active === 'false') {
      conditions.push(`fr.is_active = false`);
    }
    if (search) {
      conditions.push(`fr.registrant_name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'total_contract_value DESC NULLS LAST';
    if (sort === 'contacts') orderBy = 'contact_count DESC';
    if (sort === 'recent') orderBy = 'fr.registration_date DESC NULLS LAST';
    if (sort === 'name') orderBy = 'fr.registrant_name ASC';

    const countQuery = `
      SELECT COUNT(DISTINCT fr.id) as total
      FROM fara_registrants fr
      LEFT JOIN fara_contracts fc ON fc.registrant_id = fr.id
      LEFT JOIN fara_principals fp ON fp.id = fc.principal_id
      LEFT JOIN fara_contacts fco ON fco.registrant_id = fr.id
      ${where}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT fr.id, fr.registrant_name, fr.registration_date, fr.is_active,
             fr.address, fr.registration_number,
             COUNT(DISTINCT fc.id) as contract_count,
             COUNT(DISTINCT fco.id) as contact_count,
             COALESCE(SUM(fc.contract_amount), 0) as total_contract_value,
             json_agg(DISTINCT fp.country) FILTER (WHERE fp.country IS NOT NULL) as countries
      FROM fara_registrants fr
      LEFT JOIN fara_contracts fc ON fc.registrant_id = fr.id
      LEFT JOIN fara_principals fp ON fp.id = fc.principal_id
      LEFT JOIN fara_contacts fco ON fco.registrant_id = fr.id
      ${where}
      GROUP BY fr.id, fr.registrant_name, fr.registration_date, fr.is_active,
               fr.address, fr.registration_number
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      agents: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /agents/:id — agent detail with contracts, contacts, disbursements
router.get('/agents/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const agentQuery = `
      SELECT id, registrant_name, registration_date, is_active,
             address, registration_number
      FROM fara_registrants
      WHERE id = $1
    `;
    const agentResult = await db.query(agentQuery, [id]);
    if (agentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const contractsQuery = `
      SELECT fc.id, fc.principal_id, fc.contract_amount, fc.start_date,
             fc.end_date, fc.description,
             fp.principal_name, fp.country
      FROM fara_contracts fc
      JOIN fara_principals fp ON fp.id = fc.principal_id
      WHERE fc.registrant_id = $1
      ORDER BY fc.start_date DESC
    `;
    const contractsResult = await db.query(contractsQuery, [id]);

    const contactsQuery = `
      SELECT fco.id, fco.contact_date, fco.contact_type, fco.description,
             fco.candidate_id, fco.agency_or_office,
             cp.display_name as politician_name, cp.party_affiliation,
             cp.fec_office_type
      FROM fara_contacts fco
      LEFT JOIN candidate_profiles cp ON cp.id = fco.candidate_id
      WHERE fco.registrant_id = $1
      ORDER BY fco.contact_date DESC
    `;
    const contactsResult = await db.query(contactsQuery, [id]);

    const disbursementsQuery = `
      SELECT id, recipient, amount, disbursement_date, purpose, category
      FROM fara_disbursements
      WHERE registrant_id = $1
      ORDER BY disbursement_date DESC
    `;
    const disbursementsResult = await db.query(disbursementsQuery, [id]);

    res.json({
      agent: agentResult.rows[0],
      contracts: contractsResult.rows,
      contacts: contactsResult.rows,
      disbursements: disbursementsResult.rows,
      summary: {
        totalContracts: contractsResult.rows.length,
        totalContacts: contactsResult.rows.length,
        totalDisbursements: disbursementsResult.rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /principals — list foreign principals
router.get('/principals', async (req, res, next) => {
  try {
    const { country, is_government, sort = 'spend', search, page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (country) {
      conditions.push(`fp.country = $${paramIndex}`);
      params.push(country);
      paramIndex++;
    }
    if (is_government === 'true') {
      conditions.push(`fp.is_government = true`);
    } else if (is_government === 'false') {
      conditions.push(`fp.is_government = false`);
    }
    if (search) {
      conditions.push(`fp.principal_name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'total_spend DESC NULLS LAST';
    if (sort === 'agents') orderBy = 'agent_count DESC';
    if (sort === 'name') orderBy = 'fp.principal_name ASC';

    const countQuery = `
      SELECT COUNT(DISTINCT fp.id) as total
      FROM fara_principals fp
      LEFT JOIN fara_contracts fc ON fc.principal_id = fp.id
      ${where}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT fp.id, fp.principal_name, fp.country, fp.is_government,
             fp.total_us_lobbying_spend,
             COUNT(DISTINCT fc.registrant_id) as agent_count,
             COALESCE(SUM(fc.contract_amount), 0) as total_spend
      FROM fara_principals fp
      LEFT JOIN fara_contracts fc ON fc.principal_id = fp.id
      ${where}
      GROUP BY fp.id, fp.principal_name, fp.country, fp.is_government,
               fp.total_us_lobbying_spend
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      principals: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /principals/:id — principal detail with influence chain
router.get('/principals/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const principalQuery = `
      SELECT id, principal_name, country, is_government, total_us_lobbying_spend
      FROM fara_principals
      WHERE id = $1
    `;
    const principalResult = await db.query(principalQuery, [id]);
    if (principalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Principal not found' });
    }

    const agentsQuery = `
      SELECT fr.id as registrant_id, fr.registrant_name, fr.is_active,
             fc.contract_amount, fc.start_date, fc.end_date, fc.description
      FROM fara_contracts fc
      JOIN fara_registrants fr ON fr.id = fc.registrant_id
      WHERE fc.principal_id = $1
      ORDER BY fc.start_date DESC
    `;
    const agentsResult = await db.query(agentsQuery, [id]);

    const politicianContactsQuery = `
      SELECT fco.id, fco.contact_date, fco.contact_type, fco.description,
             fco.candidate_id, fco.agency_or_office,
             cp.display_name as politician_name, cp.party_affiliation,
             cp.fec_office_type, cp.fec_state
      FROM fara_contacts fco
      JOIN candidate_profiles cp ON cp.id = fco.candidate_id
      WHERE fco.registrant_id IN (
        SELECT fc.registrant_id FROM fara_contracts fc WHERE fc.principal_id = $1
      )
      ORDER BY fco.contact_date DESC
    `;
    const politicianContactsResult = await db.query(politicianContactsQuery, [id]);

    // For each contacted politician, fetch their recent voting records
    const candidateIds = [...new Set(politicianContactsResult.rows.map(r => r.candidate_id))];
    let relatedVotes = [];

    if (candidateIds.length > 0) {
      const placeholders = candidateIds.map((_, i) => `$${i + 1}`).join(', ');
      const votesQuery = `
        SELECT vr.candidate_id, vr.vote, vr.voted_at,
               ve.event_name, ve.event_date, ve.chamber,
               b.title as bill_title, b.bill_number, b.subject,
               cp.display_name as politician_name
        FROM voting_records vr
        JOIN vote_events ve ON ve.id = vr.vote_event_id
        LEFT JOIN bills b ON b.id = ve.bill_id
        JOIN candidate_profiles cp ON cp.id = vr.candidate_id
        WHERE vr.candidate_id IN (${placeholders})
        ORDER BY ve.event_date DESC
        LIMIT 50
      `;
      const votesResult = await db.query(votesQuery, candidateIds);
      relatedVotes = votesResult.rows;
    }

    res.json({
      principal: principalResult.rows[0],
      agents: agentsResult.rows,
      politicianContacts: politicianContactsResult.rows,
      relatedVotes,
    });
  } catch (error) {
    next(error);
  }
});

// GET /enforcement — enforcement gap view grouped by country
router.get('/enforcement', async (req, res, next) => {
  try {
    const query = `
      SELECT id, country, registrant_id, principal_id, case_description,
             case_date, enforcement_action, penalty_amount, resolution
      FROM fara_enforcement_cases
      ORDER BY country ASC, case_date DESC
    `;
    const result = await db.query(query);

    const countryMap = {};
    for (const row of result.rows) {
      if (!countryMap[row.country]) {
        countryMap[row.country] = { country: row.country, enforced: [], unenforced: [] };
      }
      if (row.enforcement_action) {
        countryMap[row.country].enforced.push(row);
      } else {
        countryMap[row.country].unenforced.push(row);
      }
    }

    res.json({
      countries: Object.values(countryMap),
    });
  } catch (error) {
    next(error);
  }
});

// GET /think-tanks — list think tanks with aggregates
router.get('/think-tanks', async (req, res, next) => {
  try {
    const { sort = 'foreign_funding', search, page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`tt.name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'foreign_funding DESC NULLS LAST';
    if (sort === 'revenue') orderBy = 'tt.annual_revenue DESC NULLS LAST';
    if (sort === 'name') orderBy = 'tt.name ASC';

    const countQuery = `
      SELECT COUNT(*) as total FROM think_tanks tt ${where}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT tt.id, tt.name, tt.website, tt.annual_revenue, tt.transparency_score,
             COALESCE(SUM(ttf.amount) FILTER (WHERE ttf.donor_country != 'US'), 0) as foreign_funding,
             COUNT(DISTINCT tts.id) as staff_count,
             COUNT(DISTINCT tts.id) FILTER (
               WHERE tts.id IN (SELECT think_tank_staff_id FROM post_service_employment pse WHERE pse.think_tank_staff_id IS NOT NULL)
             ) as revolving_door_count,
             COUNT(DISTINCT ttp.id) as publication_count
      FROM think_tanks tt
      LEFT JOIN think_tank_funding ttf ON ttf.think_tank_id = tt.id
      LEFT JOIN think_tank_staff tts ON tts.think_tank_id = tt.id
      LEFT JOIN think_tank_publications ttp ON ttp.think_tank_id = tt.id
      ${where}
      GROUP BY tt.id, tt.name, tt.website, tt.annual_revenue, tt.transparency_score
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      thinkTanks: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /think-tanks/:id — think tank detail with funding, staff, publications
router.get('/think-tanks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const thinkTankQuery = `
      SELECT id, name, website, annual_revenue, transparency_score, description
      FROM think_tanks
      WHERE id = $1
    `;
    const thinkTankResult = await db.query(thinkTankQuery, [id]);
    if (thinkTankResult.rows.length === 0) {
      return res.status(404).json({ error: 'Think tank not found' });
    }

    const fundingQuery = `
      SELECT donor_type, donor_country,
             COUNT(*) as donor_count,
             SUM(amount) as total_amount
      FROM think_tank_funding
      WHERE think_tank_id = $1
      GROUP BY donor_type, donor_country
      ORDER BY total_amount DESC
    `;
    const fundingResult = await db.query(fundingQuery, [id]);

    const staffQuery = `
      SELECT tts.id, tts.name as staff_name, tts.title, tts.start_date, tts.end_date,
             tts.candidate_id,
             cp.display_name as politician_name, cp.party_affiliation,
             cp.fec_office_type,
             pse.employer as post_service_employer, pse.position_title as post_service_title,
             pse.is_lobbying as post_service_lobbying
      FROM think_tank_staff tts
      LEFT JOIN candidate_profiles cp ON cp.id = tts.candidate_id
      LEFT JOIN post_service_employment pse ON pse.think_tank_staff_id = tts.id
      WHERE tts.think_tank_id = $1
      ORDER BY tts.start_date DESC
    `;
    const staffResult = await db.query(staffQuery, [id]);

    const publicationsQuery = `
      SELECT ttp.id, ttp.title, ttp.published_date, ttp.topic, ttp.url,
             ttp.cited_by_count
      FROM think_tank_publications ttp
      WHERE ttp.think_tank_id = $1
        AND ttp.published_date >= NOW() - INTERVAL '2 years'
      ORDER BY ttp.published_date DESC
    `;
    const publicationsResult = await db.query(publicationsQuery, [id]);

    const foreignFundingQuery = `
      SELECT COALESCE(SUM(amount), 0) as foreign_funding
      FROM think_tank_funding
      WHERE think_tank_id = $1 AND donor_country != 'US'
    `;
    const foreignFundingResult = await db.query(foreignFundingQuery, [id]);

    res.json({
      thinkTank: thinkTankResult.rows[0],
      funding: fundingResult.rows,
      staff: staffResult.rows,
      publications: publicationsResult.rows,
      summary: {
        totalStaff: staffResult.rows.length,
        totalPublications: publicationsResult.rows.length,
        totalFundingSources: fundingResult.rows.length,
        foreignFunding: parseFloat(foreignFundingResult.rows[0].foreign_funding),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
