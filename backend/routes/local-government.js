const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /local-government/offices — list local offices with filters
router.get('/offices', async (req, res, next) => {
  try {
    const { state, office_level, jurisdiction_type, search, page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (state) {
      conditions.push(`lo.state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }
    if (office_level) {
      conditions.push(`lo.office_level = $${paramIndex}`);
      params.push(office_level);
      paramIndex++;
    }
    if (jurisdiction_type) {
      conditions.push(`lo.jurisdiction_type = $${paramIndex}`);
      params.push(jurisdiction_type);
      paramIndex++;
    }
    if (search) {
      conditions.push(`lo.jurisdiction_name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM local_offices lo ${where}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT lo.*
      FROM local_offices lo
      ${where}
      ORDER BY lo.state, lo.jurisdiction_name, lo.office_level
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      offices: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// GET /local-government/officials — list local officials
router.get('/officials', async (req, res, next) => {
  try {
    const { office_id, state, is_current = 'true', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (office_id) {
      conditions.push(`li.office_id = $${paramIndex}`);
      params.push(office_id);
      paramIndex++;
    }
    if (state) {
      conditions.push(`lo.state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }
    if (is_current === 'true') {
      conditions.push(`li.is_current = true`);
    } else if (is_current === 'false') {
      conditions.push(`li.is_current = false`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM local_officials li
       JOIN local_offices lo ON li.office_id = lo.id
       ${where}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT li.*, lo.office_level, lo.jurisdiction_type, lo.jurisdiction_name,
             lo.state, lo.title as office_title,
             cp.display_name as candidate_display_name, cp.party_affiliation,
             cp.profile_photo_url
      FROM local_officials li
      JOIN local_offices lo ON li.office_id = lo.id
      LEFT JOIN candidate_profiles cp ON li.candidate_id = cp.id
      ${where}
      ORDER BY lo.state, lo.jurisdiction_name, li.name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      officials: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// GET /local-government/by-location — find local officials by location
router.get('/by-location', async (req, res, next) => {
  try {
    let { state, county_fips, zip } = req.query;

    // If zip is provided, look up state (and optionally county). No zip_codes
    // table exists in the schema, so tolerate its absence — callers then fall
    // back to the explicit-state requirement below.
    if (zip) {
      try {
        const zipResult = await db.query(
          `SELECT state, county_fips FROM zip_codes WHERE zip = $1 LIMIT 1`,
          [zip]
        );
        if (zipResult.rows.length > 0) {
          state = zipResult.rows[0].state;
          if (!county_fips) {
            county_fips = zipResult.rows[0].county_fips;
          }
        }
      } catch (err) {
        if (err.code !== '42P01') throw err; // 42P01 = undefined_table
      }
    }

    if (!state) {
      return res.status(400).json({ error: 'state is required (provide state or a valid zip)' });
    }

    const officeConditions = [`lo.state = $1`];
    const officeParams = [state];
    let paramIndex = 2;

    if (county_fips) {
      officeConditions.push(`(lo.county_fips = $${paramIndex} OR lo.county_fips IS NULL)`);
      officeParams.push(county_fips);
      paramIndex++;
    }

    const officeWhere = `WHERE ${officeConditions.join(' AND ')}`;

    const officesResult = await db.query(
      `SELECT lo.*
       FROM local_offices lo
       ${officeWhere}
       ORDER BY lo.office_level, lo.jurisdiction_name`,
      officeParams
    );

    // Fetch current officials for each office
    const officeIds = officesResult.rows.map(o => o.id);
    let officialsMap = {};

    if (officeIds.length > 0) {
      const officialsResult = await db.query(
        `SELECT li.*, cp.display_name as candidate_display_name,
                cp.party_affiliation, cp.profile_photo_url
         FROM local_officials li
         LEFT JOIN candidate_profiles cp ON li.candidate_id = cp.id
         WHERE li.office_id = ANY($1) AND li.is_current = true
         ORDER BY li.name`,
        [officeIds]
      );

      for (const official of officialsResult.rows) {
        if (!officialsMap[official.office_id]) {
          officialsMap[official.office_id] = [];
        }
        officialsMap[official.office_id].push(official);
      }
    }

    const offices = officesResult.rows.map(office => ({
      ...office,
      officials: officialsMap[office.id] || []
    }));

    res.json({
      location: { state, county: county_fips || null },
      offices
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
