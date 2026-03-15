/**
 * FEC (Federal Election Commission) API Client
 * 
 * Fetches federal candidate data from OpenFEC API
 * API Docs: https://api.open.fec.gov/developers/
 * 
 * Get API key at: https://api.data.gov/signup/
 */

function toTitleCase(name) {
  if (!name) return name;
  return name
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bMc([a-z])/g, (_, c) => 'Mc' + c.toUpperCase())
    .replace(/\bO'([a-z])/g, (_, c) => "O'" + c.toUpperCase());
}

const BASE_URL = 'https://api.open.fec.gov/v1';

class FECClient {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.FEC_API_KEY;
    if (!this.apiKey) {
      console.warn('FEC_API_KEY not set - FEC API calls will fail');
    }
  }

  async request(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', this.apiKey);
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v));
        } else {
          url.searchParams.set(key, value);
        }
      }
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`FEC API error ${response.status}: ${error}`);
    }

    return response.json();
  }

  /**
   * Search for candidates by name
   */
  async searchCandidates(query, options = {}) {
    return this.request('/candidates/search/', {
      q: query,
      per_page: options.perPage || 20,
      page: options.page || 1,
      sort: options.sort || '-election_years',
      ...options
    });
  }

  /**
   * Get all candidates with optional filters
   * @param {Object} options
   * @param {string} options.state - Two-letter state code
   * @param {string} options.office - H (House), S (Senate), P (President)
   * @param {number} options.cycle - Election cycle year (even years)
   * @param {string} options.party - Party code (DEM, REP, etc.)
   * @param {boolean} options.hasRaisedFunds - Only candidates who have raised funds
   * @param {boolean} options.isActiveCandidate - Currently active candidates
   */
  async getCandidates(options = {}) {
    const params = {
      per_page: options.perPage || 100,
      page: options.page || 1,
      sort: options.sort || 'name',
      sort_null_only: false,
      sort_hide_null: false,
    };

    if (options.state) params.state = options.state;
    if (options.office) params.office = options.office;
    if (options.cycle) params.cycle = options.cycle;
    if (options.party) params.party = options.party;
    if (options.hasRaisedFunds) params.has_raised_funds = true;
    if (options.isActiveCandidate) params.is_active_candidate = true;
    if (options.district) params.district = options.district;
    if (options.incumbentChallenge) params.incumbent_challenge = options.incumbentChallenge;

    return this.request('/candidates/', params);
  }

  /**
   * Get a specific candidate by FEC ID
   */
  async getCandidate(candidateId) {
    return this.request(`/candidate/${candidateId}/`);
  }

  /**
   * Get candidate history (all cycles they've run)
   */
  async getCandidateHistory(candidateId) {
    return this.request(`/candidate/${candidateId}/history/`);
  }

  /**
   * Get candidates for a specific state and cycle
   */
  async getCandidatesByState(state, cycle, options = {}) {
    return this.getCandidates({
      state,
      cycle,
      isActiveCandidate: true,
      ...options
    });
  }

  /**
   * Get all House candidates for a state
   */
  async getHouseCandidates(state, cycle) {
    return this.getCandidates({
      state,
      office: 'H',
      cycle,
      isActiveCandidate: true,
      perPage: 100
    });
  }

  /**
   * Get Senate candidates for a state
   */
  async getSenateCandidates(state, cycle) {
    return this.getCandidates({
      state,
      office: 'S',
      cycle,
      isActiveCandidate: true
    });
  }

  /**
   * Get Presidential candidates
   */
  async getPresidentialCandidates(cycle) {
    return this.getCandidates({
      office: 'P',
      cycle,
      isActiveCandidate: true,
      perPage: 100
    });
  }

  /**
   * Get candidate filings
   */
  async getCandidateFilings(candidateId, options = {}) {
    return this.request(`/candidate/${candidateId}/filings/`, {
      per_page: options.perPage || 20,
      page: options.page || 1
    });
  }

  /**
   * Paginate through all results
   */
  async getAllPages(method, options = {}) {
    const results = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await method.call(this, { ...options, page, perPage: 100 });
      
      if (response.results && response.results.length > 0) {
        results.push(...response.results);
        page++;
        
        // Check if there are more pages
        const pagination = response.pagination;
        hasMore = pagination && pagination.pages && page <= pagination.pages;
        
        // Rate limiting - FEC allows 1000 requests/hour
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        hasMore = false;
      }
    }

    return results;
  }

  /**
   * Get committee financial totals
   * @param {string} committeeId - FEC committee ID (e.g., C00492785)
   * @param {number} cycle - Election cycle year
   */
  async getCommitteeTotals(committeeId, cycle) {
    return this.request(`/committee/${committeeId}/totals/`, { cycle });
  }

  /**
   * Get top individual contributions (Schedule A) for a committee
   * @param {string} committeeId - FEC committee ID
   * @param {number} cycle - Election cycle year
   * @param {Object} options - per_page, sort, etc.
   */
  async getContributions(committeeId, cycle, options = {}) {
    return this.request('/schedules/schedule_a/', {
      committee_id: committeeId,
      two_year_transaction_period: cycle,
      per_page: options.perPage || 100,
      page: options.page || 1,
      sort: options.sort || '-contribution_receipt_amount',
      is_individual: options.individualsOnly !== false,
      min_amount: options.minAmount || 200,
    });
  }

  /**
   * Get contributions aggregated by size bracket for a candidate
   * @param {string} candidateId - FEC candidate ID
   * @param {number} cycle - Election cycle year
   */
  async getContributionsBySize(candidateId, cycle) {
    return this.request('/schedules/schedule_a/by_size/by_candidate/', {
      candidate_id: candidateId,
      cycle,
    });
  }

  /**
   * Get contributions aggregated by state for a candidate
   * @param {string} candidateId - FEC candidate ID
   * @param {number} cycle - Election cycle year
   */
  async getContributionsByState(candidateId, cycle) {
    return this.request('/schedules/schedule_a/by_state/by_candidate/', {
      candidate_id: candidateId,
      cycle,
      per_page: 100,
      sort: '-total',
    });
  }

  /**
   * Transform FEC candidate data to our format
   */
  transformCandidate(fecCandidate) {
    const partyMap = {
      'DEM': 'Democrat',
      'REP': 'Republican',
      'LIB': 'Libertarian',
      'GRE': 'Green',
      'IND': 'Independent',
      'CON': 'Constitution',
      'REF': 'Reform'
    };

    const officeMap = {
      'H': 'federal',
      'S': 'federal',
      'P': 'federal'
    };

    const officeTitleMap = {
      'H': `U.S. House Representative`,
      'S': 'U.S. Senator',
      'P': 'President of the United States'
    };

    return {
      // For matching/creating candidate profiles
      displayName: toTitleCase(fecCandidate.name),
      firstName: toTitleCase(fecCandidate.name?.split(',')[1]?.trim()?.split(' ')[0]),
      lastName: toTitleCase(fecCandidate.name?.split(',')[0]?.trim()),
      partyAffiliation: partyMap[fecCandidate.party] || fecCandidate.party,
      
      // Office info
      officeLevel: officeMap[fecCandidate.office] || 'federal',
      officeName: officeTitleMap[fecCandidate.office],
      state: fecCandidate.state,
      district: fecCandidate.office === 'H' ? fecCandidate.district : null,
      
      // FEC-specific
      fecCandidateId: fecCandidate.candidate_id,
      fecCommitteeId: fecCandidate.principal_committees?.[0]?.committee_id,
      incumbentChallengeStatus: fecCandidate.incumbent_challenge,
      electionYears: fecCandidate.election_years,
      activeThrough: fecCandidate.active_through,
      
      // Verification
      isActiveCandidate: fecCandidate.candidate_status === 'C',
      hasRaisedFunds: fecCandidate.has_raised_funds,
      
      // Raw data for reference
      _rawFecData: fecCandidate
    };
  }
}

module.exports = FECClient;