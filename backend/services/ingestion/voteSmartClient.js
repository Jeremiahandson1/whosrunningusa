/**
 * VoteSmart API Client (v1/v2 REST API)
 *
 * Wraps the Vote Smart API (api.votesmart.org) for fetching:
 * - Candidate bios (education, experience, political history)
 * - Interest group ratings
 * - Political Courage Test (NPAT/PCT) responses
 * - Voting records / bills
 * - Committees
 *
 * Requires VOTE_SMART_API_KEY environment variable.
 * API docs: https://api.votesmart.org/docs
 */

const BASE_URL = 'https://api.votesmart.org';

class VoteSmartClient {
  constructor() {
    this.apiKey = process.env.VOTE_SMART_API_KEY;
    this.requestCount = 0;
    this.maxRequestsPerRun = 500;
  }

  /**
   * Make an authenticated API request
   */
  async request(path, params = {}) {
    if (!this.apiKey) {
      throw new Error('VOTE_SMART_API_KEY not set');
    }

    if (this.requestCount >= this.maxRequestsPerRun) {
      throw new Error(`Vote Smart request budget exceeded (${this.maxRequestsPerRun})`);
    }

    const url = new URL(`${BASE_URL}${path}`);
    // Include API key as query param (legacy support) and Bearer header
    url.searchParams.set('key', this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    this.requestCount++;

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      if (response.status === 404) {
        return null;
      }
      const body = await response.text().catch(() => '');
      throw new Error(`Vote Smart API ${response.status}: ${body.slice(0, 200)}`);
    }

    return response.json();
  }

  // =========================================================================
  // CANDIDATE SEARCH / MATCHING
  // =========================================================================

  /**
   * Search candidates by last name
   * GET /v1/candidates/by-lastname?lastName=...&stateId=...
   */
  async searchByLastName(lastName, stateId = null) {
    const params = { lastName };
    if (stateId) params.stateId = stateId;

    try {
      const data = await this.request('/v1/candidates/by-lastname', params);
      return this.normalizeArray(data);
    } catch (err) {
      if (err.message.includes('404') || err.message.includes('No candidates')) return [];
      throw err;
    }
  }

  /**
   * Search candidates by fuzzy last name match
   * GET /v1/candidates/by-levenshtein?lastName=...&stateId=...
   */
  async searchByFuzzyLastName(lastName, stateId = null) {
    const params = { lastName };
    if (stateId) params.stateId = stateId;

    try {
      const data = await this.request('/v1/candidates/by-levenshtein', params);
      return this.normalizeArray(data);
    } catch (err) {
      if (err.message.includes('404')) return [];
      throw err;
    }
  }

  /**
   * Get officials by state
   * GET /v1/officials/by-state?stateId=...
   */
  async getOfficialsByState(stateId) {
    try {
      const data = await this.request('/v1/officials/by-state', { stateId });
      return this.normalizeArray(data);
    } catch (err) {
      if (err.message.includes('404')) return [];
      throw err;
    }
  }

  /**
   * Get candidates by office and state
   * GET /v1/candidates/by-office-state?officeId=...&stateId=...
   */
  async getCandidatesByOfficeState(stateId, officeId = null) {
    const params = { stateId };
    if (officeId) params.officeId = officeId;

    try {
      const data = await this.request('/v1/candidates/by-office-state', params);
      return this.normalizeArray(data);
    } catch (err) {
      if (err.message.includes('404')) return [];
      throw err;
    }
  }

  // =========================================================================
  // BIO / DETAILED BIO
  // =========================================================================

  /**
   * Get basic bio for a candidate
   * GET /v1/candidatebios/{id}
   */
  async getBio(candidateId) {
    return this.request(`/v1/candidatebios/${candidateId}`);
  }

  /**
   * Get detailed bio with education, experience, etc.
   * GET /v1/candidatebios/{id}/detail
   */
  async getDetailedBio(candidateId) {
    return this.request(`/v1/candidatebios/${candidateId}/detail`);
  }

  /**
   * Get additional bio info (family, religion, etc.)
   * GET /v1/candidatebios/{id}/addl
   */
  async getAdditionalBio(candidateId) {
    try {
      const data = await this.request(`/v1/candidatebios/${candidateId}/addl`);
      return this.normalizeArray(data);
    } catch (err) {
      if (err.message.includes('404')) return [];
      throw err;
    }
  }

