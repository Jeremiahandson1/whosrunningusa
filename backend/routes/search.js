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
    // Normalize a house district param to two-digit string ('7' -> '07');
    // undefined when not given. Frontend sends this after address lookup.
    const districtRaw = req.query.district != null ? String(req.query.district).trim() : '';
    const districtTwo = districtRaw && /^\d+$/.test(districtRaw)
      ? String(parseInt(districtRaw, 10)).padStart(2, '0')
      : (districtRaw || null);

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
             cp.qa_response_rate, cp.total_questions_received, u.first_name, u.last_name,
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
      // Narrow to offices that *could be on this voter's ballot* —
      //  - Local offices in the same county (o.county matches);
      //  - Statewide offices (Senate / Governor / President) which have no
      //    district scope (o.district IS NULL or empty);
      //  - District-scoped offices (U.S. House, state-leg districts) only
      //    when the district actually overlaps this county, via the
      //    district_county_mappings lookup.
      query += ` AND (
        o.county = $${paramIndex}
        OR (o.county IS NULL AND (o.district IS NULL OR o.district = ''))
        OR (o.district IS NOT NULL AND o.district <> '' AND o.district IN (
          -- Census relationship file records every sliver of overlap (even 0.5%);
          -- exclude those so a county with 99%/1% split doesn't map to both
          -- districts. Threshold = 5% of county land area, OR the mapping is
          -- flagged as a full-county match.
          SELECT TRIM(LEADING '0' FROM cd.district_number)
            FROM district_county_mappings dcm
            JOIN congressional_districts cd ON dcm.district_id = cd.id
            JOIN counties c ON dcm.county_geoid = c.county_geoid
           WHERE c.state_abbr = $${paramIndex + 1}
             AND LOWER(c.county_name) = LOWER($${paramIndex + 2})
             AND (dcm.is_full_county = TRUE OR dcm.land_area_percent >= 5)
          UNION
          SELECT cd.district_number
            FROM district_county_mappings dcm
            JOIN congressional_districts cd ON dcm.district_id = cd.id
            JOIN counties c ON dcm.county_geoid = c.county_geoid
           WHERE c.state_abbr = $${paramIndex + 1}
             AND LOWER(c.county_name) = LOWER($${paramIndex + 2})
             AND (dcm.is_full_county = TRUE OR dcm.land_area_percent >= 5)
        ))
      )`;
      params.push(county, state, county);
      paramIndex += 3;
    }

    if (city) {
      query += ` AND (o.city = $${paramIndex} OR o.city IS NULL OR o.office_level IN ('federal','state'))`;
      params.push(city);
      paramIndex++;
    }
    
    if (officeLevel) {
      query += ` AND o.office_level = $${paramIndex}`;
      params.push(officeLevel);
      paramIndex++;
    }

    // When a specific district is known (from address lookup), tighten the
    // district-scoped office filter to just that district. Statewide offices
    // (no district set) still pass through.
    if (districtTwo) {
      query += ` AND (
        o.district IS NULL OR o.district = ''
        OR o.district = $${paramIndex}
        OR o.district = $${paramIndex + 1}
      )`;
      params.push(districtTwo, String(parseInt(districtTwo, 10)));
      paramIndex += 2;
    }

    // Query 2: FEC candidates by state — Senate/President always apply to the
    // whole state, so include them even when a county is specified.
    if (state && !city) {
      const senatePresClause = county
        ? ` AND cp.fec_office_type IN ('S','P')`
        : '';
      query += `
        UNION
        SELECT DISTINCT cp.id, cp.display_name, cp.party_affiliation, cp.official_title,
               cp.campaign_website, cp.fec_candidate_id, cp.candidate_verified,
               cp.identity_verified, cp.incumbent_verified, cp.is_shadow_profile,
               cp.qa_response_rate, cp.total_questions_received, NULL as first_name, NULL as last_name,
               'federal' as office_level,
               CASE
                 -- DC has no U.S. Senate seats and one non-voting delegate;
                 -- its FEC 'S'/'H' filers are statehood shadow-delegation and
                 -- delegate candidates and must not be labeled as real seats.
                 WHEN cp.fec_state = 'DC' AND cp.fec_office_type = 'S' THEN 'DC Shadow Senator (statehood delegation)'
                 WHEN cp.fec_state = 'DC' AND cp.fec_office_type = 'H' THEN 'DC Delegate to the U.S. House (non-voting)'
                 WHEN cp.fec_office_type = 'H' THEN 'U.S. House of Representatives'
                 WHEN cp.fec_office_type = 'S' THEN 'U.S. Senate'
                 WHEN cp.fec_office_type = 'P' THEN 'President'
                 ELSE 'Federal Office'
               END as office_name,
               'fec' as source
        FROM candidate_profiles cp
        WHERE cp.is_active = TRUE${nameFilter}
          AND cp.fec_state = $${paramIndex}${senatePresClause}
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
               cp.qa_response_rate, cp.total_questions_received, NULL as first_name, NULL as last_name,
               'federal' as office_level,
               CASE
                 WHEN cp.fec_state = 'DC' AND cp.fec_office_type = 'S' THEN 'DC Shadow Senator (statehood delegation)'
                 WHEN cp.fec_state = 'DC' AND cp.fec_office_type = 'H' THEN 'DC Delegate to the U.S. House (non-voting)'
                 WHEN cp.fec_office_type = 'H' AND cp.fec_district IN ('00', '98') THEN 'U.S. House At-Large'
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
            -- House candidates: check if their district meaningfully overlaps
            -- this county (skip tiny slivers below 5% land area).
            (
              cp.fec_office_type = 'H'
              AND cp.fec_district IN (
                SELECT cd.district_number
                FROM district_county_mappings dcm
                JOIN congressional_districts cd ON dcm.district_id = cd.id
                JOIN counties c ON dcm.county_geoid = c.county_geoid
                WHERE c.state_abbr = $${paramIndex + 1}
                  AND LOWER(c.county_name) = LOWER($${paramIndex + 2})
                  AND (dcm.is_full_county = TRUE OR dcm.land_area_percent >= 5)
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

    // Query 4: When we know the exact district (from address lookup), match
    // FEC House candidates directly by fec_district. More precise than the
    // county-based Query 3 mapping.
    if (state && districtTwo && !city) {
      query += `
        UNION
        SELECT DISTINCT cp.id, cp.display_name, cp.party_affiliation, cp.official_title,
               cp.campaign_website, cp.fec_candidate_id, cp.candidate_verified,
               cp.identity_verified, cp.incumbent_verified, cp.is_shadow_profile,
               cp.qa_response_rate, cp.total_questions_received, NULL as first_name, NULL as last_name,
               'federal' as office_level,
               CASE
                 WHEN cp.fec_state = 'DC' THEN 'DC Delegate to the U.S. House (non-voting)'
                 WHEN cp.fec_district IN ('00', '98') THEN 'U.S. House At-Large'
                 ELSE 'U.S. House District ' || TRIM(LEADING '0' FROM cp.fec_district)
               END as office_name,
               'fec_district' as source
        FROM candidate_profiles cp
        WHERE cp.is_active = TRUE${nameFilter}
          AND cp.fec_state = $${paramIndex}
          AND cp.fec_office_type = 'H'
          AND (cp.fec_district = $${paramIndex + 1} OR cp.fec_district = $${paramIndex + 2})
      `;
      params.push(state, districtTwo, String(parseInt(districtTwo, 10)));
      paramIndex += 3;
    }

    // The UNION above deduplicates only when every column matches, but a
    // candidate matching both Query 1 (local office chain) and Query 2/3
    // (FEC lookups) gets a different office_name/source and slips through.
    // Wrap in a subquery and keep the single best row per candidate id.
    const wrapped = `
      SELECT * FROM (
        SELECT DISTINCT ON (id) *
        FROM ( ${query} ) raw
        ORDER BY id,
                 CASE source
                   WHEN 'local' THEN 0
                   WHEN 'fec_district' THEN 1
                   ELSE 2
                 END
      ) deduped
      ORDER BY display_name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit));
    params.push(parseInt(offset));

    const result = await db.query(wrapped, params);
    res.json({ candidates: result.rows });
  } catch (error) {
    console.error('Error in candidates by-location:', error);
    next(error);
  }
});

