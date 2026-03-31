/**
 * USASpending.gov API Client
 *
 * Fetches federal spending / foreign aid data from the USASpending.gov API v2.
 * No API key required.
 *
 * API Docs: https://api.usaspending.gov/
 */

const BASE_URL = 'https://api.usaspending.gov/api/v2';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class USASpendingClient {
  constructor() {
    this.baseUrl = BASE_URL;
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.minRequestInterval = 200; // ms between requests (rate limiting)
    this.maxRetries = 3;
  }

  /**
   * Make a request to the USASpending API with rate limiting and retry logic.
   * @param {string} endpoint - API endpoint path (e.g. '/search/spending_by_award/')
   * @param {Object|null} body - Request body for POST requests (null for GET)
   * @param {string} method - HTTP method ('GET' or 'POST')
   * @returns {Promise<Object>} Parsed JSON response
   */
  async request(endpoint, body = null, method = 'GET') {
    // Rate limiting: ensure minimum interval between requests
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await sleep(this.minRequestInterval - elapsed);
    }

    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WhosRunningUSA/1.0 civic-data-project',
      },
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.requestCount++;
        this.lastRequestTime = Date.now();

        const response = await fetch(url, options);

        // Retry on 429 (rate limited) with exponential backoff
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10);
          const backoff = Math.max(retryAfter * 1000, 1000 * Math.pow(2, attempt));
          console.warn(`USASpending API rate limited (429). Retrying in ${backoff}ms (attempt ${attempt}/${this.maxRetries})`);
          await sleep(backoff);
          continue;
        }

        // Retry on 5xx server errors
        if (response.status >= 500 && attempt < this.maxRetries) {
          const backoff = 1000 * Math.pow(2, attempt);
          console.warn(`USASpending API server error ${response.status}. Retrying in ${backoff}ms (attempt ${attempt}/${this.maxRetries})`);
          await sleep(backoff);
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`USASpending API error ${response.status}: ${errorText}`);
        }

        return response.json();
      } catch (err) {
        lastError = err;

        // Don't retry on non-retryable errors (4xx other than 429)
        if (err.message && err.message.includes('API error 4')) {
          throw err;
        }

        if (attempt < this.maxRetries) {
          const backoff = 1000 * Math.pow(2, attempt);
          console.warn(`USASpending request failed: ${err.message}. Retrying in ${backoff}ms (attempt ${attempt}/${this.maxRetries})`);
          await sleep(backoff);
        }
      }
    }

    throw lastError;
  }

  /**
   * Get spending by country for foreign assistance awards in a fiscal year.
   * @param {number} fiscalYear - Federal fiscal year (e.g. 2025)
   * @returns {Promise<Object>} Spending results grouped by country
   */
  async getSpendingByCountry(fiscalYear) {
    return this.request('/search/spending_by_award/', {
      filters: {
        time_period: [
          {
            start_date: `${fiscalYear - 1}-10-01`,
            end_date: `${fiscalYear}-09-30`,
          },
        ],
        award_type_codes: ['02', '03', '04', '05', '06', '07', '08', '09', '10', '11'],
        place_of_performance_locations: [
          { country: 'FOREIGN' },
        ],
      },
      fields: [
        'Award ID',
        'Recipient Name',
        'Place of Performance Country Code',
        'Place of Performance Country Name',
        'Award Amount',
        'Total Outlays',
        'CFDA Number',
        'Awarding Agency',
        'Awarding Sub Agency',
        'Description',
        'Start Date',
        'End Date',
      ],
      limit: 100,
      page: 1,
      sort: 'Award Amount',
      order: 'desc',
    }, 'POST');
  }

  /**
   * Get awards filtered to a specific country for a fiscal year.
   * @param {string} countryCode - ISO 3166-1 alpha-3 country code (e.g. 'ISR', 'UKR')
   * @param {number} fiscalYear - Federal fiscal year
   * @param {number} page - Page number (default 1)
   * @returns {Promise<Object>} Award results for the specified country
   */
  async getAwardsByCountry(countryCode, fiscalYear, page = 1) {
    return this.request('/search/spending_by_award/', {
      filters: {
        time_period: [
          {
            start_date: `${fiscalYear - 1}-10-01`,
            end_date: `${fiscalYear}-09-30`,
          },
        ],
        award_type_codes: ['02', '03', '04', '05', '06', '07', '08', '09', '10', '11'],
        place_of_performance_locations: [
          { country: countryCode },
        ],
      },
      fields: [
        'Award ID',
        'Recipient Name',
        'Place of Performance Country Code',
        'Place of Performance Country Name',
        'Award Amount',
        'Total Outlays',
        'CFDA Number',
        'Awarding Agency',
        'Awarding Sub Agency',
        'Description',
        'Start Date',
        'End Date',
        'generated_internal_id',
      ],
      limit: 100,
      page,
      sort: 'Award Amount',
      order: 'desc',
    }, 'POST');
  }

  /**
   * Get spending summary for a specific agency in a fiscal year.
   * @param {string} agencyCode - Treasury account symbol or agency code
   * @param {number} fiscalYear - Federal fiscal year
   * @returns {Promise<Object>} Agency spending data
   */
  async getAgencySpending(agencyCode, fiscalYear) {
    return this.request(`/agency/${agencyCode}/awards/`, null, 'GET');
  }

  /**
   * Classify an award into a foreign aid category based on CFDA number,
   * agency name, and description.
   *
   * @param {string|null} cfdaNumber - CFDA / Assistance Listing number (e.g. '12.401')
   * @param {string|null} agencyName - Awarding agency or sub-agency name
   * @param {string|null} description - Award description text
   * @returns {string} One of: military, economic, humanitarian, democracy_promotion, health, other
   */
  classifyCategory(cfdaNumber, agencyName, description) {
    const cfda = (cfdaNumber || '').trim();
    const agency = (agencyName || '').toLowerCase();
    const desc = (description || '').toLowerCase();

    // --- Military / Security Assistance ---
    // CFDA prefix 12.xxx = Department of Defense programs
    if (cfda.startsWith('12.')) return 'military';
    // Defense Security Cooperation Agency
    if (agency.includes('dsca') || agency.includes('defense security cooperation')) return 'military';
    if (agency.includes('department of defense') || agency.includes('dept of defense') || agency.includes('dod')) return 'military';
    // Foreign Military Financing (CFDA 12.xxx already caught, but also State Dept programs)
    if (desc.includes('foreign military financing') || desc.includes('fmf')) return 'military';
    if (desc.includes('military aid') || desc.includes('security assistance') || desc.includes('defense article')) return 'military';
    if (desc.includes('arms') || desc.includes('munitions') || desc.includes('weapons system')) return 'military';

    // --- Health ---
    // CFDA prefix 93.xxx = HHS programs
    if (cfda.startsWith('93.')) return 'health';
    if (agency.includes('hhs') || agency.includes('health and human services')) return 'health';
    if (agency.includes('cdc') || agency.includes('centers for disease control')) return 'health';
    if (agency.includes('nih') || agency.includes('national institutes of health')) return 'health';
    // PEPFAR, global health
    if (desc.includes('pepfar') || desc.includes('hiv') || desc.includes('aids')) return 'health';
    if (desc.includes('global health') || desc.includes('pandemic') || desc.includes('vaccine')) return 'health';
    if (desc.includes('malaria') || desc.includes('tuberculosis') || desc.includes('maternal health')) return 'health';

    // --- Democracy Promotion ---
    // USAID democracy / governance programs
    if (agency.includes('usaid') && (desc.includes('democracy') || desc.includes('governance') || desc.includes('election'))) return 'democracy_promotion';
    if (desc.includes('democracy promotion') || desc.includes('democratic governance')) return 'democracy_promotion';
    if (desc.includes('rule of law') || desc.includes('civil society') || desc.includes('human rights')) return 'democracy_promotion';
    if (agency.includes('national endowment for democracy') || agency.includes('ned')) return 'democracy_promotion';

    // --- Humanitarian ---
    if (agency.includes('state') && (desc.includes('humanitarian') || desc.includes('refugee') || desc.includes('disaster'))) return 'humanitarian';
    if (desc.includes('humanitarian assistance') || desc.includes('humanitarian aid')) return 'humanitarian';
    if (desc.includes('refugee') || desc.includes('displacement') || desc.includes('famine')) return 'humanitarian';
    if (desc.includes('disaster relief') || desc.includes('emergency food') || desc.includes('food aid')) return 'humanitarian';
    if (desc.includes('idp') || desc.includes('internally displaced')) return 'humanitarian';
    // CFDA prefix 19.xxx (State Dept) with humanitarian keywords already caught above

    // --- Economic Development ---
    if (agency.includes('usaid')) return 'economic';
    // CFDA prefix 98.xxx = USAID programs
    if (cfda.startsWith('98.')) return 'economic';
    if (desc.includes('economic development') || desc.includes('economic growth')) return 'economic';
    if (desc.includes('trade capacity') || desc.includes('private sector development')) return 'economic';
    if (desc.includes('infrastructure') || desc.includes('energy sector') || desc.includes('power generation')) return 'economic';
    // Millennium Challenge Corporation
    if (agency.includes('millennium challenge')) return 'economic';

    // --- State Department general (often economic or diplomatic) ---
    if (agency.includes('department of state') || agency.includes('state department')) return 'economic';
    if (cfda.startsWith('19.')) return 'economic';

    return 'other';
  }
}

module.exports = USASpendingClient;
