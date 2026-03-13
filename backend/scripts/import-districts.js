/**
 * Census District-County Relationship Data Ingestion
 * 
 * Downloads and processes the 119th Congressional District to County 
 * Relationship File from the Census Bureau.
 * 
 * Source: https://www.census.gov/geographies/reference-files/time-series/geo/relationship-files.2020.html
 * File: National 119th Congressional District to 2020 County Relationship File
 * 
 * Usage: node scripts/import-districts.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');
const db = require('../db');

// Census Bureau URL for the relationship file
const CENSUS_CD_COUNTY_URL = 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/tab20_cd11920_county20_natl.txt';

// State FIPS to abbreviation mapping
const STATE_FIPS_TO_ABBR = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY', '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR', '78': 'VI'
};

const STATE_NAMES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'DC': 'District of Columbia', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii',
  'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine',
  'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
  'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska',
  'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico',
  'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island',
  'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas',
  'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington',
  'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'AS': 'American Samoa', 'GU': 'Guam', 'MP': 'Northern Mariana Islands',
  'PR': 'Puerto Rico', 'VI': 'Virgin Islands'
};

/**
 * Download file from URL
 */
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading from ${url}...`);
    
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded to ${destPath}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

/**
 * Parse the Census relationship file
 * 
 * File format (pipe-delimited):
 * GEOID_CD119_20|NAMELSAD_CD119_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_PART|AREALAND_WHOLE
 */
async function parseRelationshipFile(filePath) {
  const records = [];
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let isHeader = true;
  let headers = [];

  for await (const line of rl) {
    if (isHeader) {
      headers = line.split('|').map(h => h.trim());
      isHeader = false;
      console.log('Headers:', headers);
      continue;
    }

    const values = line.split('|').map(v => v.trim());
    const record = {};
    
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });

    // Parse the record
    // GEOID_CD119_20 format: SSDD (State FIPS + District, e.g., "5501" for WI-01)
    const districtGeoid = record['GEOID_CD119_20'] || record['GEOID_CD11920_20'];
    const districtName = record['NAMELSAD_CD119_20'] || record['NAMELSAD_CD11920_20'];
    const countyGeoid = record['GEOID_COUNTY_20'];
    const countyName = record['NAMELSAD_COUNTY_20'];
    const landAreaPart = parseInt(record['AREALAND_PART'] || record['AREALAND'] || '0');
    const landAreaWhole = parseInt(record['AREALAND_WHOLE'] || '0');

    if (!districtGeoid || !countyGeoid) continue;

    const stateFips = districtGeoid.substring(0, 2);
    const districtNumber = districtGeoid.substring(2, 4) || 'AL';
    const stateAbbr = STATE_FIPS_TO_ABBR[stateFips];

    if (!stateAbbr) continue;

    const countyStateFips = countyGeoid.substring(0, 2);
    const countyFips = countyGeoid.substring(2, 5);

    // Calculate land area percentage
    const landAreaPercent = landAreaWhole > 0 
      ? Math.round((landAreaPart / landAreaWhole) * 10000) / 100 
      : 100;

    records.push({
      // District info
      stateFips,
      stateAbbr,
      districtNumber,
      districtGeoid,
      districtName,
      
      // County info
      countyStateFips,
      countyFips,
      countyGeoid,
      countyName: countyName.replace(' County', '').replace(' Parish', '').trim(),
      countyFullName: countyName,
      
      // Coverage
      landAreaPart,
      landAreaWhole,
      landAreaPercent,
      isFullCounty: landAreaPercent >= 99.5
    });
  }

  console.log(`Parsed ${records.length} district-county relationships`);
  return records;
}

/**
 * Import records into database
 */
async function importRecords(records) {
  console.log('\nImporting to database...');
  
  const stats = {
    districts: 0,
    counties: 0,
    mappings: 0,
    errors: 0
  };

  // Group records by district
  const districtMap = new Map();
  const countyMap = new Map();

  for (const record of records) {
    // Track unique districts
    const districtKey = `${record.stateFips}-${record.districtNumber}`;
    if (!districtMap.has(districtKey)) {
      districtMap.set(districtKey, {
        stateFips: record.stateFips,
        stateAbbr: record.stateAbbr,
        districtNumber: record.districtNumber,
        geoid: record.districtGeoid,
        fullName: record.districtName || `${STATE_NAMES[record.stateAbbr]} Congressional District ${record.districtNumber}`
      });
    }

    // Track unique counties
    if (!countyMap.has(record.countyGeoid)) {
      countyMap.set(record.countyGeoid, {
        stateFips: record.countyStateFips,
        stateAbbr: STATE_FIPS_TO_ABBR[record.countyStateFips],
        countyFips: record.countyFips,
        countyGeoid: record.countyGeoid,
        countyName: record.countyName,
        countyFullName: record.countyFullName
      });
    }
  }

  // Insert districts
  console.log(`Inserting ${districtMap.size} congressional districts...`);
  for (const district of districtMap.values()) {
    try {
      await db.query(`
        INSERT INTO congressional_districts 
          (state_fips, state_abbr, district_number, congress_number, geoid, full_name)
        VALUES ($1, $2, $3, 119, $4, $5)
        ON CONFLICT (state_fips, district_number, congress_number) 
        DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = NOW()
      `, [
        district.stateFips,
        district.stateAbbr,
        district.districtNumber,
        district.geoid,
        district.fullName
      ]);
      stats.districts++;
    } catch (err) {
      console.error(`Error inserting district ${district.geoid}:`, err.message);
      stats.errors++;
    }
  }

  // Insert counties
  console.log(`Inserting ${countyMap.size} counties...`);
  for (const county of countyMap.values()) {
    try {
      await db.query(`
        INSERT INTO counties 
          (state_fips, state_abbr, county_fips, county_geoid, county_name, county_full_name)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (county_geoid) 
        DO UPDATE SET county_name = EXCLUDED.county_name
      `, [
        county.stateFips,
        county.stateAbbr,
        county.countyFips,
        county.countyGeoid,
        county.countyName,
        county.countyFullName
      ]);
      stats.counties++;
    } catch (err) {
      console.error(`Error inserting county ${county.countyGeoid}:`, err.message);
      stats.errors++;
    }
  }

  // Insert mappings
  console.log(`Inserting ${records.length} district-county mappings...`);
  for (const record of records) {
    try {
      // Get district ID
      const districtResult = await db.query(`
        SELECT id FROM congressional_districts 
        WHERE state_fips = $1 AND district_number = $2 AND congress_number = 119
      `, [record.stateFips, record.districtNumber]);

      if (districtResult.rows.length === 0) continue;

      const districtId = districtResult.rows[0].id;

      await db.query(`
        INSERT INTO district_county_mappings 
          (district_id, state_fips, county_fips, county_geoid, county_name, 
           land_area_sq_meters, land_area_percent, is_full_county)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (district_id, county_geoid) 
        DO UPDATE SET 
          land_area_sq_meters = EXCLUDED.land_area_sq_meters,
          land_area_percent = EXCLUDED.land_area_percent,
          is_full_county = EXCLUDED.is_full_county
      `, [
        districtId,
        record.countyStateFips,
        record.countyFips,
        record.countyGeoid,
        record.countyName,
        record.landAreaPart,
        record.landAreaPercent,
        record.isFullCounty
      ]);
      stats.mappings++;
    } catch (err) {
      console.error(`Error inserting mapping:`, err.message);
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Census District-County Relationship Import');
  console.log('='.repeat(60));

  const dataDir = path.join(__dirname, '..', 'data');
  const filePath = path.join(dataDir, 'cd119_county_relationship.txt');

  // Create data directory if needed
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    // Download if not exists
    if (!fs.existsSync(filePath)) {
      await downloadFile(CENSUS_CD_COUNTY_URL, filePath);
    } else {
      console.log(`Using cached file: ${filePath}`);
    }

    // Parse file
    const records = await parseRelationshipFile(filePath);

    // Import to database
    const stats = await importRecords(records);

    console.log('\n' + '='.repeat(60));
    console.log('Import Complete!');
    console.log('='.repeat(60));
    console.log(`Districts: ${stats.districts}`);
    console.log(`Counties:  ${stats.counties}`);
    console.log(`Mappings:  ${stats.mappings}`);
    console.log(`Errors:    ${stats.errors}`);

    // Test query
    console.log('\nTest: Districts for Eau Claire County, WI:');
    const testResult = await db.query(`
      SELECT cd.district_number, cd.full_name, dcm.land_area_percent
      FROM counties c
      JOIN district_county_mappings dcm ON c.county_geoid = dcm.county_geoid
      JOIN congressional_districts cd ON dcm.district_id = cd.id
      WHERE c.state_abbr = 'WI' AND c.county_name = 'Eau Claire'
      ORDER BY dcm.land_area_percent DESC
    `);
    
    for (const row of testResult.rows) {
      console.log(`  District ${row.district_number}: ${row.full_name} (${row.land_area_percent}%)`);
    }

  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }

  process.exit(0);
}

main();