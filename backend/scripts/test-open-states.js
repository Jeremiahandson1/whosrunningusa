#!/usr/bin/env node

/**
 * Quick API test - verifies Open States connection works
 * 
 * Usage: OPEN_STATES_API_KEY=your_key node scripts/test-open-states.js
 */

require('dotenv').config();

const OpenStatesClient = require('../services/ingestion/openStatesClient');

async function test() {
  const apiKey = process.env.OPEN_STATES_API_KEY;
  
  if (!apiKey) {
    console.error('ERROR: Set OPEN_STATES_API_KEY environment variable');
    console.error('Usage: OPEN_STATES_API_KEY=your_key node scripts/test-open-states.js');
    process.exit(1);
  }

  console.log('Testing Open States API...');
  console.log('API Key:', apiKey.substring(0, 8) + '...');
  console.log('');

  const client = new OpenStatesClient(apiKey);

  try {
    // Test 1: Get Wisconsin legislators (small request)
    console.log('1. Fetching Wisconsin legislators (first 5)...');
    const wiResponse = await client.getPeople({
      jurisdiction: 'wi',
      org_classification: 'legislature',
      current_only: true,
      per_page: 5
    });

    console.log('   ✓ Success!');
    console.log(`   Total WI legislators: ${wiResponse.pagination?.total_items || 'unknown'}`);
    console.log('   Sample:');
    
    for (const person of (wiResponse.results || []).slice(0, 3)) {
      const role = person.current_role || {};
      console.log(`     - ${person.name} (${person.party}) - ${role.title || 'Legislator'}`);
    }
    console.log('');

    // Test 2: Transform data
    console.log('2. Testing data transformation...');
    if (wiResponse.results?.[0]) {
      const transformed = client.transformPerson(wiResponse.results[0]);
      console.log('   ✓ Transform successful');
      console.log(`   Sample: ${transformed.displayName} -> ${transformed.officeName}`);
    }
    console.log('');

    console.log('='.repeat(50));
    console.log('All tests passed! Ready to sync.');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run migration: psql -d whosrunningusa -f migrations/005-open-states-source.sql');
    console.log('  2. Sync WI: npm run sync:openstates -- WI');
    console.log('  3. Or sync all: npm run sync:openstates');
    console.log('='.repeat(50));

  } catch (err) {
    console.error('');
    console.error('ERROR:', err.message);
    
    if (err.message.includes('401')) {
      console.error('Invalid API key. Get one at: https://open.pluralpolicy.com/accounts/profile/');
    } else if (err.message.includes('429')) {
      console.error('Rate limited. Wait a minute and try again.');
    } else if (err.message.includes('fetch')) {
      console.error('Network error. Check your internet connection.');
    }
    
    process.exit(1);
  }
}

test();