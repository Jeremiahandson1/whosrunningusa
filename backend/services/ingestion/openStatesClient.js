/**
 * Open States API Client
 * 
 * Fetches state legislator data from Open States (Plural Policy)
 * API Docs: https://docs.openstates.org/api-v3/
 * 
 * Get API key at: https://open.pluralpolicy.com/accounts/profile/
 */

const BASE_URL = 'https://v3.openstates.org';

class OpenStatesClient {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.OPEN_STATES_API_KEY;
    if (!this.apiKey) {
      console.warn('OPEN_STATES_API_KEY not set - Open States API calls will fail');
    }
    
    // Rate limiting: Open States = 10 requests/minute
    this.requestDelay = 6500; // ms between requests (6.5 sec for 10/min limit)
    this.lastRequestTime = 0;
  }

  /**
   * Sleep helper for rate limiting
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make rate-limited API request
   */
  async request(endpoint, params = {}) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.requestDelay) {
      await this.sleep(this.requestDelay - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();

    const url = new URL(`${BASE_URL}${endpoint}`);
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v));
        } else {
          url.searchParams.set(key, value);
        }
      }
    }

    const headers = {
      'X-API-KEY': this.apiKey,
      'Accept': 'application/json'
    };

    const response = await fetch(url.toString(), { headers });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Open States API error ${response.status}: ${error}`);
    }

    return response.json();
  }

  /**
   * Get list of all jurisdictions (states)
   */
  async getJurisdictions() {
    return this.request('/jurisdictions');
  }

  /**
   * Get details for a specific jurisdiction
   * @param {string} jurisdictionId - e.g., 'ocd-jurisdiction/country:us/state:wi/government'
   */
  async getJurisdiction(jurisdictionId) {
    return this.request(`/jurisdictions/${encodeURIComponent(jurisdictionId)}`);
  }

  /**
   * Search for people (legislators, governors, etc.)
   * @param {Object} options
   * @param {string} options.jurisdiction - Jurisdiction ID or abbreviation (e.g., 'wi', 'ca')
   * @param {string} options.org_classification - 'legislature', 'upper', 'lower', 'executive'
   * @param {boolean} options.current_only - Only return current members (default: true)
   * @param {number} options.page - Page number (1-indexed)
   * @param {number} options.per_page - Results per page (max 50)
   */
  async getPeople(options = {}) {
    const params = {
      per_page: options.per_page || 50,
      page: options.page || 1
    };

    if (options.jurisdiction) params.jurisdiction = options.jurisdiction;
    if (options.org_classification) params.org_classification = options.org_classification;
    if (options.current_only !== false) params.current_only = true;
    if (options.name) params.name = options.name;
    if (options.district) params.district = options.district;
    if (options.party) params.party = options.party;

    // Include extra data
    params.include = ['other_identifiers', 'other_names', 'links', 'sources'];

    return this.request('/people', params);
  }

  /**
   * Get people by geographic location (lat/lng)
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   */
  async getPeopleByGeo(lat, lng) {
    return this.request('/people.geo', { lat, lng });
  }

  /**
   * Get all current legislators for a state
   * @param {string} state - Two-letter state code
   */
  async getStateLegislators(state) {
    const results = [];
    let page = 1;
    let hasMore = true;
    const jurisdiction = `ocd-jurisdiction/country:us/state:${state.toLowerCase()}/government`;

    while (hasMore) {
      const response = await this.getPeople({
        jurisdiction,
        current_only: true,
        page,
        per_page: 50
      });

      if (response.results && response.results.length > 0) {
        results.push(...response.results);
        
        // Check for more pages
        const pagination = response.pagination;
        hasMore = pagination && pagination.max_page && page < pagination.max_page;
        page++;
      } else {
        hasMore = false;
      }
    }

    return results;
  }

  /**
   * Get all governors/executives for a state
   * @param {string} state - Two-letter state code
   */
  async getStateExecutives(state) {
    return this.getPeople({
      jurisdiction: state.toLowerCase(),
      org_classification: 'executive',
      current_only: true,
      per_page: 50
    });
  }

  /**
   * Get all current officials for all 50 states + DC + PR
   */
  async getAllStateLegislators(progressCallback = null) {
    const states = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC', 'PR'
    ];

    const allResults = [];
    
    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      
      if (progressCallback) {
        progressCallback({
          state,
          current: i + 1,
          total: states.length,
          percent: Math.round(((i + 1) / states.length) * 100)
        });
      }

      try {
        const legislators = await this.getStateLegislators(state);
        allResults.push({
          state,
          legislators,
          count: legislators.length
        });
        console.log(`Fetched ${legislators.length} legislators from ${state}`);
      } catch (err) {
        console.error(`Error fetching ${state}:`, err.message);
        allResults.push({
          state,
          legislators: [],
          count: 0,
          error: err.message
        });
      }
    }

    return allResults;
  }

  /**
   * Transform Open States person data to our format
   */
  transformPerson(person) {
    // Extract current role
    const currentRole = person.current_role || {};
    
    // Parse name parts
    const nameParts = person.name?.split(' ') || [];
    const firstName = person.given_name || nameParts[0] || '';
    const lastName = person.family_name || nameParts[nameParts.length - 1] || '';
    
    // Determine office level and chamber
    const orgClassification = currentRole.org_classification || '';
    const chamber = orgClassification === 'upper' ? 'Senate' : 
                   orgClassification === 'lower' ? 'House' : 
                   orgClassification;
    
    // Build office name
    let officeName = '';
    if (currentRole.title) {
      officeName = currentRole.title;
      if (currentRole.district) {
        officeName += ` - District ${currentRole.district}`;
      }
    } else if (chamber && currentRole.district) {
      const stateUpper = currentRole.jurisdiction?.toUpperCase() || '';
      officeName = `${stateUpper} State ${chamber} - District ${currentRole.district}`;
    }

    // Extract contact info
    let email = null;
    let phone = null;
    let address = null;
    
    if (person.offices) {
      for (const office of person.offices) {
        if (office.email && !email) email = office.email;
        if (office.voice && !phone) phone = office.voice;
        if (office.address && !address) address = office.address;
      }
    }

    // Extract links
    let website = null;
    let twitter = null;
    let facebook = null;
    
    if (person.links) {
      for (const link of person.links) {
        const url = link.url?.toLowerCase() || '';
        if (url.includes('twitter.com') || url.includes('x.com')) {
          twitter = link.url;
        } else if (url.includes('facebook.com')) {
          facebook = link.url;
        } else if (!website && !url.includes('linkedin')) {
          website = link.url;
        }
      }
    }

    return {
      // Identity
      openStatesId: person.id,
      displayName: person.name,
      firstName,
      lastName,
      
      // Party
      partyAffiliation: this.normalizeParty(person.party),
      partyRaw: person.party,
      
      // Role
      currentTitle: currentRole.title,
      chamber: chamber,
      district: currentRole.district,
      divisionId: currentRole.division_id,
      
      // Office info
      officeName,
      officeLevel: 'state',
      state: (currentRole.jurisdiction || person.jurisdiction?.id?.split('/')[3]?.split(':')[1])?.toUpperCase(),
      
      // Contact
      email,
      phone,
      address,
      website,
      twitter,
      facebook,
      
      // Media
      photoUrl: person.image,
      
      // Other identifiers
      otherIds: person.other_identifiers || [],
      
      // Source tracking
      sources: person.sources,
      
      // Raw data for reference
      _rawOpenStatesData: person
    };
  }

  /**
   * Normalize party name to standard format
   */
  normalizeParty(party) {
    if (!party) return 'Unknown';
    
    const partyLower = party.toLowerCase();
    
    if (partyLower.includes('democrat')) return 'Democrat';
    if (partyLower.includes('republican')) return 'Republican';
    if (partyLower.includes('independent')) return 'Independent';
    if (partyLower.includes('libertarian')) return 'Libertarian';
    if (partyLower.includes('green')) return 'Green';
    if (partyLower.includes('progressive')) return 'Progressive';
    if (partyLower.includes('nonpartisan')) return 'Nonpartisan';
    
    // Return as-is if no match
    return party;
  }

  // ==========================================================================
  // BILLS & VOTES METHODS
  // ==========================================================================

  /**
   * Search bills
   * @param {Object} options
   * @param {string} options.jurisdiction - State code (e.g., 'wi')
   * @param {string} options.session - Legislative session (e.g., '2023')
   * @param {string} options.chamber - 'upper' or 'lower'
   * @param {string} options.classification - 'bill', 'resolution', etc.
   * @param {string} options.subject - Subject/topic filter
   * @param {string} options.updated_since - ISO date string
   * @param {string} options.created_since - ISO date string
   * @param {string} options.action_since - ISO date string
   * @param {string} options.q - Full text search query
   * @param {Array} options.include - Array of: 'sponsorships', 'abstracts', 'other_titles', 'other_identifiers', 'actions', 'sources', 'documents', 'versions', 'votes', 'related_bills'
   * @param {number} options.page - Page number
   * @param {number} options.per_page - Results per page (max 50)
   */
  async getBills(options = {}) {
    const params = {
      per_page: options.per_page || 20,
      page: options.page || 1
    };

    if (options.jurisdiction) params.jurisdiction = options.jurisdiction;
    if (options.session) params.session = options.session;
    if (options.chamber) params.chamber = options.chamber;
    if (options.classification) params.classification = options.classification;
    if (options.subject) params.subject = options.subject;
    if (options.updated_since) params.updated_since = options.updated_since;
    if (options.created_since) params.created_since = options.created_since;
    if (options.action_since) params.action_since = options.action_since;
    if (options.q) params.q = options.q;
    
    // Include votes and sponsorships by default - must be array
    params.include = options.include || ['sponsorships', 'actions', 'votes'];

    return this.request('/bills', params);
  }

  /**
   * Get a single bill by ID
   * @param {string} billId - Open States bill ID (ocd-bill/...)
   * @param {Array} include - What to include
   */
  async getBillById(billId, include = ['sponsorships', 'actions', 'votes', 'abstracts', 'sources']) {
    return this.request(`/bills/${encodeURIComponent(billId)}`, { include });
  }

  /**
   * Get a bill by jurisdiction, session, and bill identifier
   * @param {string} jurisdiction - State code (e.g., 'wi')
   * @param {string} session - Session (e.g., '2023')
   * @param {string} identifier - Bill number (e.g., 'HB 123')
   */
  async getBillByIdentifier(jurisdiction, session, identifier, include = ['sponsorships', 'actions', 'votes', 'abstracts', 'sources']) {
    const encodedId = encodeURIComponent(identifier);
    return this.request(`/bills/${jurisdiction}/${session}/${encodedId}`, { include });
  }

  /**
   * Get all bills for a state/session with votes included
   * @param {string} state - Two-letter state code
   * @param {string} session - Legislative session
   * @param {Object} options - Additional options
   */
  async getBillsWithVotes(state, session, options = {}) {
    const results = [];
    let page = 1;
    let hasMore = true;
    const perPage = options.per_page || 20;
    const maxPages = options.max_pages || 100; // Safety limit

    console.log(`Fetching bills for ${state} session ${session}...`);

    while (hasMore && page <= maxPages) {
      try {
        const response = await this.getBills({
          jurisdiction: state.toLowerCase(),
          session: session,
          include: ['sponsorships', 'actions', 'votes'],
          page,
          per_page: perPage
        });

        if (response.results && response.results.length > 0) {
          results.push(...response.results);
          console.log(`  Page ${page}: ${response.results.length} bills (total: ${results.length})`);
          
          // Check for more pages
          const pagination = response.pagination;
          hasMore = pagination && pagination.max_page && page < pagination.max_page;
          page++;
        } else {
          hasMore = false;
        }
      } catch (err) {
        console.error(`Error fetching bills page ${page}:`, err.message);
        hasMore = false;
      }
    }

    return results;
  }

  /**
   * Get recent bills with votes for a state
   * @param {string} state - Two-letter state code
   * @param {string} since - ISO date string (e.g., '2024-01-01')
   * @param {number} maxBills - Maximum bills to fetch
   */
  async getRecentBillsWithVotes(state, since, maxBills = 500) {
    const results = [];
    let page = 1;
    let hasMore = true;

    console.log(`Fetching bills for ${state} with action since ${since}...`);

    while (hasMore && results.length < maxBills) {
      try {
        const response = await this.getBills({
          jurisdiction: state.toLowerCase(),
          action_since: since,  // Use action_since for better results
          include: ['sponsorships', 'actions', 'votes'],
          page,
          per_page: 20
        });

        if (response.results && response.results.length > 0) {
          results.push(...response.results);
          console.log(`  Page ${page}: ${response.results.length} bills (total: ${results.length})`);
          
          const pagination = response.pagination;
          hasMore = pagination && pagination.max_page && page < pagination.max_page;
          page++;
        } else {
          hasMore = false;
        }
      } catch (err) {
        console.error(`Error fetching bills page ${page}:`, err.message);
        hasMore = false;
      }
    }

    return results.slice(0, maxBills);
  }

  /**
   * Transform Open States bill to our format
   */
  transformBill(bill) {
    const state = bill.jurisdiction?.name?.split(' ')[0]?.toUpperCase() || 
                  bill.from_organization?.jurisdiction?.id?.split(':')[1]?.toUpperCase();

    return {
      externalId: bill.id,
      billNumber: bill.identifier,
      title: bill.title,
      description: bill.abstracts?.[0]?.abstract || null,
      summary: null,
      state: state,
      chamber: bill.from_organization?.classification || null,
      session: bill.legislative_session?.identifier || bill.session,
      categories: bill.subject || [],
      status: this.determineBillStatus(bill.actions),
      introducedDate: bill.actions?.find(a => 
        a.classification?.includes('introduction') || 
        a.classification?.includes('filing')
      )?.date || bill.created_at?.split('T')[0],
      lastActionDate: bill.latest_action_date || bill.updated_at?.split('T')[0],
      source: 'open_states',
      sourceUrl: bill.openstates_url,
      
      // Related data
      sponsorships: bill.sponsorships?.map(s => ({
        name: s.name,
        entityType: s.entity_type,
        classification: s.classification,
        primary: s.primary,
        personId: s.person?.id
      })) || [],
      
      votes: bill.votes?.map(v => this.transformVoteEvent(v, bill)) || [],
      
      actions: bill.actions?.map(a => ({
        description: a.description,
        date: a.date,
        classification: a.classification,
        organization: a.organization?.name
      })) || [],

      _raw: bill
    };
  }

  /**
   * Transform Open States vote event to our format
   */
  transformVoteEvent(vote, bill = null) {
    return {
      externalId: vote.id,
      billId: bill?.id || vote.bill?.id,
      motionText: vote.motion_text,
      motionClassification: vote.motion_classification?.[0] || null,
      chamber: vote.organization?.classification || null,
      voteDate: vote.start_date,
      result: vote.result,
      yesCount: vote.counts?.find(c => c.option === 'yes')?.value || 0,
      noCount: vote.counts?.find(c => c.option === 'no')?.value || 0,
      abstainCount: vote.counts?.find(c => c.option === 'abstain')?.value || 
                    vote.counts?.find(c => c.option === 'other')?.value || 0,
      absentCount: vote.counts?.find(c => c.option === 'absent')?.value || 
                   vote.counts?.find(c => c.option === 'not voting')?.value || 0,
      source: 'open_states',
      sourceUrl: vote.sources?.[0]?.url || null,
      
      // Individual votes
      individualVotes: vote.votes?.map(v => ({
        voterName: v.voter_name,
        voterId: v.voter?.id,
        vote: v.option  // 'yes', 'no', 'abstain', 'absent', 'other', etc.
      })) || []
    };
  }

  /**
   * Determine bill status from actions
   */
  determineBillStatus(actions) {
    if (!actions || actions.length === 0) return 'introduced';
    
    // Check actions in reverse order (most recent first)
    const sortedActions = [...actions].sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    for (const action of sortedActions) {
      const classifications = action.classification || [];
      const desc = action.description?.toLowerCase() || '';
      
      if (classifications.includes('executive-signature') || desc.includes('signed by governor')) {
        return 'signed';
      }
      if (classifications.includes('executive-veto') || desc.includes('vetoed')) {
        return 'vetoed';
      }
      if (classifications.includes('became-law')) {
        return 'law';
      }
      if (classifications.includes('passage') && desc.includes('passed')) {
        return 'passed';
      }
      if (classifications.includes('failure') || desc.includes('failed')) {
        return 'failed';
      }
    }
    
    return 'introduced';
  }

  /**
   * Get available sessions for a state
   * @param {string} state - Two-letter state code
   */
  async getSessions(state) {
    const jurisdiction = await this.getJurisdiction(
      `ocd-jurisdiction/country:us/state:${state.toLowerCase()}/government`
    );
    return jurisdiction.legislative_sessions || [];
  }
}

module.exports = OpenStatesClient;