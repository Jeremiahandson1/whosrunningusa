#!/usr/bin/env node

/**
 * Sync federal congressional data from Congress.gov API
 * 
 * Usage:
 *   npm run sync:congress                    # Current congress members
 *   npm run sync:congress -- --bills         # Current congress bills
 *   npm run sync:congress -- --congress=117  # Specific congress
 *   npm run sync:congress -- --members       # Members only
 *   npm run sync:congress -- --state=WI      # Members from state
 */

require('dotenv').config();
const db = require('../db');
const CongressGovClient = require('../services/ingestion/congressGovClient');

const client = new CongressGovClient();

// Current congress (119th: 2025-2027)
const CURRENT_CONGRESS = 119;

/**
 * State name to abbreviation mapping
 */
const stateAbbreviations = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC', 'Puerto Rico': 'PR', 'Guam': 'GU', 'Virgin Islands': 'VI',
  'American Samoa': 'AS', 'Northern Mariana Islands': 'MP'
};

/**
 * Upsert a Congress member
 */
async function upsertMember(member) {
  const transformed = client.transformMember(member);
  // Convert state name to abbreviation
  const stateAbbr = stateAbbreviations[transformed.state] || transformed.state;
  
  // Check if we have this member by bioguide ID
  const existing = await db.query(
    `SELECT id FROM candidate_profiles 
     WHERE verification_external_id = $1 AND verification_source = 'congress_gov'`,
    [transformed.bioguideId]
  );

  if (existing.rows.length > 0) {
    // Update existing
    await db.query(`
      UPDATE candidate_profiles SET
        display_name = $2,
        party_affiliation = $3,
        official_title = $4,
        campaign_website = COALESCE($5, campaign_website),
        verification_last_checked = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [
      existing.rows[0].id,
      transformed.name,
      transformed.party,
      transformed.chamber === 'lower' ? 'U.S. Representative' : 'U.S. Senator',
      transformed.officialUrl
    ]);
    return { id: existing.rows[0].id, action: 'updated' };
  }

  // Try to match by FEC ID or name
  let candidateId = null;

  // Try matching FEC profiles by last name + state + office type
  // FEC names: "VAN ORDEN, DERRICK F. MR." / Congress names: "Van Orden, Derrick"
  const lastName = (transformed.lastName || transformed.name.split(',')[0] || '').trim();
  const officeType = transformed.chamber === 'lower' ? 'H' : 'S';
  const fecMatch = await db.query(`
    SELECT id FROM candidate_profiles
    WHERE fec_state = $1
      AND fec_office_type = $2
      AND (
        LOWER(display_name) LIKE LOWER($3)
        OR LOWER(display_name) = LOWER($4)
      )
    ORDER BY
      CASE WHEN LOWER(display_name) = LOWER($4) THEN 0 ELSE 1 END
    LIMIT 1
  `, [stateAbbr, officeType, `${lastName},%`, transformed.name]);

  if (fecMatch.rows.length > 0) {
    candidateId = fecMatch.rows[0].id;

    await db.query(`
      UPDATE candidate_profiles SET
        display_name = $2,
        official_title = $3,
        campaign_website = COALESCE($4, campaign_website),
        verification_source = 'congress_gov',
        verification_external_id = $5,
        verification_last_checked = NOW(),
        candidate_verified = TRUE,
        candidate_verified_at = COALESCE(candidate_verified_at, NOW()),
        updated_at = NOW()
      WHERE id = $1
    `, [candidateId, transformed.name,
        transformed.chamber === 'lower' ? 'U.S. Representative' : 'U.S. Senator',
        transformed.officialUrl, transformed.bioguideId]);

    return { id: candidateId, action: 'linked' };
  }

  // Try name match via candidacies (for non-FEC profiles)
  const nameMatch = await db.query(`
    SELECT cp.id FROM candidate_profiles cp
    JOIN candidacies c ON cp.id = c.candidate_id
    JOIN races r ON c.race_id = r.id
    JOIN offices o ON r.office_id = o.id
    WHERE LOWER(cp.display_name) = LOWER($1)
      AND o.state = $2
      AND o.office_level = 'federal'
    LIMIT 1
  `, [transformed.name, stateAbbr]);

  if (nameMatch.rows.length > 0) {
    candidateId = nameMatch.rows[0].id;

    await db.query(`
      UPDATE candidate_profiles SET
        verification_source = 'congress_gov',
        verification_external_id = $2,
        verification_last_checked = NOW(),
        candidate_verified = TRUE,
        updated_at = NOW()
      WHERE id = $1
    `, [candidateId, transformed.bioguideId]);

    return { id: candidateId, action: 'linked' };
  }

  // Create new candidate profile
  const insertResult = await db.query(`
    INSERT INTO candidate_profiles (
      display_name, party_affiliation, official_title,
      campaign_website, verification_source, verification_external_id,
      verification_last_checked, candidate_verified, candidate_verified_at,
      is_shadow_profile, is_active
    ) VALUES ($1, $2, $3, $4, 'congress_gov', $5, NOW(), TRUE, NOW(), TRUE, TRUE)
    RETURNING id
  `, [
    transformed.name,
    transformed.party,
    transformed.chamber === 'lower' ? 'U.S. Representative' : 'U.S. Senator',
    transformed.officialUrl,
    transformed.bioguideId
  ]);

  return { id: insertResult.rows[0].id, action: 'created' };
}

/**
 * Upsert a bill from Congress.gov
 */
async function upsertBill(bill) {
  const transformed = client.transformBill(bill);
  
  const existing = await db.query(
    `SELECT id FROM bills WHERE external_id = $1`,
    [transformed.externalId]
  );

  if (existing.rows.length > 0) {
    await db.query(`
      UPDATE bills SET
        title = $2,
        description = $3,
        status = $4,
        last_action_date = $5,
        categories = $6,
        updated_at = NOW()
      WHERE id = $1
    `, [
      existing.rows[0].id,
      transformed.title,
      transformed.description,
      transformed.status,
      transformed.lastActionDate,
      transformed.categories
    ]);
    return { id: existing.rows[0].id, action: 'updated' };
  }

  const insertResult = await db.query(`
    INSERT INTO bills (
      external_id, bill_number, title, description, state, chamber, session,
      introduced_date, last_action_date, status, categories, source, source_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id
  `, [
    transformed.externalId,
    transformed.billNumber,
    transformed.title,
    transformed.description,
    transformed.state,
    transformed.chamber,
    transformed.session,
    transformed.introducedDate,
    transformed.lastActionDate,
    transformed.status,
    transformed.categories,
    transformed.source,
    transformed.sourceUrl
  ]);

  return { id: insertResult.rows[0].id, action: 'created' };
}

/**
 * Sync members of congress
 */
async function syncMembers(congress, options = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Syncing Congress members for ${congress}th Congress`);
  console.log('='.repeat(60));

  const stats = {
    created: 0,
    updated: 0,
    linked: 0,
    errors: 0
  };

  try {
    // Get all members for this congress (with pagination)
    console.log('\nFetching members...');
    const members = await client.getAllMembers(congress, { currentMember: false });
    let filteredMembers = members;
    console.log(`Found ${members.length} total members`);

    // Filter by state if specified
    if (options.state) {
      const stateUpper = options.state.toUpperCase();
      // Map state abbreviation to full name
      const stateNames = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
        'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
        'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
        'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
        'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
        'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
        'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
        'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
        'DC': 'District of Columbia', 'PR': 'Puerto Rico', 'GU': 'Guam', 'VI': 'Virgin Islands',
        'AS': 'American Samoa', 'MP': 'Northern Mariana Islands'
      };
      const stateName = stateNames[stateUpper] || stateUpper;
      filteredMembers = filteredMembers.filter(m => m.state === stateName);
      console.log(`Filtered to ${filteredMembers.length} members from ${stateName}`);
    }

    // Filter by chamber if specified
    if (options.chamber) {
      const chamberMap = { 'house': 'House of Representatives', 'senate': 'Senate' };
      const chamberName = chamberMap[options.chamber.toLowerCase()];
      if (chamberName) {
        filteredMembers = filteredMembers.filter(m => m.terms?.item?.some(t => t.chamber === chamberName));
        console.log(`Filtered to ${filteredMembers.length} ${options.chamber} members`);
      }
    }

    for (const member of filteredMembers) {
      try {
        const result = await upsertMember(member);
        stats[result.action]++;
      } catch (err) {
        stats.errors++;
        console.error(`Error processing ${member.name}:`, err.message);
      }
    }

  } catch (err) {
    console.error('Error syncing members:', err.message);
    stats.errors++;
  }

  console.log('\n' + '='.repeat(60));
  console.log('Member Sync Complete');
  console.log('='.repeat(60));
  console.log(`Created: ${stats.created}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Linked:  ${stats.linked}`);
  console.log(`Errors:  ${stats.errors}`);
  console.log('='.repeat(60));

  return stats;
}

/**
 * Upsert a bill sponsorship linking a member to a bill
 */
async function upsertSponsorship(candidateId, billId, billData, type) {
  try {
    await db.query(`
      INSERT INTO bill_sponsorships (
        candidate_id, bill_id, sponsorship_type, bill_number, bill_title,
        bill_state, bill_session, source
      ) VALUES ($1, $2, $3, $4, $5, 'US', $6, 'congress_gov')
      ON CONFLICT (candidate_id, bill_id, sponsorship_type) DO UPDATE SET
        bill_title = $5,
        bill_session = $6
    `, [
      candidateId,
      billId,
      type,
      billData.number ? `${billData.type} ${billData.number}` : null,
      billData.title,
      billData.congress?.toString()
    ]);
  } catch (err) {
    // Ignore duplicate/constraint errors
    if (!err.message.includes('duplicate') && !err.message.includes('violates')) {
      throw err;
    }
  }
}

/**
 * Sync sponsorships for a member
 */
async function syncMemberSponsorships(candidateId, bioguideId) {
  let sponsorships = 0;
  try {
    // Sponsored legislation
    const sponsored = await client.getMemberSponsoredLegislation(bioguideId, { limit: 50 });
    const sponsoredBills = sponsored.sponsoredLegislation || [];

    for (const bill of sponsoredBills) {
      try {
        const billResult = await upsertBill(bill);
        await upsertSponsorship(candidateId, billResult.id, bill, 'primary');
        sponsorships++;
      } catch (err) {
        // Skip individual failures
      }
    }

    // Cosponsored legislation
    const cosponsored = await client.getMemberCosponsoredLegislation(bioguideId, { limit: 50 });
    const cosponsoredBills = cosponsored.cosponsoredLegislation || [];

    for (const bill of cosponsoredBills) {
      try {
        const billResult = await upsertBill(bill);
        await upsertSponsorship(candidateId, billResult.id, bill, 'cosponsor');
        sponsorships++;
      } catch (err) {
        // Skip individual failures
      }
    }
  } catch (err) {
    console.error(`  Error syncing sponsorships for ${bioguideId}:`, err.message);
  }
  return sponsorships;
}

/**
 * Sync bills from Congress.gov
 */
async function syncBills(congress, options = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Syncing bills for ${congress}th Congress`);
  console.log('='.repeat(60));

  const stats = {
    created: 0,
    updated: 0,
    errors: 0
  };

  const billTypes = options.billType
    ? [options.billType]
    : ['hr', 's']; // House bills and Senate bills

  for (const billType of billTypes) {
    console.log(`\nFetching ${billType.toUpperCase()} bills...`);

    let offset = 0;
    const limit = 20;
    let hasMore = true;
    let totalFetched = 0;
    const maxBills = options.maxBills || 100;

    while (hasMore && totalFetched < maxBills) {
      try {
        const response = await client.getBills(congress, billType, { limit, offset });
        const bills = response.bills || [];

        if (bills.length === 0) {
          hasMore = false;
          break;
        }

        for (const bill of bills) {
          try {
            const result = await upsertBill(bill);
            stats[result.action]++;
            totalFetched++;
          } catch (err) {
            stats.errors++;
            console.error(`Error processing ${bill.number}:`, err.message);
          }
        }

        console.log(`  Processed ${totalFetched} ${billType.toUpperCase()} bills...`);
        offset += limit;

        if (bills.length < limit) {
          hasMore = false;
        }
      } catch (err) {
        console.error(`Error fetching bills:`, err.message);
        hasMore = false;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Bills Sync Complete');
  console.log('='.repeat(60));
  console.log(`Created: ${stats.created}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Errors:  ${stats.errors}`);
  console.log('='.repeat(60));

  return stats;
}

/**
 * Ensure congress_gov data source exists and start a sync run
 */
async function startTrackedSync(metadata) {
  await db.query(`
    INSERT INTO data_sources (id, name, display_name, source_type, base_url, api_key_env_var, sync_frequency_hours)
    VALUES (
      '00000000-0000-0000-0000-000000000005',
      'congress_gov',
      'Congress.gov',
      'api',
      'https://api.congress.gov/v3',
      'CONGRESS_GOV_API_KEY',
      168
    )
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      base_url = EXCLUDED.base_url,
      name = EXCLUDED.name
  `);

  const result = await db.query(
    `INSERT INTO sync_runs (data_source_id, metadata) VALUES ('00000000-0000-0000-0000-000000000005', $1) RETURNING id`,
    [JSON.stringify(metadata)]
  );
  return result.rows[0].id;
}

async function completeTrackedSync(syncRunId, stats) {
  await db.query(
    `UPDATE sync_runs SET
      completed_at = NOW(),
      status = $2,
      records_fetched = $3,
      records_created = $4,
      records_updated = $5,
      errors_count = $6
     WHERE id = $1`,
    [syncRunId, stats.errors > 0 ? 'partial' : 'success',
     (stats.created || 0) + (stats.updated || 0) + (stats.linked || 0),
     stats.created || 0, stats.updated || 0, stats.errors || 0]
  );

  await db.query(
    `UPDATE data_sources SET last_sync_at = NOW(), last_sync_status = $1
     WHERE name = 'congress_gov'`,
    [stats.errors > 0 ? 'partial' : 'success']
  );
}

/**
 * Main sync function
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const options = {
    congress: CURRENT_CONGRESS,
    members: false,
    bills: false,
    sponsorships: false,
    state: null,
    chamber: null,
    billType: null,
    maxBills: 100
  };

  for (const arg of args) {
    if (arg.startsWith('--congress=')) {
      options.congress = parseInt(arg.split('=')[1]);
    } else if (arg === '--members') {
      options.members = true;
    } else if (arg === '--bills') {
      options.bills = true;
    } else if (arg === '--sponsorships') {
      options.sponsorships = true;
    } else if (arg.startsWith('--state=')) {
      options.state = arg.split('=')[1];
    } else if (arg.startsWith('--chamber=')) {
      options.chamber = arg.split('=')[1];
    } else if (arg.startsWith('--bill-type=')) {
      options.billType = arg.split('=')[1];
    } else if (arg.startsWith('--max-bills=')) {
      options.maxBills = parseInt(arg.split('=')[1]);
    }
  }

  // Default to members if nothing specified
  if (!options.members && !options.bills && !options.sponsorships) {
    options.members = true;
  }

  console.log('Congress.gov Sync');
  console.log(`Congress: ${options.congress}`);
  console.log(`State filter: ${options.state || 'none'}`);

  const syncRunId = await startTrackedSync(options);
  const allStats = { created: 0, updated: 0, linked: 0, errors: 0 };

  try {
    if (options.members) {
      const stats = await syncMembers(options.congress, options);
      allStats.created += stats.created;
      allStats.updated += stats.updated;
      allStats.linked += stats.linked;
      allStats.errors += stats.errors;
    }

    if (options.bills) {
      const stats = await syncBills(options.congress, options);
      allStats.created += stats.created;
      allStats.updated += stats.updated;
      allStats.errors += stats.errors;
    }

    if (options.sponsorships) {
      console.log(`\n${'='.repeat(60)}`);
      console.log('Syncing member sponsorships');
      console.log('='.repeat(60));

      // Get all congress_gov candidates
      const candidates = await db.query(
        `SELECT id, verification_external_id FROM candidate_profiles
         WHERE verification_source = 'congress_gov' AND verification_external_id IS NOT NULL`
      );

      let totalSponsorships = 0;
      for (const c of candidates.rows) {
        const count = await syncMemberSponsorships(c.id, c.verification_external_id);
        totalSponsorships += count;
      }
      console.log(`Synced ${totalSponsorships} sponsorships for ${candidates.rows.length} members`);
    }

    await completeTrackedSync(syncRunId, allStats);
  } catch (err) {
    console.error('Sync failed:', err);
    allStats.errors++;
    await completeTrackedSync(syncRunId, allStats).catch(() => {});
    process.exit(1);
  }

  console.log('\nDone!');
  process.exit(0);
}

main();