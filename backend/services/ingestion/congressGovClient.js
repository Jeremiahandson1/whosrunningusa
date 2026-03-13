/**
 * Congress.gov API Client
 * 
 * Documentation: https://github.com/LibraryOfCongress/api.congress.gov
 * Sign up: https://api.congress.gov/sign-up/
 * 
 * Provides access to:
 * - Members of Congress
 * - Bills and resolutions
 * - Roll call votes
 * - Amendments
 * - Nominations
 * - Committee data
 */

const axios = require('axios');

class CongressGovClient {
  constructor(apiKey = process.env.CONGRESS_GOV_API_KEY) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.congress.gov/v3';
    this.requestCount = 0;
    this.lastRequestTime = 0;
    
    // Rate limit: Congress.gov has generous limits but we'll be respectful
    this.minRequestInterval = 200; // 200ms between requests
  }

  /**
   * Make an API request with rate limiting
   */
  async request(endpoint, params = {}) {
    if (!this.apiKey) {
      throw new Error('CONGRESS_GOV_API_KEY is not set');
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }

    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      this.lastRequestTime = Date.now();
      this.requestCount++;
      
      const response = await axios.get(url, {
        params: {
          api_key: this.apiKey,
          format: 'json',
          ...params
        },
        headers: {
          'Accept': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Congress.gov API error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  // ==================== MEMBERS ====================

  /**
   * Get list of members with pagination
   * @param {number} congress - Congress number (e.g., 118)
   * @param {Object} options - Options like currentMember, limit, offset
   */
  async getMembers(congress = null, options = {}) {
    let endpoint = `/member`;
    const params = { 
      limit: options.limit || 250,
      offset: options.offset || 0
    };
    
    if (congress) {
      endpoint = `/member/congress/${congress}`;
      // Important: use currentMember=false to get all members from that congress
      params.currentMember = options.currentMember !== undefined ? options.currentMember : false;
    }
    
    return this.request(endpoint, params);
  }

  /**
   * Get ALL members for a congress (handles pagination)
   */
  async getAllMembers(congress, options = {}) {
    const allMembers = [];
    let offset = 0;
    const limit = 250;
    let hasMore = true;

    console.log(`Fetching all members for ${congress}th Congress...`);

    while (hasMore) {
      const response = await this.getMembers(congress, { 
        ...options, 
        limit, 
        offset 
      });
      const members = response.members || [];
      
      if (members.length > 0) {
        allMembers.push(...members);
        console.log(`  Fetched ${allMembers.length} members so far...`);
        offset += limit;
        
        // Check if there are more
        hasMore = members.length === limit;
      } else {
        hasMore = false;
      }
    }

    return allMembers;
  }

  /**
   * Get member by bioguide ID
   * @param {string} bioguideId - Member's bioguide ID (e.g., 'A000360')
   */
  async getMember(bioguideId) {
    return this.request(`/member/${bioguideId}`);
  }

  /**
   * Get members by state
   * @param {string} state - Two-letter state code
   */
  async getMembersByState(state, options = {}) {
    const params = { 
      limit: 250,
      currentMember: options.currentMember !== undefined ? options.currentMember : true
    };
    return this.request(`/member/${state.toUpperCase()}`, params);
  }

  /**
   * Get member's sponsored legislation
   */
  async getMemberSponsoredLegislation(bioguideId, options = {}) {
    return this.request(`/member/${bioguideId}/sponsored-legislation`, {
      limit: options.limit || 20,
      offset: options.offset || 0
    });
  }

  /**
   * Get member's cosponsored legislation
   */
  async getMemberCosponsoredLegislation(bioguideId, options = {}) {
    return this.request(`/member/${bioguideId}/cosponsored-legislation`, {
      limit: options.limit || 20,
      offset: options.offset || 0
    });
  }

  // ==================== BILLS ====================

  /**
   * Get bills
   * @param {number} congress - Congress number
   * @param {string} billType - 'hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres'
   */
  async getBills(congress, billType = null, options = {}) {
    let endpoint = `/bill/${congress}`;
    if (billType) {
      endpoint += `/${billType}`;
    }
    return this.request(endpoint, {
      limit: options.limit || 20,
      offset: options.offset || 0,
      sort: options.sort || 'updateDate+desc'
    });
  }

  /**
   * Get specific bill
   */
  async getBill(congress, billType, billNumber) {
    return this.request(`/bill/${congress}/${billType}/${billNumber}`);
  }

  /**
   * Get bill actions
   */
  async getBillActions(congress, billType, billNumber) {
    return this.request(`/bill/${congress}/${billType}/${billNumber}/actions`);
  }

  /**
   * Get bill cosponsors
   */
  async getBillCosponsors(congress, billType, billNumber) {
    return this.request(`/bill/${congress}/${billType}/${billNumber}/cosponsors`);
  }

  /**
   * Get bill subjects
   */
  async getBillSubjects(congress, billType, billNumber) {
    return this.request(`/bill/${congress}/${billType}/${billNumber}/subjects`);
  }

  /**
   * Get bill summaries
   */
  async getBillSummaries(congress, billType, billNumber) {
    return this.request(`/bill/${congress}/${billType}/${billNumber}/summaries`);
  }

  /**
   * Get bill text versions
   */
  async getBillTextVersions(congress, billType, billNumber) {
    return this.request(`/bill/${congress}/${billType}/${billNumber}/text`);
  }

  // ==================== VOTES ====================

  /**
   * Get votes for a congress and chamber
   * Note: Congress.gov API doesn't have a direct votes endpoint
   * We need to get votes through bills or use the House/Senate clerk data
   */
  async getVotes(congress, chamber, options = {}) {
    // Congress.gov doesn't have a direct votes list endpoint
    // Votes are accessed through individual bills
    // For comprehensive vote data, we'd need to use house.gov or senate.gov clerk data
    throw new Error('Direct votes endpoint not available - use bill-specific vote data or external sources');
  }

  // ==================== COMMITTEES ====================

  /**
   * Get committees
   */
  async getCommittees(congress, chamber = null) {
    let endpoint = `/committee`;
    if (congress) {
      endpoint = `/committee/${congress}`;
      if (chamber) {
        endpoint += `/${chamber}`;
      }
    }
    return this.request(endpoint, { limit: 250 });
  }

  /**
   * Get specific committee
   */
  async getCommittee(congress, chamber, committeeCode) {
    return this.request(`/committee/${congress}/${chamber}/${committeeCode}`);
  }

  // ==================== NOMINATIONS ====================

  /**
   * Get nominations
   */
  async getNominations(congress, options = {}) {
    return this.request(`/nomination/${congress}`, {
      limit: options.limit || 20,
      offset: options.offset || 0
    });
  }

  // ==================== AMENDMENTS ====================

  /**
   * Get amendments
   */
  async getAmendments(congress, amendmentType = null, options = {}) {
    let endpoint = `/amendment/${congress}`;
    if (amendmentType) {
      endpoint += `/${amendmentType}`;
    }
    return this.request(endpoint, {
      limit: options.limit || 20,
      offset: options.offset || 0
    });
  }

  // ==================== SUMMARIES ====================

  /**
   * Get bill summaries by congress
   */
  async getSummaries(congress, billType = null, options = {}) {
    let endpoint = `/summaries/${congress}`;
    if (billType) {
      endpoint += `/${billType}`;
    }
    return this.request(endpoint, {
      limit: options.limit || 20,
      offset: options.offset || 0
    });
  }

  // ==================== TRANSFORMATION ====================

  /**
   * Transform Congress.gov member to our schema
   */
  transformMember(member) {
    // terms can be {item: [...]} or just an array
    const terms = Array.isArray(member.terms) ? member.terms : (member.terms?.item || []);
    
    // Find the most recent term to determine current chamber
    let chamber = null;
    let latestYear = 0;
    for (const term of terms) {
      if (term.startYear && term.startYear > latestYear) {
        latestYear = term.startYear;
        chamber = term.chamber === 'House of Representatives' ? 'lower' : 
                  term.chamber === 'Senate' ? 'upper' : null;
      }
    }
    
    const latestTerm = terms[0] || {};
    
    return {
      bioguideId: member.bioguideId,
      name: member.name,
      firstName: member.firstName,
      lastName: member.lastName,
      party: member.partyName || member.party,
      state: member.state,
      district: member.district,
      chamber,
      startYear: latestTerm.startYear,
      endYear: latestTerm.endYear,
      officialUrl: member.officialWebsiteUrl,
      imageUrl: member.depiction?.imageUrl,
      source: 'congress_gov',
      externalId: member.bioguideId
    };
  }

  /**
   * Transform Congress.gov bill to our schema
   */
  transformBill(bill) {
    const billType = bill.type?.toLowerCase() || '';
    const chamber = billType.startsWith('h') ? 'lower' : 'upper';
    
    return {
      externalId: `congress-${bill.congress}-${bill.type}-${bill.number}`,
      billNumber: `${bill.type} ${bill.number}`,
      title: bill.title,
      description: bill.latestSummary?.text || null,
      state: 'US', // Federal
      chamber,
      session: bill.congress?.toString(),
      introducedDate: bill.introducedDate,
      lastActionDate: bill.latestAction?.actionDate,
      status: this.determineBillStatus(bill),
      categories: bill.policyArea?.name ? [bill.policyArea.name] : [],
      source: 'congress_gov',
      sourceUrl: bill.url
    };
  }

  /**
   * Determine bill status from Congress.gov data
   */
  determineBillStatus(bill) {
    const latestAction = bill.latestAction?.text?.toLowerCase() || '';
    
    if (latestAction.includes('became public law') || latestAction.includes('signed by president')) {
      return 'signed';
    }
    if (latestAction.includes('vetoed')) {
      return 'vetoed';
    }
    if (latestAction.includes('passed house') && latestAction.includes('passed senate')) {
      return 'passed';
    }
    if (latestAction.includes('passed') || latestAction.includes('agreed to')) {
      return 'passed_chamber';
    }
    if (latestAction.includes('referred to')) {
      return 'in_committee';
    }
    
    return 'introduced';
  }
}

module.exports = CongressGovClient;