// Get available counties for a state — powers the Find My Ballot county dropdown
router.get('/locations/counties', async (req, res) => {
  try {
    const { state } = req.query;
    if (!state) return res.status(400).json({ error: 'state is required' });

    // Pull counties from both the reference `counties` table (gold source) and
    // from any offices that have a county set, so we cover state/local offices
    // even if the reference table is incomplete.
    const result = await db.query(
      `SELECT DISTINCT county_name AS name
       FROM (
         SELECT county_name FROM counties WHERE state_abbr = $1 AND county_name IS NOT NULL
         UNION
         SELECT county FROM offices WHERE state = $1 AND county IS NOT NULL AND county <> ''
       ) merged
       ORDER BY name`,
      [state]
    );
    res.json(result.rows.map(r => r.name));
  } catch (error) {
    console.warn('/search/locations/counties fallback:', error.message);
    res.json([]);
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

// Match candidates by issue positions
router.post('/candidates/match', async (req, res, next) => {
  try {
    const { positions, state, limit = 20 } = req.body;

    if (!positions || !Array.isArray(positions) || positions.length === 0) {
      return res.status(400).json({ error: 'positions array is required' });
    }

    // positions = [{ issueId, stance }, ...]
    // Find candidates who match the most positions
    const issueIds = positions.map(p => p.issueId);
    const stances = positions.map(p => p.stance);
    const params = [issueIds, stances];
    let paramIndex = 3;

    let query = `
      WITH match_scores AS (
        SELECT
          cp.candidate_id,
          COUNT(*) FILTER (WHERE cp.stance = up.stance) AS matches,
          COUNT(*) AS total_compared
        FROM candidate_positions cp
        JOIN (
          SELECT * FROM unnest($1::uuid[], $2::text[]) AS t(issue_id, stance)
        ) up ON cp.issue_id = up.issue_id
        GROUP BY cp.candidate_id
      )
      SELECT
        ms.matches,
        ms.total_compared,
        ROUND(ms.matches::numeric / ms.total_compared * 100) AS match_pct,
        c.id, c.display_name, c.party_affiliation, c.official_title,
        c.qa_response_rate, c.total_questions_received, c.candidate_verified, c.profile_photo_url
      FROM match_scores ms
      JOIN candidate_profiles c ON ms.candidate_id = c.id
      WHERE c.is_active = TRUE
    `;

    if (state) {
      query += ` AND c.fec_state = $${paramIndex}`;
      params.push(state);
      paramIndex++;
    }

    query += ` ORDER BY ms.matches DESC, ms.total_compared DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await db.query(query, params);
    res.json({ candidates: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;