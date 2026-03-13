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

class IngestionService {
  constructor() {
    this.fec = new FECClient();
    this.openStates = new OpenStatesClient();
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

    // Try to match existing candidate by name and state
    const nameMatch = await db.query(
      `SELECT cp.id FROM candidate_profiles cp
       LEFT JOIN candidacies c ON cp.id = c.candidate_id
       LEFT JOIN races r ON c.race_id = r.id
       LEFT JOIN offices o ON r.office_id = o.id
       WHERE LOWER(cp.display_name) = LOWER($1)
         AND (o.state = $2 OR o.office_level = 'federal')
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
    const nameMatch = await db.query(
      `SELECT cp.id FROM candidate_profiles cp
       LEFT JOIN candidacies c ON cp.id = c.candidate_id
       LEFT JOIN races r ON c.race_id = r.id
       LEFT JOIN offices o ON r.office_id = o.id
       WHERE LOWER(cp.display_name) = LOWER($1)
         AND (o.state = $2 OR $2 IS NULL)
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
          official_title = COALESCE($3, official_title),
          campaign_website = COALESCE($4, campaign_website),
          campaign_email = COALESCE($5, campaign_email),
          campaign_phone = COALESCE($6, campaign_phone),
          twitter_handle = COALESCE($7, twitter_handle),
          verification_source = 'open_states',
          verification_external_id = $8,
          open_states_id = $8,
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
}

module.exports = new IngestionService();