  // =========================================================================
  // INTEREST GROUP RATINGS
  // =========================================================================

  /**
   * Get interest group ratings for a candidate
   * GET /v1/ratings/by-candidate?candidateId=...
   */
  async getRatings(candidateId) {
    try {
      const data = await this.request('/v1/ratings/by-candidate', { candidateId });
      return this.normalizeArray(data);
    } catch (err) {
      if (err.message.includes('404')) return [];
      throw err;
    }
  }

  /**
   * Get detailed ratings with filters (v2)
   * GET /v2/ratings/by-candidate?candidateId=...&year=...
   */
  async getRatingsDetailed(candidateId, year = null) {
    const params = { candidateId };
    if (year) params.year = year;

    try {
      const data = await this.request('/v2/ratings/by-candidate', params);
      return this.normalizeArray(data);
    } catch (err) {
      if (err.message.includes('404')) return [];
      throw err;
    }
  }

  /**
   * Get details about a specific interest group (SIG)
   * GET /v1/ratings/sig/{id}
   */
  async getSIG(sigId) {
    return this.request(`/v1/ratings/sig/${sigId}`);
  }

  // =========================================================================
  // VOTING RECORDS / BILLS
  // =========================================================================

  /**
   * Get bills voted on by an official
   * GET /v1/votes/bills/by-official?candidateId=...&year=...
   */
  async getVotesByOfficial(candidateId, year = null) {
    const params = { candidateId };
    if (year) params.year = year;

    try {
      const data = await this.request('/v1/votes/bills/by-official', params);
      return this.normalizeArray(data);
    } catch (err) {
      if (err.message.includes('404')) return [];
      throw err;
    }
  }

  /**
   * Get bills with ALL action votes (v2)
   * GET /v2/votes/bills/by-official-all-votes?candidateId=...&year=...
   */
  async getAllVotesByOfficial(candidateId, year = null) {
    const params = { candidateId };
    if (year) params.year = year;

    try {
      const data = await this.request('/v2/votes/bills/by-official-all-votes', params);
      return this.normalizeArray(data);
    } catch (err) {
      if (err.message.includes('404')) return [];
      throw err;
    }
  }

  /**
   * Get bills sponsored by a candidate
   * GET /v1/votes/bills/by-sponsor-year?candidateId=...&year=...
   */
  async getBillsBySponsor(candidateId, year = null) {
    const params = { candidateId };
    if (year) params.year = year;

    try {
      const data = await this.request('/v1/votes/bills/by-sponsor-year', params);
      return this.normalizeArray(data);
    } catch (err) {
      if (err.message.includes('404')) return [];
      throw err;
    }
  }

  /**
   * Get bill detail
   * GET /v1/votes/bills/{id}
   */
  async getBill(billId) {
    return this.request(`/v1/votes/bills/${billId}`);
  }

  /**
   * Get votes on a specific bill action
   * GET /v1/votes/bills/action/{id}/votes
   */
  async getBillActionVotes(actionId) {
    try {
      const data = await this.request(`/v1/votes/bills/action/${actionId}/votes`);
      return this.normalizeArray(data);
    } catch (err) {
      if (err.message.includes('404')) return [];
      throw err;
    }
  }

  // =========================================================================
  // PCT / NPAT (Political Courage Test)
  // =========================================================================

  /**
   * Get NPAT/PCT responses for a candidate
   * GET /v1/npats/{id}
   */
  async getNpat(candidateId) {
    try {
      return await this.request(`/v1/npats/${candidateId}`);
    } catch (err) {
      if (err.message.includes('404')) return null;
      throw err;
    }
  }

  // =========================================================================
  // COMMITTEES
  // =========================================================================

  /**
   * Get committee members
   * GET /v1/committees/{id}/members
   */
  async getCommitteeMembers(committeeId) {
    try {
      const data = await this.request(`/v1/committees/${committeeId}/members`);
      return this.normalizeArray(data);
    } catch (err) {
      if (err.message.includes('404')) return [];
      throw err;
    }
  }

