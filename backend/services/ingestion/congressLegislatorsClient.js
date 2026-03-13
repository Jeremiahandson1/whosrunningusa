/**
 * Congress-Legislators Dataset Client
 *
 * Fetches and processes data from the unitedstates/congress-legislators
 * GitHub repository — public domain dataset of all US Congress members.
 *
 * Data includes: names, bios, terms, social media, committee memberships,
 * and cross-reference IDs (bioguide, votesmart, fec, wikipedia, wikidata, etc.)
 *
 * Source: https://github.com/unitedstates/congress-legislators
 * License: Public Domain (CC0)
 */

const BASE = 'https://raw.githubusercontent.com/unitedstates/congress-legislators';

class CongressLegislatorsClient {
  constructor() {
    this.cache = {};
  }

  /**
   * Fetch a JSON file from the gh-pages branch
   */
  async fetchJSON(filename) {
    if (this.cache[filename]) return this.cache[filename];

    const url = `${BASE}/gh-pages/${filename}`;
    console.log(`Fetching ${url}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${filename}: ${response.status}`);
    }

    const data = await response.json();
    this.cache[filename] = data;
    return data;
  }

  /**
   * Get all current legislators
   */
  async getCurrentLegislators() {
    return this.fetchJSON('legislators-current.json');
  }

  /**
   * Get social media accounts for all legislators
   */
  async getSocialMedia() {
    return this.fetchJSON('legislators-social-media.json');
  }

  /**
   * Get current committee memberships
   */
  async getCommitteeMemberships() {
    return this.fetchJSON('committee-membership-current.json');
  }

  /**
   * Get committee definitions
   */
  async getCommittees() {
    return this.fetchJSON('committees-current.json');
  }

  /**
   * Merge legislators with their social media data
   */
  async getLegislatorsWithSocial() {
    const [legislators, social] = await Promise.all([
      this.getCurrentLegislators(),
      this.getSocialMedia()
    ]);

    // Index social by bioguide ID
    const socialByBioguide = {};
    for (const entry of social) {
      if (entry.id?.bioguide) {
        socialByBioguide[entry.id.bioguide] = entry.social;
      }
    }

    // Merge
    return legislators.map(leg => ({
      ...leg,
      social: socialByBioguide[leg.id?.bioguide] || {}
    }));
  }

  /**
   * Transform a legislator record into our schema format
   */
  transformLegislator(leg) {
    const currentTerm = leg.terms?.[leg.terms.length - 1];
    if (!currentTerm) return null;

    const ids = leg.id || {};
    const name = leg.name || {};
    const bio = leg.bio || {};
    const social = leg.social || {};

    // Build display name
    const displayName = name.official_full ||
      `${name.first}${name.middle ? ' ' + name.middle : ''} ${name.last}${name.suffix ? ' ' + name.suffix : ''}`;

    // Determine office type
    const isHouse = currentTerm.type === 'rep';
    const isSenate = currentTerm.type === 'sen';

    let officeName;
    if (isHouse) {
      officeName = `U.S. House ${currentTerm.state}-${String(currentTerm.district).padStart(2, '0')}`;
    } else {
      officeName = `U.S. Senator - ${currentTerm.state}`;
    }

    return {
      // Identity
      displayName,
      firstName: name.first,
      lastName: name.last,
      middleName: name.middle,
      suffix: name.suffix,
      nickname: name.nickname,

      // Bio
      birthday: bio.birthday,
      gender: bio.gender,

      // Current term
      state: currentTerm.state,
      district: currentTerm.district,
      party: this.normalizeParty(currentTerm.party),
      chamber: isHouse ? 'House' : 'Senate',
      officeName,
      officeLevel: 'federal',
      termStart: currentTerm.start,
      termEnd: currentTerm.end,

      // Contact
      website: currentTerm.url,
      phone: currentTerm.phone,
      address: currentTerm.address,
      contactForm: currentTerm.contact_form,

      // Social media
      twitter: social.twitter || null,
      facebook: social.facebook || null,
      youtube: social.youtube || social.youtube_id || null,
      instagram: social.instagram || null,

      // Cross-reference IDs
      bioguideId: ids.bioguide,
      govtrackId: ids.govtrack,
      openSecretsId: ids.opensecrets,
      voteSmartId: ids.votesmart,
      fecIds: ids.fec || [],
      wikipediaId: ids.wikipedia,
      wikidataId: ids.wikidata,
      cspanId: ids.cspan,
      ballotpediaId: ids.ballotpedia,

      // All terms for history
      allTerms: leg.terms,
    };
  }

  normalizeParty(party) {
    if (!party) return 'Unknown';
    if (party === 'Democrat') return 'Democrat';
    if (party === 'Republican') return 'Republican';
    if (party === 'Independent') return 'Independent';
    return party;
  }
}

module.exports = CongressLegislatorsClient;
