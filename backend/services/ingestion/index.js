/**
 * Candidate Data Ingestion Service
 * 
 * Coordinates fetching and syncing candidate data from multiple sources:
 * - FEC (Federal candidates)
 * - State election commissions
 * - Ballotpedia (fallback/enrichment)
 */

const db = require('../../db');
const FECClient = require('./fecClient');
const OpenStatesClient = require('./openStatesClient');
const VoteSmartClient = require('./voteSmartClient');
const CongressLegislatorsClient = require('./congressLegislatorsClient');
const WikidataClient = require('./wikidataClient');

class IngestionService {
  constructor() {
    this.fec = new FECClient();
    this.openStates = new OpenStatesClient();
    this.voteSmart = new VoteSmartClient();
    this.congressLeg = new CongressLegislatorsClient();
    this.wikidata = new WikidataClient();
  }

  /**
   * Start a sync run for a data source
   */
  async startSyncRun(dataSourceId, metadata = {}) {
    const result = await db.query(
      `INSERT INTO sync_runs (data_source_id, metadata) 
       VALUES ($1, $2) 
       RETURNING id`,
      [dataSourceId, JSON.stringify(metadata)]
    );
    return result.rows[0].id;
  }

  /**
   * Complete a sync run
   */
  async completeSyncRun(syncRunId, stats) {
    await db.query(
      `UPDATE sync_runs SET 
        completed_at = NOW(),
        status = $2,
        records_fetched = $3,
        records_created = $4,
        records_updated = $5,
        records_unchanged = $6,
        errors_count = $7,
        error_log = $8
       WHERE id = $1`,
      [
        syncRunId,
        stats.status || 'success',
        stats.fetched || 0,
        stats.created || 0,
        stats.updated || 0,
        stats.unchanged || 0,
        stats.errors || 0,
        stats.errorLog || null
      ]
    );

    // Update data source last sync
    await db.query(
      `UPDATE data_sources SET 
        last_sync_at = NOW(),
        last_sync_status = $2,
        last_sync_error = $3
       WHERE id = (SELECT data_source_id FROM sync_runs WHERE id = $1)`,
      [syncRunId, stats.status || 'success', stats.errors > 0 ? stats.errorLog : null]
    );
  }

  /**
   * Sync all FEC candidates for a given cycle and state
   */
  async syncFECCandidates(cycle, state = null) {
    const dataSourceId = '00000000-0000-0000-0000-000000000001'; // FEC
    const syncRunId = await this.startSyncRun(dataSourceId, { cycle, state });
    
    const stats = {
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: 0,
      errorLog: ''
    };

    try {
      console.log(`Starting FEC sync for cycle ${cycle}${state ? `, state ${state}` : ''}`);
      
      // Fetch candidates
      const options = { cycle, isActiveCandidate: true };
      if (state) options.state = state;
      
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await this.fec.getCandidates({ ...options, page, perPage: 100 });
        const candidates = response.results || [];
        
        stats.fetched += candidates.length;
        console.log(`Fetched page ${page}: ${candidates.length} candidates`);
        
        for (const fecCandidate of candidates) {
          try {
            const result = await this.upsertFECCandidate(fecCandidate, dataSourceId);
            stats[result]++;
          } catch (err) {
            stats.errors++;
            stats.errorLog += `Error processing ${fecCandidate.candidate_id}: ${err.message}\n`;
            console.error(`Error processing candidate ${fecCandidate.candidate_id}:`, err.message);
          }
        }
        
        // Check for more pages
        const pagination = response.pagination;
        hasMore = pagination && pagination.pages && page < pagination.pages;
        page++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      stats.status = stats.errors > 0 ? 'partial' : 'success';
      console.log(`FEC sync complete:`, stats);
      
    } catch (err) {
      stats.status = 'failed';
      stats.errorLog = err.message;
      console.error('FEC sync failed:', err);
    }

    await this.completeSyncRun(syncRunId, stats);
    return stats;
  }

