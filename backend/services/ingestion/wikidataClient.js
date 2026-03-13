/**
 * Wikidata SPARQL Client
 *
 * Queries Wikidata for politician biographical data:
 * - Education (alma mater, degree, field of study)
 * - Professional career history
 * - Personal info (birth date/place, spouse, religion)
 *
 * Uses the public SPARQL endpoint at query.wikidata.org
 * Rate limits: 5 parallel queries/IP, 60s query time/minute
 *
 * License: CC0 (public domain)
 */

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

class WikidataClient {
  constructor() {
    this.requestCount = 0;
    this.maxRequestsPerRun = 300;
  }

  /**
   * Execute a SPARQL query against Wikidata
   */
  async query(sparql) {
    if (this.requestCount >= this.maxRequestsPerRun) {
      throw new Error('Wikidata request budget exceeded');
    }

    this.requestCount++;

    const response = await fetch(SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'WhosRunningUSA/1.0 (civic education platform; contact@whosrunningusa.com)'
      },
      body: `query=${encodeURIComponent(sparql)}`
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      throw new Error(`Wikidata SPARQL error: ${response.status}`);
    }

    const data = await response.json();
    return data.results?.bindings || [];
  }

  /**
   * Get education history for a politician by Bioguide ID
   */
  async getEducationByBioguide(bioguideId) {
    const sparql = `
      SELECT ?person ?personLabel ?university ?universityLabel
             ?degree ?degreeLabel ?fieldLabel ?startDate ?endDate
      WHERE {
        ?person wdt:P1157 "${bioguideId}" .
        ?person p:P69 ?eduStatement .
        ?eduStatement ps:P69 ?university .
        OPTIONAL { ?eduStatement pq:P512 ?degree . }
        OPTIONAL { ?eduStatement pq:P812 ?field . }
        OPTIONAL { ?eduStatement pq:P580 ?startDate . }
        OPTIONAL { ?eduStatement pq:P582 ?endDate . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
    `;

    const results = await this.query(sparql);
    return results.map(r => ({
      institution: r.universityLabel?.value,
      degree: r.degreeLabel?.value,
      field: r.fieldLabel?.value,
      startYear: r.startDate?.value ? new Date(r.startDate.value).getFullYear() : null,
      endYear: r.endDate?.value ? new Date(r.endDate.value).getFullYear() : null,
    }));
  }

  /**
   * Get education history by Wikidata entity ID
   */
  async getEducationByWikidataId(wikidataId) {
    const sparql = `
      SELECT ?universityLabel ?degreeLabel ?fieldLabel ?startDate ?endDate
      WHERE {
        wd:${wikidataId} p:P69 ?eduStatement .
        ?eduStatement ps:P69 ?university .
        OPTIONAL { ?eduStatement pq:P512 ?degree . }
        OPTIONAL { ?eduStatement pq:P812 ?field . }
        OPTIONAL { ?eduStatement pq:P580 ?startDate . }
        OPTIONAL { ?eduStatement pq:P582 ?endDate . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
    `;

    const results = await this.query(sparql);
    return results.map(r => ({
      institution: r.universityLabel?.value,
      degree: r.degreeLabel?.value,
      field: r.fieldLabel?.value,
      startYear: r.startDate?.value ? new Date(r.startDate.value).getFullYear() : null,
      endYear: r.endDate?.value ? new Date(r.endDate.value).getFullYear() : null,
    }));
  }

  /**
   * Get full biographical data for a politician by Bioguide ID
   * Returns education, birth info, positions held, and more in one query
   */
  async getFullBioByBioguide(bioguideId) {
    const sparql = `
      SELECT ?person ?personLabel ?personDescription
             ?birthDate ?birthPlaceLabel ?genderLabel
             ?spouseLabel ?religionLabel ?photoUrl
      WHERE {
        ?person wdt:P1157 "${bioguideId}" .
        OPTIONAL { ?person wdt:P569 ?birthDate . }
        OPTIONAL { ?person wdt:P19 ?birthPlace . }
        OPTIONAL { ?person wdt:P21 ?gender . }
        OPTIONAL { ?person wdt:P26 ?spouse . }
        OPTIONAL { ?person wdt:P140 ?religion . }
        OPTIONAL { ?person wdt:P18 ?photoUrl . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
      LIMIT 1
    `;

    const results = await this.query(sparql);
    if (results.length === 0) return null;

    const r = results[0];
    return {
      wikidataId: r.person?.value?.split('/').pop(),
      name: r.personLabel?.value,
      description: r.personDescription?.value,
      birthDate: r.birthDate?.value?.split('T')[0],
      birthPlace: r.birthPlaceLabel?.value,
      gender: r.genderLabel?.value,
      spouse: r.spouseLabel?.value,
      religion: r.religionLabel?.value,
      photoUrl: r.photoUrl?.value,
    };
  }

  /**
   * Batch query: get education for multiple politicians by Bioguide IDs
   * More efficient than individual queries (one SPARQL call for up to ~50 at a time)
   */
  async getBatchEducation(bioguideIds) {
    if (bioguideIds.length === 0) return {};

    // Wikidata can handle batches but keep reasonable
    const batch = bioguideIds.slice(0, 50);
    const values = batch.map(id => `"${id}"`).join(' ');

    const sparql = `
      SELECT ?bioguideId ?universityLabel ?degreeLabel ?fieldLabel ?startDate ?endDate
      WHERE {
        VALUES ?bioguideId { ${values} }
        ?person wdt:P1157 ?bioguideId .
        ?person p:P69 ?eduStatement .
        ?eduStatement ps:P69 ?university .
        OPTIONAL { ?eduStatement pq:P512 ?degree . }
        OPTIONAL { ?eduStatement pq:P812 ?field . }
        OPTIONAL { ?eduStatement pq:P580 ?startDate . }
        OPTIONAL { ?eduStatement pq:P582 ?endDate . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
    `;

    const results = await this.query(sparql);

    // Group by bioguide ID
    const grouped = {};
    for (const r of results) {
      const id = r.bioguideId?.value;
      if (!id) continue;
      if (!grouped[id]) grouped[id] = [];
      grouped[id].push({
        institution: r.universityLabel?.value,
        degree: r.degreeLabel?.value,
        field: r.fieldLabel?.value,
        startYear: r.startDate?.value ? new Date(r.startDate.value).getFullYear() : null,
        endYear: r.endDate?.value ? new Date(r.endDate.value).getFullYear() : null,
      });
    }

    return grouped;
  }

  /**
   * Batch query: get basic bio for multiple politicians
   */
  async getBatchBios(bioguideIds) {
    if (bioguideIds.length === 0) return {};

    const batch = bioguideIds.slice(0, 50);
    const values = batch.map(id => `"${id}"`).join(' ');

    const sparql = `
      SELECT ?bioguideId ?personLabel ?personDescription
             ?birthDate ?birthPlaceLabel ?genderLabel ?photoUrl
      WHERE {
        VALUES ?bioguideId { ${values} }
        ?person wdt:P1157 ?bioguideId .
        OPTIONAL { ?person wdt:P569 ?birthDate . }
        OPTIONAL { ?person wdt:P19 ?birthPlace . }
        OPTIONAL { ?person wdt:P21 ?gender . }
        OPTIONAL { ?person wdt:P18 ?photoUrl . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
    `;

    const results = await this.query(sparql);

    const grouped = {};
    for (const r of results) {
      const id = r.bioguideId?.value;
      if (!id) continue;
      grouped[id] = {
        name: r.personLabel?.value,
        description: r.personDescription?.value,
        birthDate: r.birthDate?.value?.split('T')[0],
        birthPlace: r.birthPlaceLabel?.value,
        gender: r.genderLabel?.value,
        photoUrl: r.photoUrl?.value,
      };
    }

    return grouped;
  }

  /**
   * Get positions held (political career) by Bioguide ID
   */
  async getPositionsHeld(bioguideId) {
    const sparql = `
      SELECT ?positionLabel ?startDate ?endDate ?districtLabel ?groupLabel
      WHERE {
        ?person wdt:P1157 "${bioguideId}" .
        ?person p:P39 ?posStatement .
        ?posStatement ps:P39 ?position .
        OPTIONAL { ?posStatement pq:P580 ?startDate . }
        OPTIONAL { ?posStatement pq:P582 ?endDate . }
        OPTIONAL { ?posStatement pq:P768 ?district . }
        OPTIONAL { ?posStatement pq:P4100 ?group . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
      ORDER BY ?startDate
    `;

    const results = await this.query(sparql);
    return results.map(r => ({
      position: r.positionLabel?.value,
      startDate: r.startDate?.value?.split('T')[0],
      endDate: r.endDate?.value?.split('T')[0],
      district: r.districtLabel?.value,
      party: r.groupLabel?.value,
    }));
  }
}

module.exports = WikidataClient;
