const express = require('express');
const router = express.Router();
const db = require('../db');

// Global search
router.get('/', async (req, res, next) => {
  try {
    const { q, type, state, limit = 40 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    
    const searchTerm = `%${q}%`;
    const results = {
      candidates: [],
      races: [],
      elections: []
    };
    
    // Search candidates
    if (!type || type === 'candidates') {
      const candidatesResult = await db.query(
        `SELECT cp.id, cp.display_name, cp.party_affiliation, cp.official_title,
                u.first_name, u.last_name,
                'candidate' as result_type
         FROM candidate_profiles cp
         LEFT JOIN users u ON cp.user_id = u.id
         WHERE cp.is_active = TRUE AND (
           cp.display_name ILIKE $1 OR
           u.first_name ILIKE $1 OR
           u.last_name ILIKE $1
         )
         ORDER BY cp.display_name
         LIMIT $2`,
        [searchTerm, parseInt(limit)]
      );
      results.candidates = candidatesResult.rows;
    }
    
    // Search races
    if (!type || type === 'races') {
      let racesQuery = `
        SELECT r.id, r.name, o.name as office_name, o.office_level,
               e.election_date, e.name as election_name,
               'race' as result_type
        FROM races r
        JOIN offices o ON r.office_id = o.id
        JOIN elections e ON r.election_id = e.id
        WHERE r.name ILIKE $1 OR o.name ILIKE $1
      `;
      const racesParams = [searchTerm];
      
      if (state) {
        racesQuery += ' AND (o.state = $3 OR o.office_level = \'federal\')';
        racesParams.push(state);
      }
      
      racesQuery += ' ORDER BY e.election_date LIMIT $2';
      racesParams.splice(1, 0, parseInt(limit));
      
      const racesResult = await db.query(racesQuery, racesParams);
      results.races = racesResult.rows;
    }
    
    // Search elections
    if (!type || type === 'elections') {
      const electionsResult = await db.query(
        `SELECT id, name, election_date, election_type, scope, state,
                'election' as result_type
         FROM elections
         WHERE name ILIKE $1
         ORDER BY election_date DESC
         LIMIT $2`,
        [searchTerm, parseInt(limit)]
      );
      results.elections = electionsResult.rows;
    }
    
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Search candidates by location
router.get('/candidates/by-location', async (req, res, next) => {
  try {
    const { state, county, city, officeLevel, search, limit = 50, offset = 0 } = req.query;

    const params = [];
    let paramIndex = 1;

    // Name search filter (applied to all sub-queries)
    let nameFilter = '';
    if (search) {
      nameFilter = ` AND cp.display_name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Query 1: Candidates with full office/race/candidacy chain (local/state offices)
    let query = `
      SELECT DISTINCT cp.id, cp.display_name, cp.party_affiliation, cp.official_title,
             cp.campaign_website, cp.fec_candidate_id, cp.candidate_verified,
             cp.identity_verified, cp.incumbent_verified, cp.is_shadow_profile,
             cp.qa_response_rate, u.first_name, u.last_name,
             o.office_level, o.name as office_name,
             'local' as source
      FROM candidate_profiles cp
      LEFT JOIN users u ON cp.user_id = u.id
      JOIN candidacies c ON cp.id = c.candidate_id
      JOIN races r ON c.race_id = r.id
      JOIN offices o ON r.office_id = o.id
      WHERE cp.is_active = TRUE${nameFilter}
    `;
    
    if (state) {
      query += ` AND o.state = $${paramIndex}`;
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
    
    if (officeLevel) {
      query += ` AND o.office_level = $${paramIndex}`;
      params.push(officeLevel);
      paramIndex++;
    }

    // Query 2: FEC candidates by state (no county filter) - uses pre-computed fec_state column
    if (state && !county && !city) {
      query += `
        UNION
        SELECT DISTINCT cp.id, cp.display_name, cp.party_affiliation, cp.official_title,
               cp.campaign_website, cp.fec_candidate_id, cp.candidate_verified,
               cp.identity_verified, cp.incumbent_verified, cp.is_shadow_profile,
               cp.qa_response_rate, NULL as first_name, NULL as last_name,
               'federal' as office_level,
               CASE
                 WHEN cp.fec_office_type = 'H' THEN 'U.S. House of Representatives'
                 WHEN cp.fec_office_type = 'S' THEN 'U.S. Senate'
                 WHEN cp.fec_office_type = 'P' THEN 'President'
                 ELSE 'Federal Office'
               END as office_name,
               'fec' as source
        FROM candidate_profiles cp
        WHERE cp.is_active = TRUE${nameFilter}
          AND cp.fec_state = $${paramIndex}
      `;
      params.push(state);
      paramIndex++;
    }

    // Query 3: FEC candidates by county (using district-county mappings + pre-computed columns)
    if (state && county && !city) {
      query += `
        UNION
        SELECT DISTINCT cp.id, cp.display_name, cp.party_affiliation, cp.official_title,
               cp.campaign_website, cp.fec_candidate_id, cp.candidate_verified,
               cp.identity_verified, cp.incumbent_verified, cp.is_shadow_profile,
               cp.qa_response_rate, NULL as first_name, NULL as last_name,
               'federal' as office_level,
               CASE
                 WHEN cp.fec_office_type = 'H' THEN
                   'U.S. House District ' || TRIM(LEADING '0' FROM cp.fec_district)
                 WHEN cp.fec_office_type = 'S' THEN 'U.S. Senate'
                 ELSE 'Federal Office'
               END as office_name,
               'fec_district' as source
        FROM candidate_profiles cp
        WHERE cp.is_active = TRUE${nameFilter}
          AND cp.fec_state = $${paramIndex}
          AND (
            -- Senate candidates apply to whole state
            cp.fec_office_type = 'S'
            OR
            -- House candidates: check if their district overlaps this county
            (
              cp.fec_office_type = 'H'
              AND cp.fec_district IN (
                SELECT cd.district_number
                FROM district_county_mappings dcm
                JOIN congressional_districts cd ON dcm.district_id = cd.id
                JOIN counties c ON dcm.county_geoid = c.county_geoid
                WHERE c.state_abbr = $${paramIndex + 1}
                  AND LOWER(c.county_name) = LOWER($${paramIndex + 2})
              )
            )
            OR
            -- At-large states (only 1 district)
            cp.fec_district IN ('00', '98')
          )
      `;
      params.push(state);
      params.push(state);
      params.push(county);
      paramIndex += 3;
    }
    
    query += ` ORDER BY display_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit));
    params.push(parseInt(offset));

    const result = await db.query(query, params);
    res.json({ candidates: result.rows });
  } catch (error) {
    console.error('Error in candidates by-location:', error);
    next(error);
  }
});

// Get available cities for a state/county
router.get('/locations/cities', async (req, res, next) => {
  try {
    const { state, county } = req.query;
    
    if (!state) {
      return res.status(400).json({ error: 'state is required' });
    }
    
    let query = `
      SELECT DISTINCT o.city
      FROM offices o
      WHERE o.state = $1 
        AND o.city IS NOT NULL 
        AND o.city != ''
    `;
    const params = [state];
    
    if (county) {
      query += ` AND o.county = $2`;
      params.push(county);
    }
    
    query += ` ORDER BY o.city`;
    
    const result = await db.query(query, params);
    res.json(result.rows.map(r => r.city));
  } catch (error) {
    next(error);
  }
});

// Search by issue position
router.get('/candidates/by-position', async (req, res, next) => {
  try {
    const { issueId, stance, state, limit = 20 } = req.query;
    
    if (!issueId) {
      return res.status(400).json({ error: 'issueId is required' });
    }
    
    let query = `
      SELECT cp.*, pos.stance, pos.explanation, u.first_name, u.last_name
      FROM candidate_profiles cp
      LEFT JOIN users u ON cp.user_id = u.id
      JOIN candidate_positions pos ON cp.id = pos.candidate_id
      WHERE pos.issue_id = $1 AND cp.is_active = TRUE
    `;
    const params = [issueId];
    let paramIndex = 2;
    
    if (stance) {
      query += ` AND pos.stance = $${paramIndex}`;
      params.push(stance);
      paramIndex++;
    }
    
    query += ` ORDER BY cp.display_name LIMIT $${paramIndex}`;
    params.push(parseInt(limit));
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;