  /**
   * Upsert a single FEC candidate
   */
  async upsertFECCandidate(fecCandidate, dataSourceId) {
    const transformed = this.fec.transformCandidate(fecCandidate);
    
    // Check if we already have this candidate linked
    const existingLink = await db.query(
      `SELECT candidate_id FROM candidate_source_links 
       WHERE data_source_id = $1 AND external_id = $2`,
      [dataSourceId, fecCandidate.candidate_id]
    );

    if (existingLink.rows.length > 0) {
      // Update existing candidate
      const candidateId = existingLink.rows[0].candidate_id;
      
      await db.query(
        `UPDATE candidate_profiles SET
          party_affiliation = COALESCE($2, party_affiliation),
          fec_candidate_id = $3,
          verification_source = 'fec',
          verification_external_id = $3,
          verification_last_checked = NOW(),
          candidate_verified = TRUE,
          candidate_verified_at = COALESCE(candidate_verified_at, NOW()),
          updated_at = NOW()
         WHERE id = $1`,
        [candidateId, transformed.partyAffiliation, fecCandidate.candidate_id]
      );

      // Update the source link
      await db.query(
        `UPDATE candidate_source_links SET
          external_data = $3,
          last_verified_at = NOW(),
          verification_status = 'verified'
         WHERE data_source_id = $1 AND external_id = $2`,
        [dataSourceId, fecCandidate.candidate_id, JSON.stringify(fecCandidate)]
      );

      return 'updated';
    }

    // Try to match existing candidate by normalized name and state
    // Uses normalize_candidate_name() from migration 020 to handle:
    //   case differences, middle names, suffixes, name format differences
    const nameMatch = await db.query(
      `SELECT cp.id FROM candidate_profiles cp
       WHERE normalize_candidate_name(cp.display_name) = normalize_candidate_name($1)
         AND (cp.fec_state = $2 OR cp.fec_state IS NULL)
       ORDER BY CASE WHEN cp.fec_state = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [transformed.displayName, transformed.state]
    );

    let candidateId;

    if (nameMatch.rows.length > 0) {
      // Link to existing candidate
      candidateId = nameMatch.rows[0].id;
      
      await db.query(
        `UPDATE candidate_profiles SET
          party_affiliation = COALESCE($2, party_affiliation),
          fec_candidate_id = $3,
          verification_source = 'fec',
          verification_external_id = $3,
          verification_last_checked = NOW(),
          candidate_verified = TRUE,
          candidate_verified_at = COALESCE(candidate_verified_at, NOW()),
          updated_at = NOW()
         WHERE id = $1`,
        [candidateId, transformed.partyAffiliation, fecCandidate.candidate_id]
      );
    } else {
      // Create new candidate
      const insertResult = await db.query(
        `INSERT INTO candidate_profiles (
          display_name, party_affiliation, fec_candidate_id,
          fec_office_type, fec_state, fec_district,
          verification_source, verification_external_id, verification_last_checked,
          candidate_verified, candidate_verified_at,
          is_shadow_profile, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, 'fec', $3, NOW(), TRUE, NOW(), TRUE, TRUE)
        RETURNING id`,
        [
          transformed.displayName, transformed.partyAffiliation, fecCandidate.candidate_id,
          fecCandidate.candidate_id?.[0] || null,
          fecCandidate.candidate_id?.substring(2, 4) || null,
          fecCandidate.candidate_id?.[0] === 'H' ? fecCandidate.candidate_id?.substring(4, 6) : null,
        ]
      );
      candidateId = insertResult.rows[0].id;

      // Create office if needed
      await this.ensureFederalOffice(transformed);
    }

    // Create source link
    await db.query(
      `INSERT INTO candidate_source_links (
        candidate_id, data_source_id, external_id, external_data
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (data_source_id, external_id) DO UPDATE SET
        candidate_id = $1,
        external_data = $4,
        last_verified_at = NOW()`,
      [candidateId, dataSourceId, fecCandidate.candidate_id, JSON.stringify(fecCandidate)]
    );

    return nameMatch.rows.length > 0 ? 'updated' : 'created';
  }

  /**
   * Ensure federal office exists
   */
  async ensureFederalOffice(transformed) {
    let officeName;
    let district = null;
    
    if (transformed.officeName?.includes('House')) {
      officeName = `U.S. House ${transformed.state}-${transformed.district}`;
      district = transformed.district;
    } else if (transformed.officeName?.includes('Senator')) {
      officeName = `U.S. Senator - ${transformed.state}`;
    } else if (transformed.officeName?.includes('President')) {
      officeName = 'President of the United States';
    } else {
      return null;
    }

    const existing = await db.query(
      `SELECT id FROM offices WHERE name = $1`,
      [officeName]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }

    const result = await db.query(
      `INSERT INTO offices (name, office_level, state, district, term_length_years)
       VALUES ($1, 'federal', $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        officeName,
        transformed.state,
        district,
        transformed.officeName?.includes('Senator') ? 6 :
        transformed.officeName?.includes('President') ? 4 : 2
      ]
    );

    return result.rows[0]?.id;
  }

  /**
   * Verify a candidate against FEC data
   */
  async verifyCandidate(candidateId) {
    // Get candidate's FEC ID if we have it
    const candidate = await db.query(
      `SELECT fec_candidate_id, display_name FROM candidate_profiles WHERE id = $1`,
      [candidateId]
    );

    if (!candidate.rows[0]) {
      return { verified: false, error: 'Candidate not found' };
    }

    const { fec_candidate_id, display_name } = candidate.rows[0];

    try {
      let fecData;
      
      if (fec_candidate_id) {
        // Direct lookup
        const response = await this.fec.getCandidate(fec_candidate_id);
        fecData = response.results?.[0];
      } else {
        // Search by name
        const response = await this.fec.searchCandidates(display_name);
        fecData = response.results?.[0];
      }

      if (fecData) {
        await db.query(
          `UPDATE candidate_profiles SET
            fec_candidate_id = $2,
            verification_source = 'fec',
            verification_external_id = $2,
            verification_last_checked = NOW(),
            candidate_verified = TRUE,
            candidate_verified_at = COALESCE(candidate_verified_at, NOW())
           WHERE id = $1`,
          [candidateId, fecData.candidate_id]
        );

        return { 
          verified: true, 
          fecId: fecData.candidate_id,
          match: fecData 
        };
      }

      return { verified: false, error: 'No FEC match found' };

    } catch (err) {
      return { verified: false, error: err.message };
    }
  }

  /**
   * Get sync status for all data sources
   */
  async getSyncStatus() {
    const result = await db.query(`
      SELECT 
        ds.*,
        sr.started_at as last_run_started,
        sr.completed_at as last_run_completed,
        sr.status as last_run_status,
        sr.records_fetched,
        sr.records_created,
        sr.records_updated,
        sr.errors_count
      FROM data_sources ds
      LEFT JOIN LATERAL (
        SELECT * FROM sync_runs 
        WHERE data_source_id = ds.id 
        ORDER BY started_at DESC 
        LIMIT 1
      ) sr ON true
      ORDER BY ds.name
    `);
    return result.rows;
  }

  /**
   * Get all candidates from a specific source
   */
  async getCandidatesBySource(sourceName) {
    const result = await db.query(`
      SELECT cp.*, csl.external_id, csl.last_verified_at, csl.verification_status
      FROM candidate_profiles cp
      JOIN candidate_source_links csl ON cp.id = csl.candidate_id
      JOIN data_sources ds ON csl.data_source_id = ds.id
      WHERE ds.name = $1
      ORDER BY cp.display_name
    `, [sourceName]);
    return result.rows;
  }

  // =========================================================================
  // OPEN STATES INTEGRATION
  // =========================================================================

  /**
   * Sync all state legislators from Open States
   * @param {string} state - Optional: sync only this state (2-letter code)
   */
  async syncOpenStatesLegislators(state = null) {
    const dataSourceId = '00000000-0000-0000-0000-000000000004'; // Open States
    
    // Ensure data source exists
    await this.ensureOpenStatesSource();
    
    const syncRunId = await this.startSyncRun(dataSourceId, { state });
    
    const stats = {
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: 0,
      errorLog: ''
    };

    try {
      console.log(`Starting Open States sync${state ? ` for ${state}` : ' for all states'}...`);
      
      if (state) {
        // Sync single state
        const legislators = await this.openStates.getStateLegislators(state);
        stats.fetched = legislators.length;
        console.log(`Fetched ${legislators.length} legislators from ${state}`);
        
        for (const person of legislators) {
          try {
            const result = await this.upsertOpenStatesPerson(person, dataSourceId);
            stats[result]++;
          } catch (err) {
            stats.errors++;
            stats.errorLog += `Error processing ${person.id}: ${err.message}\n`;
            console.error(`Error processing ${person.id}:`, err.message);
          }
        }
      } else {
        // Sync all states with rotation — pick up where last run stopped
        // Read last synced state from a simple tracking table
        await db.query(`CREATE TABLE IF NOT EXISTS _sync_state (key VARCHAR(100) PRIMARY KEY, value TEXT, updated_at TIMESTAMP DEFAULT NOW())`);
        let lastSyncedState = null;
        try {
          const row = await db.query(`SELECT value FROM _sync_state WHERE key = 'openstates_last_state'`);
          if (row.rows.length > 0) lastSyncedState = row.rows[0].value;
        } catch (_e) { /* first run */ }

        console.log(`Last synced state: ${lastSyncedState || 'none (starting from AL)'}`);

        const allResults = await this.openStates.getAllStateLegislators((progress) => {
          console.log(`Progress: ${progress.state} (${progress.current}/${progress.total}) - ${progress.percent}%`);
        }, 200, lastSyncedState);

        for (const stateResult of allResults) {
          stats.fetched += stateResult.count;

          if (stateResult.error) {
            stats.errors++;
            stats.errorLog += `Error fetching ${stateResult.state}: ${stateResult.error}\n`;
            continue;
          }

          for (const person of stateResult.legislators) {
            try {
              const result = await this.upsertOpenStatesPerson(person, dataSourceId);
              stats[result]++;
            } catch (err) {
              stats.errors++;
              stats.errorLog += `Error processing ${person.id}: ${err.message}\n`;
            }
          }
        }

        // Save last synced state so next run picks up where we left off
        if (allResults.lastSyncedState) {
          await db.query(
            `INSERT INTO _sync_state (key, value, updated_at) VALUES ('openstates_last_state', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [allResults.lastSyncedState]
          );
          console.log(`Saved resume point: next run will start after ${allResults.lastSyncedState}`);
        }
      }
      
      stats.status = stats.errors > 0 ? 'partial' : 'success';
      console.log(`Open States sync complete:`, stats);
      
    } catch (err) {
      stats.status = 'failed';
      stats.errorLog = err.message;
      console.error('Open States sync failed:', err);
    }

    await this.completeSyncRun(syncRunId, stats);
    return stats;
  }

  /**
   * Ensure Open States data source exists
   */
  async ensureOpenStatesSource() {
    await db.query(`
      INSERT INTO data_sources (id, name, display_name, source_type, base_url, api_key_env_var, sync_frequency_hours)
      VALUES (
        '00000000-0000-0000-0000-000000000004',
        'open_states',
        'Open States / Plural Policy',
        'api',
        'https://v3.openstates.org',
        'OPEN_STATES_API_KEY',
        168
      )
      ON CONFLICT (name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        base_url = EXCLUDED.base_url
    `);
  }

  /**
   * Upsert a single Open States person
   */
  async upsertOpenStatesPerson(person, dataSourceId) {
    const transformed = this.openStates.transformPerson(person);
    
    // Check if we already have this person linked
    const existingLink = await db.query(
      `SELECT candidate_id FROM candidate_source_links 
       WHERE data_source_id = $1 AND external_id = $2`,
      [dataSourceId, person.id]
    );

    if (existingLink.rows.length > 0) {
      // Update existing candidate
      const candidateId = existingLink.rows[0].candidate_id;
      
      await db.query(
        `UPDATE candidate_profiles SET
          display_name = $2,
          party_affiliation = COALESCE($3, party_affiliation),
          official_title = $4,
          campaign_website = COALESCE($5, campaign_website),
          campaign_email = COALESCE($6, campaign_email),
          campaign_phone = COALESCE($7, campaign_phone),
          twitter_handle = COALESCE($8, twitter_handle),
          facebook_handle = COALESCE($9, facebook_handle),
          verification_source = 'open_states',
          verification_external_id = $10,
          open_states_id = $10,
          verification_last_checked = NOW(),
          candidate_verified = TRUE,
          updated_at = NOW()
         WHERE id = $1`,
        [
          candidateId,
          transformed.displayName,
          transformed.partyAffiliation,
          transformed.currentTitle,
          transformed.website,
          transformed.email,
          transformed.phone,
          transformed.twitter,
          transformed.facebook,
          person.id
        ]
      );

      // Update source link
      await db.query(
        `UPDATE candidate_source_links SET
          external_data = $3,
          last_verified_at = NOW(),
          verification_status = 'verified'
         WHERE data_source_id = $1 AND external_id = $2`,
        [dataSourceId, person.id, JSON.stringify(person)]
      );

      return 'updated';
    }

    // Try to match by name and state
    // First try exact match, then try last name + first initial match
    // FEC format: "LASTNAME, FIRSTNAME M." — Open States format: "Firstname Lastname"
    const lastName = (transformed.lastName || '').trim();
    const firstName = (transformed.firstName || '').trim();

    const nameMatch = await db.query(
      `SELECT cp.id, cp.display_name FROM candidate_profiles cp
       WHERE (cp.fec_state = $1 OR cp.fec_state IS NULL)
         AND normalize_candidate_name(cp.display_name) = normalize_candidate_name($2)
       ORDER BY CASE WHEN cp.fec_state = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [transformed.state, transformed.displayName]
    );

    let candidateId;

    if (nameMatch.rows.length > 0) {
      // Link to existing candidate
      candidateId = nameMatch.rows[0].id;
      
      await db.query(
        `UPDATE candidate_profiles SET
          party_affiliation = COALESCE($2, party_affiliation),
          official_title = COALESCE($3, official_title),
          campaign_website = COALESCE($4, campaign_website),
          campaign_email = COALESCE($5, campaign_email),
          campaign_phone = COALESCE($6, campaign_phone),
          twitter_handle = COALESCE($7, twitter_handle),
          facebook_handle = COALESCE($8, facebook_handle),
          verification_source = 'open_states',
          verification_external_id = $9,
          open_states_id = $9,
          verification_last_checked = NOW(),
          candidate_verified = TRUE,
          updated_at = NOW()
         WHERE id = $1`,
        [
          candidateId,
          transformed.partyAffiliation,
          transformed.currentTitle,
          transformed.website,
          transformed.email,
          transformed.phone,
          transformed.twitter,
          transformed.facebook,
          person.id
        ]
      );
    } else {
      // Create new candidate
      const insertResult = await db.query(
        `INSERT INTO candidate_profiles (
          display_name, party_affiliation, official_title,
          campaign_website, campaign_email, campaign_phone,
          twitter_handle, facebook_handle,
          verification_source, verification_external_id, open_states_id, verification_last_checked,
          candidate_verified, candidate_verified_at,
          is_shadow_profile, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open_states', $9, $9, NOW(), TRUE, NOW(), TRUE, TRUE)
        RETURNING id`,
        [
          transformed.displayName,
          transformed.partyAffiliation,
          transformed.currentTitle,
          transformed.website,
          transformed.email,
          transformed.phone,
          transformed.twitter,
          transformed.facebook,
          person.id
        ]
      );
      candidateId = insertResult.rows[0].id;

      // Create office and candidacy
      await this.ensureStateLegislatorOffice(transformed, candidateId);
    }

    // Create/update source link
    await db.query(
      `INSERT INTO candidate_source_links (
        candidate_id, data_source_id, external_id, external_data, verification_status
      ) VALUES ($1, $2, $3, $4, 'verified')
      ON CONFLICT (data_source_id, external_id) DO UPDATE SET
        candidate_id = $1,
        external_data = $4,
        last_verified_at = NOW(),
        verification_status = 'verified'`,
      [candidateId, dataSourceId, person.id, JSON.stringify(person)]
    );

    return nameMatch.rows.length > 0 ? 'updated' : 'created';
  }

  /**
   * Ensure state legislator office exists and create candidacy
   */
  async ensureStateLegislatorOffice(transformed, candidateId) {
    if (!transformed.state || !transformed.officeName) {
      return null;
    }

    // Create or get office
    let officeId;
    const existingOffice = await db.query(
      `SELECT id FROM offices WHERE name = $1 AND state = $2`,
      [transformed.officeName, transformed.state]
    );

    if (existingOffice.rows.length > 0) {
      officeId = existingOffice.rows[0].id;
    } else {
      // Determine term length based on chamber
      const termLength = transformed.chamber === 'Senate' ? 4 : 2;
      
      const officeResult = await db.query(
        `INSERT INTO offices (name, office_level, state, district, term_length_years)
         VALUES ($1, 'state', $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [transformed.officeName, transformed.state, transformed.district, termLength]
      );
      
      if (officeResult.rows[0]) {
        officeId = officeResult.rows[0].id;
      } else {
        // Get it if insert didn't return (already existed)
        const getOffice = await db.query(
          `SELECT id FROM offices WHERE name = $1 AND state = $2`,
          [transformed.officeName, transformed.state]
        );
        officeId = getOffice.rows[0]?.id;
      }
    }

    if (!officeId) return null;

    // Find or create election (current term)
    const currentYear = new Date().getFullYear();
    const electionYear = currentYear % 2 === 0 ? currentYear : currentYear - 1;
    
    let electionId;
    const existingElection = await db.query(
      `SELECT id FROM elections 
       WHERE state = $1 
         AND EXTRACT(YEAR FROM election_date) = $2
         AND election_type = 'general'
       LIMIT 1`,
      [transformed.state, electionYear]
    );

    if (existingElection.rows.length > 0) {
      electionId = existingElection.rows[0].id;
    } else {
      // Create general election for this state/year
      const electionResult = await db.query(
        `INSERT INTO elections (name, election_date, election_type, scope, state)
         VALUES ($1, $2, 'general', 'state', $3)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          `${electionYear} ${transformed.state} General Election`,
          `${electionYear}-11-05`,
          transformed.state
        ]
      );
      electionId = electionResult.rows[0]?.id;
    }

    if (!electionId) return null;

    // Find or create race
    let raceId;
    const existingRace = await db.query(
      `SELECT id FROM races WHERE office_id = $1 AND election_id = $2`,
      [officeId, electionId]
    );

    if (existingRace.rows.length > 0) {
      raceId = existingRace.rows[0].id;
    } else {
      const raceResult = await db.query(
        `INSERT INTO races (office_id, election_id, name, is_special_election)
         VALUES ($1, $2, 'General', FALSE)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [officeId, electionId]
      );
      raceId = raceResult.rows[0]?.id;
    }

    if (!raceId) return null;

    // Create candidacy (link candidate to race)
    await db.query(
      `INSERT INTO candidacies (candidate_id, race_id, filing_status, filed_at)
       VALUES ($1, $2, 'certified', NOW())
       ON CONFLICT (candidate_id, race_id) DO UPDATE SET
         filing_status = 'certified',
         updated_at = NOW()`,
      [candidateId, raceId]
    );

    return officeId;
  }

  /**
   * Sync a single state from Open States
   */
  async syncOpenStatesState(state) {
    return this.syncOpenStatesLegislators(state.toUpperCase());
  }

  // =========================================================================
  // CONGRESS-LEGISLATORS DATASET (github.com/unitedstates/congress-legislators)
  // =========================================================================

  /**
   * Sync current legislators from the unitedstates/congress-legislators dataset.
   * Updates social media, cross-reference IDs, contact info, and links to
   * existing FEC/Congress.gov profiles by FEC ID or name match.
   */
  async syncCongressLegislators() {
    const stats = {
      fetched: 0, created: 0, updated: 0, unchanged: 0,
      errors: 0, errorLog: ''
    };

    try {
      console.log('Fetching congress-legislators dataset...');
      const legislators = await this.congressLeg.getLegislatorsWithSocial();
      stats.fetched = legislators.length;
      console.log(`Fetched ${legislators.length} current legislators`);

      for (const leg of legislators) {
        try {
          const transformed = this.congressLeg.transformLegislator(leg);
          if (!transformed) { stats.unchanged++; continue; }

          // Try to match by FEC ID first
          let candidateId = null;
          if (transformed.fecIds.length > 0) {
            for (const fecId of transformed.fecIds) {
              const match = await db.query(
                `SELECT id FROM candidate_profiles WHERE fec_candidate_id = $1 LIMIT 1`,
                [fecId]
              );
              if (match.rows.length > 0) {
                candidateId = match.rows[0].id;
                break;
              }
            }
          }

          // Try bioguide match via congress_gov_id
          if (!candidateId && transformed.bioguideId) {
            const match = await db.query(
              `SELECT id FROM candidate_profiles WHERE congress_gov_id = $1 LIMIT 1`,
              [transformed.bioguideId]
            );
            if (match.rows.length > 0) candidateId = match.rows[0].id;
          }

          // Try name match
          if (!candidateId) {
            const match = await db.query(
              `SELECT id FROM candidate_profiles
               WHERE LOWER(display_name) = LOWER($1) AND fec_state = $2
               LIMIT 1`,
              [transformed.displayName, transformed.state]
            );
            if (match.rows.length > 0) candidateId = match.rows[0].id;
          }

          if (candidateId) {
            // Update existing profile with enrichment data
            await db.query(
              `UPDATE candidate_profiles SET
                twitter_handle = COALESCE($2, twitter_handle),
                facebook_handle = COALESCE($3, facebook_handle),
                instagram_handle = COALESCE($4, instagram_handle),
                youtube_handle = COALESCE($5, youtube_handle),
                campaign_website = COALESCE($6, campaign_website),
                campaign_phone = COALESCE($7, campaign_phone),
                profile_photo_url = COALESCE(profile_photo_url, $8),
                vote_smart_candidate_id = COALESCE(vote_smart_candidate_id, $9),
                party_affiliation = COALESCE($10, party_affiliation),
                congress_gov_id = COALESCE($11, congress_gov_id),
                govtrack_id = COALESCE($12, govtrack_id),
                wikipedia_id = COALESCE($13, wikipedia_id),
                wikidata_id = COALESCE($14, wikidata_id),
                updated_at = NOW()
               WHERE id = $1`,
              [
                candidateId,
                transformed.twitter,
                transformed.facebook,
                transformed.instagram,
                transformed.youtube,
                transformed.website,
                transformed.phone,
                transformed.bioguideId ? `https://bioguide.congress.gov/search/bio/${transformed.bioguideId}.jpg` : null,
                transformed.voteSmartId ? String(transformed.voteSmartId) : null,
                transformed.party,
                transformed.bioguideId,
                transformed.govtrackId ? String(transformed.govtrackId) : null,
                transformed.wikipediaId,
                transformed.wikidataId
              ]
            );
            stats.updated++;
          } else {
            stats.unchanged++;
          }
        } catch (err) {
          stats.errors++;
          stats.errorLog += `Error: ${leg.name?.official_full}: ${err.message}\n`;
        }
      }

      stats.status = stats.errors > 0 ? 'partial' : 'success';
      console.log('Congress-legislators sync complete:', stats);
    } catch (err) {
      stats.status = 'failed';
      stats.errorLog = err.message;
      console.error('Congress-legislators sync failed:', err);
    }

    return stats;
  }

