const API_KEY = '07151895-04a9-485f-abc5-f154b4431b32';

async function test(url, label) {
  console.log(`\n${label}:`);
  console.log(url);
  
  const response = await fetch(url, {
    headers: { 'X-API-KEY': API_KEY, 'Accept': 'application/json' }
  });
  
  const data = await response.json();
  console.log(`Results: ${data.results?.length || 0}, Total: ${data.pagination?.total_items || 0}`);
  
  if (data.results?.[0]) {
    console.log('First result:', data.results[0].name, '-', data.results[0].current_role?.title);
  }
}

async function run() {
  // Try different parameter combinations
  await test('https://v3.openstates.org/people?jurisdiction=wi&per_page=5', 'WI - no filter');
  await test('https://v3.openstates.org/people?jurisdiction=wi&org_classification=upper&per_page=5', 'WI - upper (Senate)');
  await test('https://v3.openstates.org/people?jurisdiction=wi&org_classification=lower&per_page=5', 'WI - lower (Assembly)');
  await test('https://v3.openstates.org/people?jurisdiction=ocd-jurisdiction/country:us/state:wi/government&per_page=5', 'WI - full OCD ID');
  await test('https://v3.openstates.org/people?per_page=5', 'All states - no filter');
}

run().catch(err => console.error('Error:', err));