  /**
   * Get committees by type and state
   * GET /v1/committees/by-type-state?typeId=...&stateId=...
   */
  async getCommitteesByTypeState(stateId, typeId = null) {
    const params = { stateId };
    if (typeId) params.typeId = typeId;

    try {
      const data = await this.request('/v1/committees/by-type-state', params);
      return this.normalizeArray(data);
    } catch (err) {
      if (err.message.includes('404')) return [];
      throw err;
    }
  }

  // =========================================================================
  // TRANSFORM HELPERS
  // =========================================================================

  /**
   * Vote Smart sometimes returns a single object instead of an array
   */
  normalizeArray(data) {
    if (!data) return [];
    return Array.isArray(data) ? data : [data];
  }

  /**
   * Transform a detailed bio response into our schema format
   */
  transformBio(bio) {
    if (!bio) return null;

    const candidate = bio.candidate || bio;

    return {
      voteSmartId: candidate.candidateId,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      middleName: candidate.middleName,
      suffix: candidate.suffix,
      nickName: candidate.nickName,
      birthDate: candidate.birthDate,
      birthPlace: candidate.birthPlace,
      gender: candidate.gender,
      religion: candidate.religion,
      homeCity: candidate.homeCity,
      homeState: candidate.homeState,
      family: candidate.family,
      photo: candidate.photo,

      // Education
      education: this.normalizeArray(bio.education?.institution || bio.education).map(edu => ({
        institution: edu.institutionName || edu.school || edu.name,
        degree: edu.degree,
        field: edu.fieldOfStudy || edu.major || edu.field,
        graduationYear: edu.graduationYear ? parseInt(edu.graduationYear) : null,
      })),

      // Professional experience
      profession: this.normalizeArray(bio.profession?.experience || bio.profession).map(exp => ({
        title: exp.title,
        organization: exp.organization,
        startYear: exp.span ? parseInt(exp.span.split('-')[0]) : null,
        endYear: exp.span ? parseInt(exp.span.split('-')[1]) || null : null,
        isCurrent: exp.isCurrent === 'true' || exp.isCurrent === true,
      })),

      // Political experience
      political: this.normalizeArray(bio.political?.experience || bio.political).map(pol => ({
        title: pol.title,
        office: pol.office,
        district: pol.district,
        state: pol.state,
        startYear: pol.span ? parseInt(pol.span.split('-')[0]) : null,
        endYear: pol.span ? parseInt(pol.span.split('-')[1]) || null : null,
        isCurrent: pol.isCurrent === 'true' || pol.isCurrent === true,
      })),

      // Congressional memberships
      congMembership: this.normalizeArray(bio.congMembership?.committee || bio.congMembership).map(cm => ({
        committeeName: cm.committeeName || cm.name,
        position: cm.position,
      })),

      // Org memberships
      orgMembership: this.normalizeArray(bio.orgMembership?.organization || bio.orgMembership).map(org => ({
        name: org.organizationName || org.name,
        role: org.role,
        isCurrent: org.isCurrent === 'true' || org.isCurrent === true,
      })),
    };
  }

  /**
   * Transform a rating for our schema
   */
  transformRating(rating) {
    return {
      sigId: rating.sigId,
      sigName: rating.sigName || rating.name,
      ratingScore: rating.rating ? parseFloat(rating.rating) : null,
      ratingText: rating.ratingText,
      ratingName: rating.ratingName,
      timeSpan: rating.timespan || rating.timeSpan,
      ratingYear: (rating.timespan || rating.timeSpan) ? parseInt(rating.timespan || rating.timeSpan) : null,
      categories: this.normalizeArray(rating.categories?.category || rating.categories)
        .map(c => c.name || c),
    };
  }

  /**
   * Transform a vote/bill record for our schema
   */
  transformVote(bill) {
    return {
      billNumber: bill.billNumber,
      title: bill.title,
      vote: bill.vote,
      voteDate: bill.dateVoted || bill.stage,
      chamber: bill.type,
      categories: this.normalizeArray(bill.categories?.category || bill.categories)
        .map(c => c.name || c),
      billId: bill.billId,
      actionId: bill.actionId,
    };
  }
}

module.exports = VoteSmartClient;