  // =========================================================================
  // WIKIDATA ENRICHMENT
  // =========================================================================

  /**
   * Enrich candidates with education and bio data from Wikidata.
   * Works by looking up candidates that have a bioguide ID (federal legislators)
   * and querying Wikidata SPARQL for education, birth info, and photos.
   */
  async syncWikidata() {
    const stats = {
      fetched: 0, created: 0, updated: 0, unchanged: 0,
      errors: 0, errorLog: ''
    };

    try {
      console.log('Starting Wikidata enrichment...');

      // Get candidates with bioguide IDs that haven't been enriched yet
      const candidates = await db.query(`
        SELECT cp.id, cp.display_name, cp.congress_gov_id
        FROM candidate_profiles cp
        WHERE cp.congress_gov_id IS NOT NULL
          AND cp.is_active = TRUE
          AND cp.id NOT IN (
            SELECT DISTINCT candidate_id FROM candidate_education WHERE source = 'wikidata'
          )
        ORDER BY cp.display_name
      `);

      console.log(`Found ${candidates.rows.length} candidates to enrich from Wikidata`);

      // Process in batches of 50 (Wikidata batch query limit)
      const batchSize = 50;
      for (let i = 0; i < candidates.rows.length; i += batchSize) {
        const batch = candidates.rows.slice(i, i + batchSize);
        const bioguideIds = batch.map(c => c.congress_gov_id).filter(Boolean);

        if (bioguideIds.length === 0) continue;

        try {
          // Batch fetch education data
          const educationMap = await this.wikidata.getBatchEducation(bioguideIds);
          // Batch fetch bio data
          const bioMap = await this.wikidata.getBatchBios(bioguideIds);

          stats.fetched += bioguideIds.length;

          for (const candidate of batch) {
            const bioguideId = candidate.congress_gov_id;
            if (!bioguideId) continue;

            let enriched = false;

            // Store education records
            const education = educationMap[bioguideId] || [];
            for (const edu of education) {
              if (!edu.institution) continue;
              await db.query(
                `INSERT INTO candidate_education (
                  candidate_id, institution_name, degree, field_of_study,
                  graduation_year, source
                ) VALUES ($1, $2, $3, $4, $5, 'wikidata')
                ON CONFLICT DO NOTHING`,
                [candidate.id, edu.institution, edu.degree, edu.field, edu.endYear]
              );
              enriched = true;
            }

            // Update photo if available
            const bio = bioMap[bioguideId];
            if (bio?.photoUrl) {
              await db.query(
                `UPDATE candidate_profiles SET
                  profile_photo_url = COALESCE(profile_photo_url, $2),
                  updated_at = NOW()
                 WHERE id = $1`,
                [candidate.id, bio.photoUrl]
              );
              enriched = true;
            }

            if (enriched) {
              stats.updated++;
            } else {
              stats.unchanged++;
            }
          }

          // Rate limiting — be gentle with Wikidata
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (err) {
          if (err.message === 'RATE_LIMITED') {
            console.log('Wikidata rate limited — stopping');
            stats.errorLog += `Rate limited after ${stats.fetched} candidates\n`;
            break;
          }
          stats.errors++;
          stats.errorLog += `Batch error: ${err.message}\n`;
          console.error('Wikidata batch error:', err.message);
        }
      }

      stats.status = stats.errors > 0 ? 'partial' : 'success';
      console.log('Wikidata enrichment complete:', stats);
    } catch (err) {
      stats.status = 'failed';
      stats.errorLog = err.message;
      console.error('Wikidata sync failed:', err);
    }

    return stats;
  }

  // =========================================================================
  // VOTE SMART INTEGRATION
  // =========================================================================

  /**
   * Sync VoteSmart data for all candidates that have a vote_smart_candidate_id,
   * or attempt to match candidates without one.
   * @param {string} state - Optional: limit to candidates in this state
   */
  async syncVoteSmart(state = null) {
    if (!process.env.VOTE_SMART_API_KEY) {
      console.log('VOTE_SMART_API_KEY not set — skipping VoteSmart sync');
      return { status: 'skipped', reason: 'No API key' };
    }

    const dataSourceId = '00000000-0000-0000-0000-000000000005'; // Vote Smart
    await this.ensureVoteSmartSource();
    const syncRunId = await this.startSyncRun(dataSourceId, { state });

    const stats = {
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      matched: 0,
      errors: 0,
      errorLog: ''
    };

    try {
      console.log(`Starting VoteSmart sync${state ? ` for ${state}` : ''}...`);

      // Step 1: Find candidates to enrich
      let query = `
        SELECT id, display_name, vote_smart_candidate_id, fec_state, fec_office_type,
               party_affiliation
        FROM candidate_profiles
        WHERE is_active = TRUE
      `;
      const params = [];

      if (state) {
        params.push(state);
        query += ` AND fec_state = $${params.length}`;
      }

      query += ' ORDER BY display_name';
      const candidates = await db.query(query, params);
      console.log(`Found ${candidates.rows.length} candidates to process`);

      for (const candidate of candidates.rows) {
        try {
          let vsId = candidate.vote_smart_candidate_id;

          // Step 2: Match unlinked candidates by name search
          if (!vsId) {
            vsId = await this.matchVoteSmartCandidate(candidate);
            if (vsId) {
              stats.matched++;
              await db.query(
                `UPDATE candidate_profiles SET vote_smart_candidate_id = $2, updated_at = NOW() WHERE id = $1`,
                [candidate.id, vsId]
              );
            }
          }

          if (!vsId) {
            stats.unchanged++;
            continue;
          }

          // Step 3: Fetch and store enrichment data
          const enriched = await this.enrichFromVoteSmart(candidate.id, vsId);
          stats.fetched++;

          if (enriched) {
            stats.updated++;
          } else {
            stats.unchanged++;
          }

          // Rate limiting — be gentle
          await new Promise(resolve => setTimeout(resolve, 250));

        } catch (err) {
          if (err.message === 'RATE_LIMITED' || err.message.includes('budget exceeded')) {
            console.log('VoteSmart rate limit hit — stopping');
            stats.errorLog += `Rate limited after ${stats.fetched} candidates\n`;
            break;
          }
          stats.errors++;
          stats.errorLog += `Error processing ${candidate.display_name}: ${err.message}\n`;
          console.error(`VoteSmart error for ${candidate.display_name}:`, err.message);
        }
      }

      stats.status = stats.errors > 0 ? 'partial' : 'success';
      console.log('VoteSmart sync complete:', stats);

    } catch (err) {
      stats.status = 'failed';
      stats.errorLog = err.message;
      console.error('VoteSmart sync failed:', err);
    }

    await this.completeSyncRun(syncRunId, stats);
    return stats;
  }

  /**
   * Try to match a candidate to a VoteSmart ID by last name + state
   */
  async matchVoteSmartCandidate(candidate) {
    const displayName = candidate.display_name || '';
    // Extract last name — handle "LASTNAME, FIRSTNAME" and "Firstname Lastname" formats
    let lastName;
    if (displayName.includes(',')) {
      lastName = displayName.split(',')[0].trim();
    } else {
      const parts = displayName.trim().split(/\s+/);
      lastName = parts[parts.length - 1];
    }

    if (!lastName || lastName.length < 2) return null;

    try {
      const results = await this.voteSmart.searchByLastName(lastName, candidate.fec_state);

      if (!results || results.length === 0) return null;

      // Try to find a match by first name too
      const firstNameFromDisplay = displayName.includes(',')
        ? displayName.split(',')[1]?.trim().split(/\s+/)[0]
        : displayName.trim().split(/\s+/)[0];

      const firstLower = (firstNameFromDisplay || '').toLowerCase();

      const match = results.find(r => {
        const rFirst = (r.firstName || '').toLowerCase();
        const rLast = (r.lastName || '').toLowerCase();
        return rLast === lastName.toLowerCase() && (
          rFirst === firstLower ||
          rFirst.startsWith(firstLower) ||
          firstLower.startsWith(rFirst)
        );
      });

      return match?.candidateId || null;

    } catch (err) {
      // No results is not an error
      if (err.message.includes('No candidates')) return null;
      throw err;
    }
  }

  /**
   * Fetch all enrichment data from VoteSmart for a single candidate
   */
  async enrichFromVoteSmart(candidateId, voteSmartId) {
    let enriched = false;

    // 1. Bio (education, experience, etc.)
    try {
      const bio = await this.voteSmart.getDetailedBio(voteSmartId);
      const transformed = this.voteSmart.transformBio(bio);

      if (transformed) {
        // Update candidate photo if we don't have one
        if (transformed.photo) {
          await db.query(
            `UPDATE candidate_profiles SET
              profile_photo_url = COALESCE(profile_photo_url, $2),
              updated_at = NOW()
             WHERE id = $1`,
            [candidateId, transformed.photo]
          );
        }

        // Education
        for (const edu of transformed.education) {
          if (!edu.institution) continue;
          await db.query(
            `INSERT INTO candidate_education (
              candidate_id, institution_name, degree, field_of_study,
              graduation_year, source, vote_smart_id
            ) VALUES ($1, $2, $3, $4, $5, 'vote_smart', $6)
            ON CONFLICT DO NOTHING`,
            [candidateId, edu.institution, edu.degree, edu.field,
             edu.graduationYear, voteSmartId]
          );
          enriched = true;
        }

        // Professional experience
        for (const exp of transformed.profession) {
          if (!exp.organization) continue;
          await db.query(
            `INSERT INTO candidate_professional_experience (
              candidate_id, title, organization, start_year, end_year,
              is_current, source, vote_smart_id
            ) VALUES ($1, $2, $3, $4, $5, $6, 'vote_smart', $7)
            ON CONFLICT DO NOTHING`,
            [candidateId, exp.title, exp.organization, exp.startYear,
             exp.endYear, exp.isCurrent, voteSmartId]
          );
          enriched = true;
        }

        // Political experience
        for (const pol of transformed.political) {
          if (!pol.title) continue;
          await db.query(
            `INSERT INTO candidate_political_experience (
              candidate_id, title, office_name, state, district,
              start_year, end_year, is_current, source, vote_smart_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'vote_smart', $9)
            ON CONFLICT DO NOTHING`,
            [candidateId, pol.title, pol.office, pol.state, pol.district,
             pol.startYear, pol.endYear, pol.isCurrent, voteSmartId]
          );
          enriched = true;
        }

        // Org memberships
        for (const org of transformed.orgMembership) {
          if (!org.name) continue;
          await db.query(
            `INSERT INTO candidate_org_memberships (
              candidate_id, organization_name, role, is_current, source
            ) VALUES ($1, $2, $3, $4, 'vote_smart')
            ON CONFLICT DO NOTHING`,
            [candidateId, org.name, org.role, org.isCurrent]
          );
          enriched = true;
        }
      }
    } catch (err) {
      console.error(`  Bio fetch failed for VS:${voteSmartId}: ${err.message}`);
    }

    // 2. Interest group ratings
    try {
      const ratings = await this.voteSmart.getRatings(voteSmartId);

      for (const rating of ratings) {
        const tr = this.voteSmart.transformRating(rating);

        // Ensure interest group exists
        let groupId = null;
        if (tr.sigId) {
          const existingGroup = await db.query(
            `SELECT id FROM interest_groups WHERE vote_smart_sig_id = $1`,
            [tr.sigId]
          );

          if (existingGroup.rows.length > 0) {
            groupId = existingGroup.rows[0].id;
          } else {
            const groupInsert = await db.query(
              `INSERT INTO interest_groups (name, vote_smart_sig_id, category)
               VALUES ($1, $2, $3)
               ON CONFLICT (vote_smart_sig_id) DO UPDATE SET name = $1
               RETURNING id`,
              [tr.sigName, tr.sigId, tr.categories[0] || null]
            );
            groupId = groupInsert.rows[0]?.id;
          }
        }

        await db.query(
          `INSERT INTO interest_group_ratings (
            candidate_id, interest_group_id, rating, rating_score,
            rating_name, rating_text, time_span, rating_year,
            sig_name, source, vote_smart_rating_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'vote_smart', $10)
          ON CONFLICT (candidate_id, interest_group_id, time_span, rating_name)
          DO UPDATE SET rating_score = $4, rating_text = $6`,
          [candidateId, groupId, tr.ratingScore?.toString() || 'N/A',
           tr.ratingScore, tr.ratingName, tr.ratingText, tr.timeSpan,
           tr.ratingYear, tr.sigName, rating.ratingId || null]
        );
        enriched = true;
      }
    } catch (err) {
      console.error(`  Ratings fetch failed for VS:${voteSmartId}: ${err.message}`);
    }

    // 3. Create/update source link
    await db.query(
      `INSERT INTO candidate_source_links (
        candidate_id, data_source_id, external_id, verification_status
      ) VALUES ($1, '00000000-0000-0000-0000-000000000005', $2, 'verified')
      ON CONFLICT (data_source_id, external_id) DO UPDATE SET
        candidate_id = $1,
        last_verified_at = NOW(),
        verification_status = 'verified'`,
      [candidateId, voteSmartId]
    );

    return enriched;
  }

  /**
   * Ensure Vote Smart data source entry exists
   */
  async ensureVoteSmartSource() {
    await db.query(`
      INSERT INTO data_sources (id, name, display_name, source_type, base_url, api_key_env_var, sync_frequency_hours)
      VALUES (
        '00000000-0000-0000-0000-000000000005',
        'vote_smart',
        'Vote Smart',
        'api',
        'https://api.votesmart.org',
        'VOTE_SMART_API_KEY',
        168
      )
      ON CONFLICT (name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        base_url = EXCLUDED.base_url
    `);
  }
}

module.exports = new IngestionService();