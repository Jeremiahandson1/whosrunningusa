require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const db = require('../db');

async function importZipCodes() {
  console.log('Importing ZIP Code to County mappings...\n');

  const filePath = './data/zcta_county_relationship.txt';
  
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let errors = 0;
  let isHeader = true;

  for await (const line of rl) {
    if (isHeader) {
      console.log('Headers:', line.split('|'));
      isHeader = false;
      continue;
    }

    try {
      const parts = line.split('|');
      const zcta = parts[1]?.trim(); // GEOID_ZCTA5_20
      const countyGeoid = parts[9]?.trim(); // GEOID_COUNTY_20

      if (!zcta || !countyGeoid || zcta.length < 5) continue;

      // Extract state FIPS (first 2 digits of county GEOID)
      const stateCode = countyGeoid.substring(0, 2);
      const stateAbbr = fipsToState[stateCode];
      
      if (!stateAbbr) continue;

      // Only use last 5 digits of ZCTA
      const zipCode = zcta.substring(zcta.length - 5);

      await db.query(`
        INSERT INTO zip_codes (zip_code, state_abbr, county_geoid)
        VALUES ($1, $2, $3)
        ON CONFLICT (zip_code) DO UPDATE SET county_geoid = EXCLUDED.county_geoid
      `, [zipCode, stateAbbr, countyGeoid]);

      count++;
      if (count % 1000 === 0) {
        console.log(`  Imported ${count} zip codes...`);
      }
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`Error: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Imported: ${count}`);
  console.log(`   Errors: ${errors}`);

  process.exit(0);
}

const fipsToState = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '12': 'FL', '13': 'GA',
  '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
  '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO',
  '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ',
  '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC',
  '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT',
  '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY'
};

importZipCodes().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});