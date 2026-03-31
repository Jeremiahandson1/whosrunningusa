#!/usr/bin/env node

/**
 * Seed Local Offices
 *
 * Populates local_offices table with city council, mayor, and school board
 * offices for the 25 largest US cities by population.
 *
 * Usage:
 *   node scripts/seed-local-offices.js
 *   node scripts/seed-local-offices.js --dry-run
 *
 * Required env vars:
 *   DATABASE_URL
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const dryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Local Offices for the 25 Largest US Cities
// Sources: City charters, municipal websites, Ballotpedia
// ---------------------------------------------------------------------------

const LOCAL_OFFICES = [
  // -- New York City, NY --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of New York', jurisdiction_type: 'city', state: 'NY', seats: 51, term_years: 4, is_partisan: true, salary: 148500, source_url: 'https://council.nyc.gov/' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of New York', jurisdiction_type: 'city', state: 'NY', seats: 1, term_years: 4, is_partisan: true, salary: 258750, source_url: 'https://www.nyc.gov/office-of-the-mayor/' },
  { title: 'Community Education Council Member', office_level: 'school_board', jurisdiction_name: 'City of New York', jurisdiction_type: 'city', state: 'NY', seats: 297, term_years: 2, is_partisan: false, salary: 0, source_url: 'https://www.schools.nyc.gov/get-involved/families/community-and-citywide-education-councils' },

  // -- Los Angeles, CA --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Los Angeles', jurisdiction_type: 'city', state: 'CA', seats: 15, term_years: 4, is_partisan: false, salary: 218484, source_url: 'https://www.lacity.org/government/popular-information/elected-officials' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Los Angeles', jurisdiction_type: 'city', state: 'CA', seats: 1, term_years: 4, is_partisan: false, salary: 267944, source_url: 'https://mayor.lacity.gov/' },
  { title: 'LAUSD School Board Member', office_level: 'school_board', jurisdiction_name: 'Los Angeles Unified School District', jurisdiction_type: 'school_district', state: 'CA', seats: 7, term_years: 4, is_partisan: false, salary: 125000, source_url: 'https://www.lausd.net/domain/10' },

  // -- Chicago, IL --
  { title: 'City Council Alderperson', office_level: 'city_council', jurisdiction_name: 'City of Chicago', jurisdiction_type: 'city', state: 'IL', seats: 50, term_years: 4, is_partisan: false, salary: 125304, source_url: 'https://www.chicago.gov/city/en/about/council.html' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Chicago', jurisdiction_type: 'city', state: 'IL', seats: 1, term_years: 4, is_partisan: false, salary: 216210, source_url: 'https://www.chicago.gov/city/en/depts/mayor.html' },
  { title: 'CPS Board of Education Member', office_level: 'school_board', jurisdiction_name: 'Chicago Public Schools', jurisdiction_type: 'school_district', state: 'IL', seats: 21, term_years: 4, is_partisan: false, salary: 0, source_url: 'https://www.cps.edu/about/board-of-education/' },

  // -- Houston, TX --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Houston', jurisdiction_type: 'city', state: 'TX', seats: 16, term_years: 4, is_partisan: false, salary: 66798, source_url: 'https://www.houstontx.gov/council/' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Houston', jurisdiction_type: 'city', state: 'TX', seats: 1, term_years: 4, is_partisan: false, salary: 236189, source_url: 'https://www.houstontx.gov/mayor/' },
  { title: 'HISD School Board Trustee', office_level: 'school_board', jurisdiction_name: 'Houston Independent School District', jurisdiction_type: 'school_district', state: 'TX', seats: 9, term_years: 4, is_partisan: false, salary: 0, source_url: 'https://www.houstonisd.org/domain/7908' },

  // -- Phoenix, AZ --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Phoenix', jurisdiction_type: 'city', state: 'AZ', seats: 8, term_years: 4, is_partisan: false, salary: 61049, source_url: 'https://www.phoenix.gov/citycouncil' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Phoenix', jurisdiction_type: 'city', state: 'AZ', seats: 1, term_years: 4, is_partisan: false, salary: 88130, source_url: 'https://www.phoenix.gov/mayor' },
  { title: 'School Board Member (Phoenix UHSD)', office_level: 'school_board', jurisdiction_name: 'Phoenix Union High School District', jurisdiction_type: 'school_district', state: 'AZ', seats: 5, term_years: 4, is_partisan: false, salary: 0, source_url: 'https://www.pxu.org/Page/155' },

  // -- Philadelphia, PA --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Philadelphia', jurisdiction_type: 'city', state: 'PA', seats: 17, term_years: 4, is_partisan: true, salary: 140300, source_url: 'https://phlcouncil.com/' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Philadelphia', jurisdiction_type: 'city', state: 'PA', seats: 1, term_years: 4, is_partisan: true, salary: 228182, source_url: 'https://www.phila.gov/departments/mayor/' },
  { title: 'School Board Member', office_level: 'school_board', jurisdiction_name: 'School District of Philadelphia', jurisdiction_type: 'school_district', state: 'PA', seats: 9, term_years: 4, is_partisan: false, salary: 0, source_url: 'https://www.philasd.org/schoolboard/' },

  // -- San Antonio, TX --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of San Antonio', jurisdiction_type: 'city', state: 'TX', seats: 10, term_years: 2, is_partisan: false, salary: 45722, source_url: 'https://www.sanantonio.gov/council' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of San Antonio', jurisdiction_type: 'city', state: 'TX', seats: 1, term_years: 2, is_partisan: false, salary: 61725, source_url: 'https://www.sanantonio.gov/mayor' },

  // -- San Diego, CA --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of San Diego', jurisdiction_type: 'city', state: 'CA', seats: 9, term_years: 4, is_partisan: false, salary: 155000, source_url: 'https://www.sandiego.gov/citycouncil' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of San Diego', jurisdiction_type: 'city', state: 'CA', seats: 1, term_years: 4, is_partisan: false, salary: 205000, source_url: 'https://www.sandiego.gov/mayor' },
  { title: 'SDUSD School Board Trustee', office_level: 'school_board', jurisdiction_name: 'San Diego Unified School District', jurisdiction_type: 'school_district', state: 'CA', seats: 5, term_years: 4, is_partisan: false, salary: 24000, source_url: 'https://www.sandiegounified.org/departments/school_board' },

  // -- Dallas, TX --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Dallas', jurisdiction_type: 'city', state: 'TX', seats: 14, term_years: 2, is_partisan: false, salary: 60000, source_url: 'https://dallascityhall.com/government/citycouncil' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Dallas', jurisdiction_type: 'city', state: 'TX', seats: 1, term_years: 2, is_partisan: false, salary: 80000, source_url: 'https://dallascityhall.com/government/citymayor' },
  { title: 'DISD School Board Trustee', office_level: 'school_board', jurisdiction_name: 'Dallas Independent School District', jurisdiction_type: 'school_district', state: 'TX', seats: 9, term_years: 3, is_partisan: false, salary: 0, source_url: 'https://www.dallasisd.org/domain/22' },

  // -- San Jose, CA --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of San Jose', jurisdiction_type: 'city', state: 'CA', seats: 10, term_years: 4, is_partisan: false, salary: 126000, source_url: 'https://www.sanjoseca.gov/your-government/city-council' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of San Jose', jurisdiction_type: 'city', state: 'CA', seats: 1, term_years: 4, is_partisan: false, salary: 152000, source_url: 'https://www.sanjoseca.gov/your-government/mayor' },

  // -- Austin, TX --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Austin', jurisdiction_type: 'city', state: 'TX', seats: 10, term_years: 4, is_partisan: false, salary: 83158, source_url: 'https://www.austintexas.gov/government/city-council' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Austin', jurisdiction_type: 'city', state: 'TX', seats: 1, term_years: 4, is_partisan: false, salary: 98158, source_url: 'https://www.austintexas.gov/government/mayor' },
  { title: 'AISD School Board Trustee', office_level: 'school_board', jurisdiction_name: 'Austin Independent School District', jurisdiction_type: 'school_district', state: 'TX', seats: 9, term_years: 4, is_partisan: false, salary: 0, source_url: 'https://www.austinisd.org/board' },

  // -- Jacksonville, FL --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Jacksonville', jurisdiction_type: 'city', state: 'FL', seats: 19, term_years: 4, is_partisan: true, salary: 50000, source_url: 'https://www.coj.net/city-council' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Jacksonville', jurisdiction_type: 'city', state: 'FL', seats: 1, term_years: 4, is_partisan: true, salary: 175000, source_url: 'https://www.coj.net/mayor' },
  { title: 'DCPS School Board Member', office_level: 'school_board', jurisdiction_name: 'Duval County Public Schools', jurisdiction_type: 'school_district', state: 'FL', seats: 7, term_years: 4, is_partisan: false, salary: 40000, source_url: 'https://dcps.duvalschools.org/domain/2954' },

  // -- Fort Worth, TX --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Fort Worth', jurisdiction_type: 'city', state: 'TX', seats: 8, term_years: 2, is_partisan: false, salary: 25200, source_url: 'https://www.fortworthtexas.gov/departments/city-council' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Fort Worth', jurisdiction_type: 'city', state: 'TX', seats: 1, term_years: 2, is_partisan: false, salary: 27000, source_url: 'https://www.fortworthtexas.gov/departments/mayor' },

  // -- Columbus, OH --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Columbus', jurisdiction_type: 'city', state: 'OH', seats: 7, term_years: 4, is_partisan: true, salary: 56174, source_url: 'https://www.columbus.gov/council/' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Columbus', jurisdiction_type: 'city', state: 'OH', seats: 1, term_years: 4, is_partisan: true, salary: 178075, source_url: 'https://www.columbus.gov/mayor/' },
  { title: 'CCS School Board Member', office_level: 'school_board', jurisdiction_name: 'Columbus City Schools', jurisdiction_type: 'school_district', state: 'OH', seats: 7, term_years: 4, is_partisan: false, salary: 0, source_url: 'https://www.ccsoh.us/domain/24' },

  // -- Charlotte, NC --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Charlotte', jurisdiction_type: 'city', state: 'NC', seats: 11, term_years: 2, is_partisan: true, salary: 31849, source_url: 'https://charlottenc.gov/CityCouncil' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Charlotte', jurisdiction_type: 'city', state: 'NC', seats: 1, term_years: 2, is_partisan: true, salary: 37107, source_url: 'https://charlottenc.gov/mayor' },
  { title: 'CMS School Board Member', office_level: 'school_board', jurisdiction_name: 'Charlotte-Mecklenburg Schools', jurisdiction_type: 'school_district', state: 'NC', seats: 9, term_years: 4, is_partisan: true, salary: 18000, source_url: 'https://www.cms.k12.nc.us/boe' },

  // -- Indianapolis, IN --
  { title: 'City-County Council Member', office_level: 'city_council', jurisdiction_name: 'City of Indianapolis', jurisdiction_type: 'city', state: 'IN', seats: 25, term_years: 4, is_partisan: true, salary: 11400, source_url: 'https://www.indy.gov/agency/city-county-council' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Indianapolis', jurisdiction_type: 'city', state: 'IN', seats: 1, term_years: 4, is_partisan: true, salary: 134733, source_url: 'https://www.indy.gov/agency/office-of-the-mayor' },
  { title: 'IPS School Board Commissioner', office_level: 'school_board', jurisdiction_name: 'Indianapolis Public Schools', jurisdiction_type: 'school_district', state: 'IN', seats: 7, term_years: 4, is_partisan: false, salary: 2000, source_url: 'https://www.myips.org/domain/39' },

  // -- San Francisco, CA --
  { title: 'Board of Supervisors Member', office_level: 'city_council', jurisdiction_name: 'City and County of San Francisco', jurisdiction_type: 'city', state: 'CA', seats: 11, term_years: 4, is_partisan: false, salary: 163110, source_url: 'https://sfbos.org/' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City and County of San Francisco', jurisdiction_type: 'city', state: 'CA', seats: 1, term_years: 4, is_partisan: false, salary: 362985, source_url: 'https://sfmayor.org/' },
  { title: 'SFUSD School Board Commissioner', office_level: 'school_board', jurisdiction_name: 'San Francisco Unified School District', jurisdiction_type: 'school_district', state: 'CA', seats: 7, term_years: 4, is_partisan: false, salary: 6000, source_url: 'https://www.sfusd.edu/about-sfusd/sfusd-board-education' },

  // -- Seattle, WA --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Seattle', jurisdiction_type: 'city', state: 'WA', seats: 9, term_years: 4, is_partisan: false, salary: 140898, source_url: 'https://www.seattle.gov/council' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Seattle', jurisdiction_type: 'city', state: 'WA', seats: 1, term_years: 4, is_partisan: false, salary: 255792, source_url: 'https://www.seattle.gov/mayor' },
  { title: 'SPS School Board Director', office_level: 'school_board', jurisdiction_name: 'Seattle Public Schools', jurisdiction_type: 'school_district', state: 'WA', seats: 7, term_years: 4, is_partisan: false, salary: 0, source_url: 'https://www.seattleschools.org/school-board/' },

  // -- Denver, CO --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City and County of Denver', jurisdiction_type: 'city', state: 'CO', seats: 13, term_years: 4, is_partisan: false, salary: 104604, source_url: 'https://www.denvergov.org/Government/Agencies-Departments-Offices/Denver-City-Council' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City and County of Denver', jurisdiction_type: 'city', state: 'CO', seats: 1, term_years: 4, is_partisan: false, salary: 200613, source_url: 'https://www.denvergov.org/Government/Agencies-Departments-Offices/Mayors-Office' },
  { title: 'DPS School Board Director', office_level: 'school_board', jurisdiction_name: 'Denver Public Schools', jurisdiction_type: 'school_district', state: 'CO', seats: 7, term_years: 4, is_partisan: false, salary: 0, source_url: 'https://www.dpsk12.org/board-of-education/' },

  // -- Washington, DC --
  { title: 'Council Member', office_level: 'city_council', jurisdiction_name: 'District of Columbia', jurisdiction_type: 'city', state: 'DC', seats: 13, term_years: 4, is_partisan: true, salary: 145260, source_url: 'https://dccouncil.us/' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'District of Columbia', jurisdiction_type: 'city', state: 'DC', seats: 1, term_years: 4, is_partisan: true, salary: 220000, source_url: 'https://mayor.dc.gov/' },
  { title: 'State Board of Education Member', office_level: 'school_board', jurisdiction_name: 'District of Columbia', jurisdiction_type: 'city', state: 'DC', seats: 9, term_years: 4, is_partisan: true, salary: 0, source_url: 'https://sboe.dc.gov/' },

  // -- Nashville, TN --
  { title: 'Metropolitan Council Member', office_level: 'city_council', jurisdiction_name: 'Metropolitan Government of Nashville-Davidson County', jurisdiction_type: 'city', state: 'TN', seats: 40, term_years: 4, is_partisan: false, salary: 30000, source_url: 'https://www.nashville.gov/departments/council' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'Metropolitan Government of Nashville-Davidson County', jurisdiction_type: 'city', state: 'TN', seats: 1, term_years: 4, is_partisan: false, salary: 195500, source_url: 'https://www.nashville.gov/departments/mayor' },
  { title: 'MNPS School Board Member', office_level: 'school_board', jurisdiction_name: 'Metro Nashville Public Schools', jurisdiction_type: 'school_district', state: 'TN', seats: 9, term_years: 4, is_partisan: false, salary: 0, source_url: 'https://www.mnps.org/about/school-board' },

  // -- Oklahoma City, OK --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Oklahoma City', jurisdiction_type: 'city', state: 'OK', seats: 8, term_years: 4, is_partisan: false, salary: 24000, source_url: 'https://www.okc.gov/government/city-council' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Oklahoma City', jurisdiction_type: 'city', state: 'OK', seats: 1, term_years: 4, is_partisan: false, salary: 24000, source_url: 'https://www.okc.gov/government/mayor' },
  { title: 'OKCPS School Board Member', office_level: 'school_board', jurisdiction_name: 'Oklahoma City Public Schools', jurisdiction_type: 'school_district', state: 'OK', seats: 7, term_years: 4, is_partisan: false, salary: 0, source_url: 'https://www.okcps.org/domain/63' },

  // -- El Paso, TX --
  { title: 'City Council Representative', office_level: 'city_council', jurisdiction_name: 'City of El Paso', jurisdiction_type: 'city', state: 'TX', seats: 8, term_years: 4, is_partisan: false, salary: 45000, source_url: 'https://www.elpasotexas.gov/city-government/city-council/' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of El Paso', jurisdiction_type: 'city', state: 'TX', seats: 1, term_years: 4, is_partisan: false, salary: 59000, source_url: 'https://www.elpasotexas.gov/city-government/mayor/' },

  // -- Boston, MA --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Boston', jurisdiction_type: 'city', state: 'MA', seats: 13, term_years: 2, is_partisan: false, salary: 103500, source_url: 'https://www.boston.gov/departments/city-council' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Boston', jurisdiction_type: 'city', state: 'MA', seats: 1, term_years: 4, is_partisan: false, salary: 207000, source_url: 'https://www.boston.gov/departments/mayor' },
  { title: 'BPS School Committee Member', office_level: 'school_board', jurisdiction_name: 'Boston Public Schools', jurisdiction_type: 'school_district', state: 'MA', seats: 7, term_years: 4, is_partisan: false, salary: 0, source_url: 'https://www.bostonpublicschools.org/domain/162' },

  // -- Portland, OR --
  { title: 'City Council Member', office_level: 'city_council', jurisdiction_name: 'City of Portland', jurisdiction_type: 'city', state: 'OR', seats: 12, term_years: 4, is_partisan: false, salary: 124380, source_url: 'https://www.portland.gov/council' },
  { title: 'Mayor', office_level: 'mayor', jurisdiction_name: 'City of Portland', jurisdiction_type: 'city', state: 'OR', seats: 1, term_years: 4, is_partisan: false, salary: 154368, source_url: 'https://www.portland.gov/mayor' },
  { title: 'PPS School Board Member', office_level: 'school_board', jurisdiction_name: 'Portland Public Schools', jurisdiction_type: 'school_district', state: 'OR', seats: 7, term_years: 4, is_partisan: false, salary: 0, source_url: 'https://www.pps.net/domain/219' },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n=== Seed Local Offices ===`);
  console.log(`Offices to seed: ${LOCAL_OFFICES.length}`);
  console.log(`Dry run: ${dryRun}\n`);

  let inserted = 0;
  let updated = 0;

  for (const office of LOCAL_OFFICES) {
    if (dryRun) {
      console.log(`[DRY RUN] Would upsert: ${office.jurisdiction_name} — ${office.title} (${office.seats} seats)`);
      continue;
    }

    const { rows } = await pool.query(
      `INSERT INTO local_offices
         (title, office_level, jurisdiction_name, jurisdiction_type, state,
          seats, term_years, is_partisan, salary, source_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT ON CONSTRAINT local_offices_jurisdiction_title_level_key DO UPDATE SET
         jurisdiction_type = EXCLUDED.jurisdiction_type,
         seats = EXCLUDED.seats,
         term_years = EXCLUDED.term_years,
         is_partisan = EXCLUDED.is_partisan,
         salary = EXCLUDED.salary,
         source_url = EXCLUDED.source_url,
         updated_at = NOW()
       RETURNING (xmax = 0) AS is_insert`,
      [
        office.title, office.office_level, office.jurisdiction_name,
        office.jurisdiction_type, office.state, office.seats,
        office.term_years, office.is_partisan, office.salary,
        office.source_url,
      ]
    );

    if (rows[0].is_insert) {
      inserted++;
      console.log(`  INSERTED: ${office.jurisdiction_name} — ${office.title}`);
    } else {
      updated++;
      console.log(`  UPDATED:  ${office.jurisdiction_name} — ${office.title}`);
    }
  }

  if (!dryRun) {
    console.log(`\n=== Seed Complete ===`);
    console.log(`Inserted: ${inserted}  Updated: ${updated}  Total: ${LOCAL_OFFICES.length}`);
  } else {
    console.log(`\n[DRY RUN] Would process ${LOCAL_OFFICES.length} local offices`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
