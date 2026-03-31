#!/usr/bin/env node

/**
 * Compute Political ROI
 *
 * Calculates the return-on-investment ratio for political spending by
 * corporations, industries, PACs, and other entities. Cross-references
 * campaign contributions with government contracts, foreign aid disbursements,
 * and other policy returns to produce an ROI ratio.
 *
 * Results are upserted into the political_roi_entities table for the
 * ROI Calculator widget.
 *
 * Usage:
 *   node scripts/compute-political-roi.js
 *   node scripts/compute-political-roi.js --dry-run
 *   node scripts/compute-political-roi.js --entity=lockheed-martin
 *   node scripts/compute-political-roi.js --cycle=2024
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = { dryRun: false, entity: null, cycle: new Date().getFullYear() };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg.startsWith('--entity=')) {
      args.entity = arg.split('=')[1];
    } else if (arg.startsWith('--cycle=')) {
      args.cycle = parseInt(arg.split('=')[1], 10);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatDollars(amount) {
  if (!amount) return '$0';
  const n = Number(amount);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Step 1: Get entities with political spending from contributions
// ---------------------------------------------------------------------------

async function getEntitiesWithSpending(cycle, singleEntity) {
  // Group contributions by contributor employer/industry to find total
  // political spending per entity.
  const params = [];
  let whereClause = '';

  if (singleEntity) {
    whereClause = `
      AND (
        LOWER(REPLACE(c.contributor_employer, ' ', '-')) = $1
        OR LOWER(REPLACE(cont.industry, ' ', '-')) = $1
        OR LOWER(REPLACE(cont.name, ' ', '-')) = $1
      )
    `;
    params.push(singleEntity.toLowerCase());
  }

  const { rows } = await pool.query(
    `SELECT
       COALESCE(c.contributor_employer, cont.industry, cont.name) AS entity_name,
       CASE
         WHEN cont.contributor_type = 'pac' THEN 'pac'
         WHEN cont.contributor_type = 'union' THEN 'union'
         WHEN cont.industry IS NOT NULL THEN 'industry'
         ELSE 'corporation'
       END AS entity_type,
       SUM(c.amount) AS total_political_spend,
       COUNT(DISTINCT c.candidate_id) AS candidates_funded,
       COUNT(*) AS contribution_count
     FROM contributions c
     LEFT JOIN contributors cont ON cont.id = c.contributor_id
     WHERE c.election_cycle = $${params.length + 1}
       AND COALESCE(c.contributor_employer, cont.industry, cont.name) IS NOT NULL
       ${whereClause}
     GROUP BY
       COALESCE(c.contributor_employer, cont.industry, cont.name),
       CASE
         WHEN cont.contributor_type = 'pac' THEN 'pac'
         WHEN cont.contributor_type = 'union' THEN 'union'
         WHEN cont.industry IS NOT NULL THEN 'industry'
         ELSE 'corporation'
       END
     HAVING SUM(c.amount) > 0
     ORDER BY SUM(c.amount) DESC
     LIMIT 500`,
    [...params, String(cycle)]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Step 2: Compute policy returns (contracts + foreign aid disbursements)
// ---------------------------------------------------------------------------

async function computePolicyReturn(entityName) {
  // Look for matching government contracts / foreign aid transactions
  // where the recipient matches the entity name
  const nameLike = `%${entityName}%`;

  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(disbursement_amount), 0) AS total_return,
       COUNT(*) AS contract_count
     FROM foreign_aid_transactions
     WHERE LOWER(recipient_name) LIKE LOWER($1)`,
    [nameLike]
  );

  return {
    totalReturn: parseFloat(rows[0].total_return) || 0,
    contractCount: parseInt(rows[0].contract_count, 10) || 0,
  };
}

// ---------------------------------------------------------------------------
// Step 3: Get top 5 politicians funded by entity
// ---------------------------------------------------------------------------

async function getTopPoliticians(entityName, cycle) {
  const { rows } = await pool.query(
    `SELECT
       c.candidate_id,
       cp.display_name AS name,
       cp.party_affiliation AS party,
       cp.fec_office_type AS office,
       cp.fec_state AS state,
       SUM(c.amount) AS total_amount,
       COUNT(*) AS contribution_count
     FROM contributions c
     JOIN candidate_profiles cp ON cp.id = c.candidate_id
     WHERE (
       LOWER(c.contributor_employer) LIKE LOWER($1)
       OR LOWER(c.contributor_name) LIKE LOWER($1)
     )
       AND c.election_cycle = $2
     GROUP BY c.candidate_id, cp.display_name, cp.party_affiliation, cp.fec_office_type, cp.fec_state
     ORDER BY SUM(c.amount) DESC
     LIMIT 5`,
    [`%${entityName}%`, String(cycle)]
  );

  return rows.map((r) => ({
    candidate_id: r.candidate_id,
    name: r.name,
    party: r.party,
    office: r.office,
    state: r.state,
    total_amount: parseFloat(r.total_amount),
    contribution_count: parseInt(r.contribution_count, 10),
  }));
}

// ---------------------------------------------------------------------------
// Step 4: Get top 5 contracts/disbursements where entity is recipient
// ---------------------------------------------------------------------------

async function getTopContracts(entityName) {
  const { rows } = await pool.query(
    `SELECT
       id,
       agency_name,
       program_name,
       category,
       fiscal_year,
       disbursement_amount,
       country_name
     FROM foreign_aid_transactions
     WHERE LOWER(recipient_name) LIKE LOWER($1)
     ORDER BY disbursement_amount DESC
     LIMIT 5`,
    [`%${entityName}%`]
  );

  return rows.map((r) => ({
    id: r.id,
    agency: r.agency_name,
    program: r.program_name,
    category: r.category,
    fiscal_year: r.fiscal_year,
    amount: parseFloat(r.disbursement_amount),
    country: r.country_name,
  }));
}

// ---------------------------------------------------------------------------
// Step 5: Upsert into political_roi_entities
// ---------------------------------------------------------------------------

async function upsertEntity(entity, dryRun) {
  const slug = slugify(entity.entityName);

  if (dryRun) {
    console.log(`  [DRY RUN] Would upsert: ${slug}`);
    console.log(`    Spend: ${formatDollars(entity.totalSpend)}  Return: ${formatDollars(entity.totalReturn)}  ROI: ${entity.roiRatio.toFixed(2)}x`);
    console.log(`    Top politicians: ${entity.topPoliticians.length}  Top contracts: ${entity.topContracts.length}`);
    return;
  }

  await pool.query(
    `INSERT INTO political_roi_entities (
       entity_slug, entity_name, entity_type,
       total_political_spend, total_policy_return, roi_ratio,
       cycle_year, top_politicians, top_contracts,
       methodology_note, source_urls, last_computed_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
     ON CONFLICT (entity_slug) DO UPDATE SET
       entity_name = EXCLUDED.entity_name,
       entity_type = EXCLUDED.entity_type,
       total_political_spend = EXCLUDED.total_political_spend,
       total_policy_return = EXCLUDED.total_policy_return,
       roi_ratio = EXCLUDED.roi_ratio,
       cycle_year = EXCLUDED.cycle_year,
       top_politicians = EXCLUDED.top_politicians,
       top_contracts = EXCLUDED.top_contracts,
       methodology_note = EXCLUDED.methodology_note,
       source_urls = EXCLUDED.source_urls,
       last_computed_at = NOW(),
       updated_at = NOW()`,
    [
      slug,
      entity.entityName,
      entity.entityType,
      entity.totalSpend,
      entity.totalReturn,
      entity.roiRatio,
      entity.cycle,
      JSON.stringify(entity.topPoliticians),
      JSON.stringify(entity.topContracts),
      'ROI = total_policy_return / GREATEST(total_political_spend, 1). Policy return derived from USASpending contract/aid data matched by recipient name.',
      ['https://www.usaspending.gov', 'https://www.fec.gov'],
    ]
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  console.log('=== Compute Political ROI ===');
  console.log(`Cycle: ${args.cycle}  Dry run: ${args.dryRun}  Entity filter: ${args.entity || 'all'}`);
  console.log('');

  // Step 1: Get entities with political spending
  console.log('Fetching entities with political spending...');
  const entities = await getEntitiesWithSpending(args.cycle, args.entity);
  console.log(`Found ${entities.length} entities with contributions in cycle ${args.cycle}.`);
  console.log('');

  let processed = 0;
  let skipped = 0;

  for (const entity of entities) {
    const name = entity.entity_name;
    const spend = parseFloat(entity.total_political_spend) || 0;

    if (spend <= 0) {
      skipped++;
      continue;
    }

    // Step 2: Get policy return
    const { totalReturn } = await computePolicyReturn(name);

    // Step 3: Compute ROI
    const roiRatio = totalReturn / Math.max(spend, 1);

    // Step 4: Top politicians
    const topPoliticians = await getTopPoliticians(name, args.cycle);

    // Step 5: Top contracts
    const topContracts = await getTopContracts(name);

    // Step 6: Upsert
    const record = {
      entityName: name,
      entityType: entity.entity_type,
      totalSpend: spend,
      totalReturn: totalReturn,
      roiRatio: roiRatio,
      cycle: args.cycle,
      topPoliticians: topPoliticians,
      topContracts: topContracts,
    };

    await upsertEntity(record, args.dryRun);
    processed++;

    if (processed % 25 === 0) {
      console.log(`  Progress: ${processed}/${entities.length} entities processed...`);
    }
  }

  console.log('');
  console.log('=== Complete ===');
  console.log(`Processed: ${processed}  Skipped: ${skipped}  Total: ${entities.length}`);

  if (args.dryRun) {
    console.log('(Dry run — no rows were written.)');
  }
}

main()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    pool.end();
    process.exit(1);
  });
