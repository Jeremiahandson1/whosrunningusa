const express = require('express');
const router = express.Router();

/**
 * GET /api/lookup/address-to-district
 *
 * Resolves a street address to its state + county + U.S. House congressional
 * district using the free Census Bureau geocoder. No API key required.
 *
 * Query params:
 *   address  — "123 Main St, Eau Claire, WI 54701"
 *
 * Returns:
 *   { matchedAddress, lat, lng, state, county, district } on success
 *   { error, reason } on failure (no match, service down, etc.)
 */
router.get('/address-to-district', async (req, res) => {
  const address = (req.query.address || '').toString().trim();
  if (!address) {
    return res.status(400).json({ error: 'address query param is required' });
  }
  if (address.length > 400) {
    return res.status(400).json({ error: 'address too long (max 400 chars)' });
  }

  const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress');
  url.searchParams.set('address', address);
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('vintage', 'Current_Current');
  url.searchParams.set('layers', 'Congressional Districts,Counties,States');
  url.searchParams.set('format', 'json');

  // 10s timeout — Census geocoder can be slow under load.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);

  let data;
  try {
    const r = await fetch(url.toString(), { signal: ctrl.signal });
    if (!r.ok) {
      return res.status(502).json({ error: 'Census geocoder returned non-OK', reason: `HTTP ${r.status}` });
    }
    data = await r.json();
  } catch (err) {
    return res.status(504).json({ error: 'Census geocoder unreachable', reason: err.message });
  } finally {
    clearTimeout(t);
  }

  const matches = data?.result?.addressMatches || [];
  if (matches.length === 0) {
    return res.status(404).json({ error: 'Address not found', reason: 'Census geocoder returned no matches' });
  }

  const m = matches[0];
  const geos = m.geographies || {};

  // Pull the keys we care about. Census returns different naming conventions
  // for the layer arrays, so try the most common ones.
  const districts = geos['119th Congressional Districts']
    || geos['118th Congressional Districts']
    || geos['Congressional Districts']
    || [];
  const counties = geos['Counties'] || [];
  const states = geos['States'] || [];

  const district = districts[0];
  const county = counties[0];
  const state = states[0];

  const districtNumber = district?.CD119FP || district?.CD118FP || district?.CDFP || district?.BASENAME;

  res.json({
    matchedAddress: m.matchedAddress || address,
    lat: m.coordinates?.y ?? null,
    lng: m.coordinates?.x ?? null,
    state: state?.STUSAB || null,              // e.g. "WI"
    stateName: state?.NAME || null,            // "Wisconsin"
    county: county?.BASENAME || county?.NAME || null,  // "Eau Claire"
    countyGeoid: county?.GEOID || null,
    // District in two formats — frontend can use whichever it needs:
    district: districtNumber || null,          // "07" (what our fec_district uses)
    districtName: district?.NAMELSAD || null,  // "Congressional District 7"
  });
});

module.exports = router;
