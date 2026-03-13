// Quick test - run with: node test-bills-api.js
require('dotenv').config();

const API_KEY = process.env.OPEN_STATES_API_KEY || '07151895-04a9-485f-abc5-f154b4431b32';

async function test() {
  console.log('Testing Open States Bills API...\n');
  
  // Test 1: Get bills directly (no session needed)
  console.log('1. Fetching WI bills directly...');
  try {
    const response = await fetch(
      'https://v3.openstates.org/bills?jurisdiction=wi&per_page=5&include=votes',
      { headers: { 'X-API-KEY': API_KEY } }
    );
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Bills found: ${data.results?.length || 0}`);
    if (data.results?.[0]) {
      console.log(`   First bill: ${data.results[0].identifier} - ${data.results[0].title?.substring(0, 50)}...`);
      console.log(`   Session: ${data.results[0].session}`);
      console.log(`   Votes: ${data.results[0].votes?.length || 0}`);
    }
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }

  // Test 2: Get jurisdiction info
  console.log('\n2. Fetching WI jurisdiction...');
  try {
    const response = await fetch(
      'https://v3.openstates.org/jurisdictions/ocd-jurisdiction/country:us/state:wi/government',
      { headers: { 'X-API-KEY': API_KEY } }
    );
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Name: ${data.name}`);
    console.log(`   Sessions: ${data.legislative_sessions?.length || 0}`);
    if (data.legislative_sessions?.[0]) {
      console.log(`   Latest session: ${data.legislative_sessions[0].identifier}`);
    }
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }

  // Test 3: Get recent bills with action_since
  console.log('\n3. Fetching recent WI bills (action in last 90 days)...');
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceStr = since.toISOString().split('T')[0];
  
  try {
    const response = await fetch(
      `https://v3.openstates.org/bills?jurisdiction=wi&action_since=${sinceStr}&per_page=5&include=votes`,
      { headers: { 'X-API-KEY': API_KEY } }
    );
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Bills found: ${data.results?.length || 0}`);
    console.log(`   Total pages: ${data.pagination?.max_page || 0}`);
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }
}

test();
