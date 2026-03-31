#!/usr/bin/env node

/**
 * Seed revenue_violations, revenue_violation_sources, and revenue_violation_actors
 * with 9 confirmed cases from government records.
 *
 * Usage:
 *   node scripts/seed-revenue-violations.js            # execute inserts
 *   node scripts/seed-revenue-violations.js --dry-run   # print SQL, don't execute
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') }); } catch(_) {}
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DRY_RUN = process.argv.includes('--dry-run');

// ─── The 9 confirmed cases ───────────────────────────────────────────────────

const violations = [
  // 1. Social Security Trust Fund
  {
    slug: 'social-security-trust-fund',
    category: 'trust_fund_raid',
    title: 'Social Security Trust Fund — $2.8 Trillion in IOUs',
    amount_dollars: 2800000000000,
    amount_display: '$2.8 Trillion',
    what_was_taken: 'Since 1983, surplus Social Security payroll taxes have been borrowed by the federal government and replaced with special-issue Treasury bonds (IOUs). The trust fund holds no real assets — only claims on future general revenue.',
    who_did_it: 'Every presidential administration and Congress since 1983. The unified budget framework treats Social Security surpluses as general revenue, masking the true deficit.',
    consequences_for_responsible: 'None. The practice is legal under current law and has been endorsed by both parties.',
    consequences_for_harmed: 'Social Security faces projected benefit cuts of 20-25% by 2035 unless Congress acts. Current beneficiaries are not yet affected; future retirees face reduced benefits.',
    harmed_parties: 'Current and future Social Security beneficiaries — approximately 67 million Americans receiving benefits',
    current_status: 'The OASI trust fund is projected to be depleted by 2033. At that point, incoming payroll taxes would cover only about 77% of scheduled benefits.',
    start_date: '1983-01-01',
    end_date: null,
    sources: [
      { source_label: 'SSA Trustees Report', source_url: 'https://www.ssa.gov/OACT/TR/2024/', source_type: 'government_report' },
      { source_label: 'CBO Long-Term Budget Outlook', source_url: 'https://www.cbo.gov/publication/59711', source_type: 'government_report' }
    ]
  },

  // 2. Highway Trust Fund
  {
    slug: 'highway-trust-fund',
    category: 'trust_fund_raid',
    title: 'Highway Trust Fund — $275 Billion in General Fund Bailouts',
    amount_dollars: 275000000000,
    amount_display: '$275 Billion',
    what_was_taken: 'The federal gas tax (18.4 cents/gallon, unchanged since 1993) was supposed to fund highway and transit infrastructure. Congress repeatedly transferred Highway Trust Fund money to non-highway programs while the gas tax failed to keep pace with inflation and fuel efficiency gains.',
    who_did_it: 'Congress has authorized over $275 billion in general fund transfers to the Highway Trust Fund since 2008 because dedicated revenue was insufficient after decades of diversions and failure to raise the gas tax.',
    consequences_for_responsible: 'None. Members of both parties have refused to raise the gas tax for over 30 years.',
    consequences_for_harmed: 'American drivers pay into a system that cannot fund basic road maintenance. The American Society of Civil Engineers rates US infrastructure a C-minus. 43% of public roadways are in poor or mediocre condition.',
    harmed_parties: 'American drivers and taxpayers; state and local governments dependent on federal highway funding',
    current_status: 'The Highway Trust Fund requires ongoing general fund transfers to remain solvent. The gas tax has not been raised since 1993.',
    start_date: '2008-01-01',
    end_date: null,
    sources: [
      { source_label: 'FHWA Highway Trust Fund Ticker', source_url: 'https://www.fhwa.dot.gov/highwaytrustfund/', source_type: 'government_report' },
      { source_label: 'GAO Highway Trust Fund Reports', source_url: 'https://www.gao.gov/products/gao-23-106015', source_type: 'government_report' }
    ]
  },

  // 3. Medicare Trust Fund
  {
    slug: 'medicare-trust-fund',
    category: 'trust_fund_raid',
    title: 'Medicare Trust Fund — Dedicated Payroll Taxes Absorbed Into General Revenue',
    amount_dollars: 0,
    amount_display: 'Projected insolvency by 2036',
    what_was_taken: 'Medicare Part A is funded by a dedicated 2.9% payroll tax. These funds are held in the Hospital Insurance Trust Fund, but like Social Security, surpluses have been spent on other programs and replaced with Treasury bonds.',
    who_did_it: 'The unified federal budget structure allows Medicare surpluses to offset general fund deficits. Congress has repeatedly failed to address structural funding shortfalls.',
    consequences_for_responsible: 'None.',
    consequences_for_harmed: 'The HI Trust Fund is projected to be depleted by 2036, at which point Medicare Part A payments to hospitals would be automatically reduced to match incoming revenue — approximately 89% of scheduled benefits.',
    harmed_parties: '65 million Medicare beneficiaries and growing',
    current_status: 'The 2024 Medicare Trustees Report projects HI Trust Fund depletion in 2036. No legislative fix has been enacted.',
    start_date: '1966-01-01',
    end_date: null,
    sources: [
      { source_label: 'CMS Medicare Trustees Report', source_url: 'https://www.cms.gov/oact/tr', source_type: 'government_report' },
      { source_label: 'CBO Medicare Spending Projections', source_url: 'https://www.cbo.gov/topics/health-care/medicare', source_type: 'government_report' }
    ]
  },

  // 4. TARP Bank Bailout
  {
    slug: 'tarp-bank-bailout',
    category: 'corporate_bailout',
    title: 'TARP — $443.5 Billion Disbursed to 989 Recipients',
    amount_dollars: 443500000000,
    amount_display: '$443.5 Billion',
    what_was_taken: 'The Troubled Asset Relief Program disbursed $443.5 billion to 989 financial institutions, auto companies, and AIG. Banks receiving $188 billion paid their executives $1.6 billion in bonuses simultaneously. AIG paid $165 million in retention bonuses to the Financial Products division — the unit that caused its collapse — after receiving $67.8 billion in TARP funds.',
    who_did_it: 'Treasury Secretary Henry Paulson, Federal Reserve Chair Ben Bernanke, and Congress (Emergency Economic Stabilization Act of 2008, signed by President George W. Bush). The Obama administration continued the program.',
    consequences_for_responsible: 'No senior executive at any major bank was criminally prosecuted. One executive at a small bank was convicted. Banks repaid TARP funds with interest, which Treasury has cited as evidence of success.',
    consequences_for_harmed: '10 million Americans lost their homes to foreclosure between 2006-2014. Median household wealth dropped 39% from 2007 to 2010. Unemployment reached 10% in October 2009.',
    harmed_parties: 'American homeowners, workers, and taxpayers',
    current_status: 'TARP is closed. Treasury reports a net positive return. The Dodd-Frank Act created new regulatory framework. No structural changes to executive compensation at bailed-out firms were made permanent.',
    start_date: '2008-10-03',
    end_date: '2014-12-19',
    sources: [
      { source_label: 'GAO TARP Report', source_url: 'https://www.gao.gov/products/gao-16-18', source_type: 'government_report' },
      { source_label: 'Treasury TARP Tracker', source_url: 'https://home.treasury.gov/data/troubled-assets-relief-program', source_type: 'government_report' },
      { source_label: 'AP Investigation: Banks Paid Bonuses', source_url: null, source_type: 'news' }
    ]
  },

  // 5. Fannie Mae & Freddie Mac
  {
    slug: 'fannie-freddie-conservatorship',
    category: 'corporate_bailout',
    title: 'Fannie Mae & Freddie Mac — $191 Billion Invested, Zero Principal Repaid',
    amount_dollars: 191000000000,
    amount_display: '$191 Billion',
    what_was_taken: 'The federal government invested $191.5 billion in Fannie Mae and Freddie Mac via senior preferred stock. Under the 2012 Third Amendment to the stock purchase agreements, Treasury swept all profits as dividends rather than applying them toward repaying the principal investment. Fannie and Freddie have paid over $300 billion in dividends to Treasury, but the $191.5 billion senior preferred balance remains unchanged.',
    who_did_it: 'Treasury Secretary Henry Paulson placed Fannie and Freddie into conservatorship in September 2008. The Third Amendment (2012) was implemented by the Obama Treasury Department under Timothy Geithner/Jack Lew.',
    consequences_for_responsible: 'No individual accountability. The net worth sweep was challenged in court (Collins v. Yellen) and the Supreme Court declined to unwind it.',
    consequences_for_harmed: 'Private shareholders were effectively wiped out. Taxpayers remain on the hook as backstop. The housing finance system remains dependent on government-backed entities with no resolution in sight.',
    harmed_parties: 'Taxpayers, private shareholders, housing market participants',
    current_status: 'Still in conservatorship since 2008. No concrete plan for exit. The senior preferred stock balance remains $191.5 billion despite $300B+ in dividend payments.',
    start_date: '2008-09-07',
    end_date: null,
    sources: [
      { source_label: 'FHFA Conservatorship page', source_url: 'https://www.fhfa.gov/conservatorship', source_type: 'government_report' },
      { source_label: 'Treasury Senior Preferred Stock Purchase Agreements', source_url: 'https://home.treasury.gov/policy-issues/financial-markets-financial-institutions-and-fiscal-service/gse-702', source_type: 'government_report' }
    ]
  },

  // 6. GM & Chrysler Auto Bailout
  {
    slug: 'auto-bailout-gm-chrysler',
    category: 'corporate_bailout',
    title: 'GM & Chrysler — $80 Billion Committed, Delphi Pensions Slashed',
    amount_dollars: 80000000000,
    amount_display: '$80 Billion',
    what_was_taken: 'The federal government committed approximately $80 billion to General Motors, Chrysler, GMAC/Ally Financial, and Chrysler Financial. When Delphi Corporation (a former GM subsidiary) went through bankruptcy, 20,000+ non-union salaried workers had their pensions cut 30-70%, while union workers\' pensions were made whole using approximately $1 billion in federal TARP money channeled through GM. The Treasury ultimately lost $11.2 billion on its GM investment.',
    who_did_it: 'The Bush administration initiated the auto bailout; the Obama Auto Task Force (led by Steven Rattner) managed the restructuring. The Pension Benefit Guaranty Corporation (PBGC) took over Delphi salaried pensions at reduced rates. GM, with federal backing, topped up union pensions but not salaried ones.',
    consequences_for_responsible: 'Steven Rattner settled SEC fraud charges (unrelated) in 2010. No accountability for the two-tier pension treatment.',
    consequences_for_harmed: '20,000+ Delphi salaried retirees lost 30-70% of their pensions. Some lost healthcare benefits entirely. Congress passed the Susan Muffley Act in 2022 providing partial restoration — 14 years after the cuts.',
    harmed_parties: 'Delphi salaried retirees, taxpayers ($11.2B loss on GM shares)',
    current_status: 'GM is profitable and publicly traded. The $11.2 billion taxpayer loss is final. Delphi salaried workers received partial pension restoration through the Susan Muffley Act (2022).',
    start_date: '2008-12-19',
    end_date: '2013-12-09',
    sources: [
      { source_label: 'Treasury Auto Industry Report', source_url: 'https://home.treasury.gov/data/troubled-assets-relief-program/automotive-programs', source_type: 'government_report' },
      { source_label: 'GAO Auto Bailout Report', source_url: 'https://www.gao.gov/products/gao-14-12', source_type: 'government_report' },
      { source_label: 'PBGC Delphi Records', source_url: null, source_type: 'government_report' }
    ]
  },

  // 7. Savings & Loan Crisis
  {
    slug: 'savings-and-loan-crisis',
    category: 'corporate_bailout',
    title: 'Savings & Loan Crisis — $132 Billion Taxpayer Cost',
    amount_dollars: 132000000000,
    amount_display: '$132 Billion',
    what_was_taken: 'Deregulation of savings and loan institutions in the early 1980s led to reckless lending, fraud, and speculation. When over 1,000 S&Ls failed, taxpayers bore $132 billion of the cleanup costs through the Resolution Trust Corporation and FSLIC.',
    who_did_it: 'Congress (Garn-St Germain Act 1982 deregulation), S&L executives who engaged in fraud and speculation, regulators who failed to act. The Keating Five senators (Alan Cranston, Dennis DeConcini, John Glenn, John McCain, Donald Riegle) intervened with regulators on behalf of Charles Keating.',
    consequences_for_responsible: 'Over 1,000 individuals were prosecuted. Charles Keating was convicted (later overturned). This was the last time the US government held financial executives broadly criminally accountable for a systemic crisis.',
    consequences_for_harmed: 'Taxpayers paid $132 billion. Depositors at failed institutions experienced disruption. The RTC took years to liquidate assets at steep losses.',
    harmed_parties: 'American taxpayers, depositors at failed S&Ls',
    current_status: 'Resolved. The S&L cleanup is complete. It remains the last major financial crisis where widespread criminal prosecution of executives occurred.',
    start_date: '1986-01-01',
    end_date: '1995-12-31',
    sources: [
      { source_label: 'FDIC S&L Crisis History', source_url: 'https://www.fdic.gov/bank/historical/s&l/', source_type: 'government_report' },
      { source_label: 'GAO Financial Audit RTC', source_url: 'https://www.gao.gov/products/t-ggd-96-79', source_type: 'government_report' }
    ]
  },

  // 8. Illinois Public Pension Crisis
  {
    slug: 'illinois-pension-crisis',
    category: 'pension_failure',
    title: 'Illinois Public Pension — $200+ Billion Unfunded Liability',
    amount_dollars: 200000000000,
    amount_display: '$200+ Billion',
    what_was_taken: 'For decades, Illinois politicians skipped or reduced required pension contributions, using the money for other budget priorities. The state\'s five pension systems accumulated over $200 billion in unfunded liabilities — the worst funded state pension system in the nation.',
    who_did_it: 'Successive Illinois governors and legislatures of both parties who underfunded pensions for decades. The 1994 pension ramp (Edgar Ramp) pushed costs to future years. Governors Blagojevich and Quinn continued the pattern.',
    consequences_for_responsible: 'Governor Rod Blagojevich was convicted on corruption charges (unrelated). No official was held accountable for pension underfunding specifically.',
    consequences_for_harmed: 'Illinois has the highest property taxes in the nation, driven partly by pension obligations. State services have been cut. The state\'s credit rating has been the lowest of all 50 states. Current retirees are protected by the Illinois Constitution, but active workers face uncertainty.',
    harmed_parties: 'Illinois taxpayers, state employees facing benefit uncertainty, residents experiencing reduced services',
    current_status: 'The unfunded liability exceeds $200 billion. The Illinois Constitution prohibits pension benefit reductions for current members. Annual required contributions consume over 25% of the state\'s general fund budget.',
    start_date: '1994-01-01',
    end_date: null,
    sources: [
      { source_label: 'Illinois Commission on Government Forecasting and Accountability', source_url: 'https://cgfa.ilga.gov/', source_type: 'government_report' },
      { source_label: 'Illinois Pension Overview', source_url: 'https://www.illinois.gov/government/budget/pension', source_type: 'government_report' }
    ]
  },

  // 9. Detroit Municipal Bankruptcy
  {
    slug: 'detroit-municipal-bankruptcy',
    category: 'pension_failure',
    title: 'Detroit — Largest Municipal Bankruptcy in US History',
    amount_dollars: 18000000000,
    amount_display: '$18 Billion (total debt at filing)',
    what_was_taken: 'Detroit filed for Chapter 9 bankruptcy with $18 billion in debt. For decades, city officials issued pension obligation bonds, borrowed against future revenues, and failed to make required pension contributions while the tax base eroded. Police, fire, and city workers had their earned pensions cut by a bankruptcy judge.',
    who_did_it: 'Successive Detroit mayors and city councils (including Kwame Kilpatrick, convicted of corruption), state-appointed emergency managers, and decades of economic decline compounded by mismanagement.',
    consequences_for_responsible: 'Mayor Kwame Kilpatrick was sentenced to 28 years in federal prison for corruption (sentence later commuted). Emergency Manager Kevyn Orr oversaw the bankruptcy.',
    consequences_for_harmed: 'General city retirees had pensions cut 4.5% with elimination of annual cost-of-living increases. Police and fire retirees lost COLA adjustments. Retiree healthcare was eliminated. The city\'s art collection at the DIA was nearly liquidated.',
    harmed_parties: '32,000 city retirees and current employees, Detroit residents who experienced severe service cuts',
    current_status: 'Detroit exited bankruptcy in December 2014. Pension cuts are permanent. The city is financially stable but services remain below pre-bankruptcy levels.',
    start_date: '2013-07-18',
    end_date: '2014-12-10',
    sources: [
      { source_label: 'US Bankruptcy Court Eastern District of Michigan records', source_url: null, source_type: 'court_record' },
      { source_label: 'Detroit Free Press bankruptcy archives', source_url: null, source_type: 'news' },
      { source_label: 'Municipal Finance Research', source_url: 'https://www.brookings.edu/articles/detroits-bankruptcy/', source_type: 'academic' }
    ]
  }
];

// ─── Seed logic ──────────────────────────────────────────────────────────────

async function seedViolation(client, v) {
  // Upsert the violation
  const upsertSQL = `
    INSERT INTO revenue_violations (
      slug, title, category, description,
      what_was_taken, amount_dollars, amount_display,
      who_did_it, consequences_for_responsible, consequences_for_harmed,
      harmed_parties, current_status, start_date, end_date
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      what_was_taken = EXCLUDED.what_was_taken,
      amount_dollars = EXCLUDED.amount_dollars,
      amount_display = EXCLUDED.amount_display,
      who_did_it = EXCLUDED.who_did_it,
      consequences_for_responsible = EXCLUDED.consequences_for_responsible,
      consequences_for_harmed = EXCLUDED.consequences_for_harmed,
      harmed_parties = EXCLUDED.harmed_parties,
      current_status = EXCLUDED.current_status,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      updated_at = NOW()
    RETURNING id
  `;

  // "description" column gets the title (the table requires it; what_was_taken holds the detail)
  const params = [
    v.slug, v.title, v.category, v.title,
    v.what_was_taken, v.amount_dollars, v.amount_display,
    v.who_did_it, v.consequences_for_responsible, v.consequences_for_harmed,
    v.harmed_parties, v.current_status, v.start_date, v.end_date
  ];

  if (DRY_RUN) {
    console.log(`[DRY RUN] UPSERT violation: ${v.slug}`);
    return;
  }

  const { rows } = await client.query(upsertSQL, params);
  const violationId = rows[0].id;

  // Clear old sources & actors for this violation, then re-insert
  await client.query('DELETE FROM revenue_violation_sources WHERE violation_id = $1', [violationId]);
  await client.query('DELETE FROM revenue_violation_actors WHERE violation_id = $1', [violationId]);

  // Insert sources
  for (const s of v.sources) {
    if (!s.source_url) continue; // skip sources with no URL
    await client.query(
      `INSERT INTO revenue_violation_sources (violation_id, source_label, source_url, source_type)
       VALUES ($1, $2, $3, $4)`,
      [violationId, s.source_label, s.source_url, s.source_type]
    );
  }

  // Actors array is empty for now — will be populated when linked to candidate profiles
}

async function main() {
  console.log(`Seeding ${violations.length} revenue violations${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  const client = await pool.connect();
  try {
    for (const v of violations) {
      await client.query('BEGIN');
      try {
        await seedViolation(client, v);
        await client.query('COMMIT');
        console.log(`  ✓ ${v.slug}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${v.slug}: ${err.message}`);
      }
    }
  } finally {
    client.release();
  }

  console.log('\nDone.');
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
