/* Phillips Policy Hub — SPA Router & All Pages */
const BASE = '/blueprint';

// ─── Router ────────────────────────────────────────────────
function route() {
  const rawPath = window.location.pathname;
  const path = rawPath === BASE ? '/' : rawPath.replace(BASE, '');
  const main = document.getElementById('app-main');
  renderNav();
  renderFooter();
  window.scrollTo(0, 0);

  const routes = {
    '/': pageLanding,
    '/tax': pageTax,
    '/property': pageProperty,
    '/debt': pageDebt,
    '/veterans': pageVeterans,
    '/seniors': pageSeniors,
    '/healthcare': pageHealthcare,
    '/loans': pageLoans,
    '/housing': pageHousing,
    '/military': pageMilitary,
    '/drugs': pageDrugs,
    '/education': pageEducation,
    '/criminal-justice': pageCriminalJustice,
    '/immigration': pageImmigration,
    '/government': pageGovernment,
    '/infrastructure': pageInfrastructure,
    '/business': pageBusiness,
    '/agriculture': pageAgriculture,
    '/children': pageChildren,
    '/technology': pageTechnology,
    '/foreign-policy': pageForeignPolicy,
    '/environment': pageEnvironment,
    '/community': pageCommunity,
    '/insurance': pageInsurance,
    '/guns': pageGuns,
    '/reproductive': pageReproductive,
    '/transparency': pageTransparency,
    '/corporate': pageCorporate,
    '/fed': pageFed,
    '/poverty': pagePoverty,
    '/democracy': pageDemocracy,
    '/consumer': pageConsumer,
    '/university': pageUniversity,
    '/certification': pageCertification,
    '/ask': pageAsk,
  };

  const renderer = routes[path] || page404;
  renderer(main);
}

window.addEventListener('popstate', route);
window.addEventListener('profile-updated', route);
document.addEventListener('DOMContentLoaded', route);

// Callback for profile modal save
function onProfileUpdated() { route(); }

// ─── Helpers ───────────────────────────────────────────────
function policyPage(main, { title, subtitle, icon, impactId, impactFn, content }) {
  main.innerHTML = `
    <div class="page-header"><div class="container">
      <h1>${icon ? icon + ' ' : ''}${title}</h1>
      ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ''}
    </div></div>
    <div class="section"><div class="container">
      <div id="${impactId || 'impact'}"></div>
      ${content}
    </div></div>`;
  if (impactFn) renderImpactCard(impactId || 'impact', impactFn);
}

function calcField(id, label, placeholder, type) {
  type = type || 'number';
  return `<div class="calc-field"><label for="${id}">${label}</label><input id="${id}" type="${type}" placeholder="${placeholder || ''}"></div>`;
}

function selectField(id, label, options) {
  const opts = options.map(o => `<option value="${o.v}">${o.l}</option>`).join('');
  return `<div class="calc-field"><label for="${id}">${label}</label><select id="${id}">${opts}</select></div>`;
}

// ─── LANDING PAGE ──────────────────────────────────────────
function pageLanding(main) {
  const sections = [
    { href:'/tax', icon:'💰', title:'Tax Reform', desc:'Zero income tax. Zero payroll tax. See your real take-home pay.' },
    { href:'/property', icon:'🏠', title:'Property Tax Abolition', desc:'Own your home — truly. No more annual rent to the government.' },
    { href:'/debt', icon:'📊', title:'National Debt', desc:'$39T debt. Live counters. The plan to eliminate it in 30 years.' },
    { href:'/veterans', icon:'🎖️', title:'Veterans', desc:'$400/month per year served. No forms. No case workers.' },
    { href:'/seniors', icon:'👴', title:'Seniors & Social Security', desc:'Senior UBI up to $5,000/mo. SS buyout option.' },
    { href:'/healthcare', icon:'🏥', title:'Healthcare', desc:'Universal coverage. No copays. Mental health parity.' },
    { href:'/loans', icon:'🏦', title:'Banking & Loans', desc:'15% rate cap. End payday lending. Break up too-big-to-fail.' },
    { href:'/housing', icon:'🔑', title:'Housing Reform', desc:'Ban corporate homeownership. End speculation.' },
    { href:'/military', icon:'🛡️', title:'Military Reform', desc:'Cut contractor corruption. $550B budget that buys more.' },
    { href:'/drugs', icon:'💊', title:'Drug Policy', desc:'Legalize natural substances. Treat addiction. Destroy cartels.' },
    { href:'/education', icon:'📚', title:'Education', desc:'Equal per-student funding. Universal pre-K. Vocational dignity.' },
    { href:'/criminal-justice', icon:'⚖️', title:'Criminal Justice', desc:'End private prisons. End qualified immunity. Real reform.' },
    { href:'/immigration', icon:'🗽', title:'Immigration', desc:'Welcome America system. Capacity-based. Humane.' },
    { href:'/government', icon:'🏛️', title:'Government Reform', desc:'Term limits. End corruption. Ban lobbying.' },
    { href:'/infrastructure', icon:'🌉', title:'Infrastructure', desc:'$1.5T rebuild. High-speed rail. Broadband everywhere.' },
    { href:'/business', icon:'🏪', title:'Small Business', desc:'Zero-interest microloans. Cut red tape. Break monopolies.' },
    { href:'/agriculture', icon:'🌾', title:'Agriculture & Food', desc:'End junk food subsidies. Ban EU-banned chemicals.' },
    { href:'/children', icon:'🧒', title:'Child Protection', desc:'Missing children command center. Keep siblings together.' },
    { href:'/technology', icon:'🤖', title:'Tech, AI & Space', desc:'$500B AI fund. Semiconductor sovereignty. Space leadership.' },
    { href:'/foreign-policy', icon:'🌍', title:'Foreign Policy', desc:'Lead differently. Allies pay their share. Diplomacy first.' },
    { href:'/environment', icon:'🌿', title:'Climate & Environment', desc:'Corporate accountability. Nuclear back on table. No mandates.' },
    { href:'/community', icon:'🏘️', title:'Community Investment', desc:'City blocks owned by the people who live there.' },
    { href:'/insurance', icon:'📋', title:'American Coverage System', desc:'Government-operated universal coverage. Health, auto, home, life, disability. FEMA eliminated.' },
    { href:'/consumer', icon:'🛒', title:'Consumer Protection', desc:'All-in pricing. No hidden fees. Truth in commerce.' },
    { href:'/guns', icon:'🎯', title:'Gun Policy', desc:'Universal background checks. Treat the wound, not just the weapon.' },
    { href:'/reproductive', icon:'🤰', title:'Reproductive Rights', desc:'Pro-life before and after birth. Extenuating circumstances respected.' },
    { href:'/transparency', icon:'🔍', title:'Transparency & AEGIS', desc:'AI-powered government oversight. Every dollar tracked.' },
    { href:'/corporate', icon:'🔨', title:'Corporate Accountability', desc:'Fines always exceed profits. Executives go to jail.' },
    { href:'/fed', icon:'🏛️', title:'Federal Reserve Reform', desc:'Replace the Fed. Full transparency. End the shadows.' },
    { href:'/poverty', icon:'📈', title:'Anti-Poverty', desc:'Living wage. Baby bonds. End the poverty penalty.' },
    { href:'/democracy', icon:'🗳️', title:'Democracy Reform', desc:'Term limits. Age limits. Ranked choice. Fair elections.' },
    { href:'/university', icon:'🎓', title:'Public University System', desc:'Federalize state universities. Free tuition. Consolidation pays for it.' },
    { href:'/certification', icon:'📜', title:'Skills Certification', desc:'National competency-based certification. The credential is what you can do, not where you went.' },
  ];

  main.innerHTML = `
    <div class="hero">
      <div class="container hero-content">
        <h1>A Blueprint for <span>American Renewal</span></h1>
        <p class="hero-tagline">"We're going to fix the world and it starts here."</p>
        <p>39 policy chapters. Personalized calculators. See exactly how each proposal affects <em>your</em> household.</p>
        <div class="hero-actions">
          <button class="btn btn-primary" onclick="renderProfileModal()">Build Your Profile</button>
          <a href="/tax" class="btn btn-secondary" data-nav>Start with Tax Reform</a>
        </div>
      </div>
    </div>
    <div class="section"><div class="container">
      <div style="text-align:center;margin-bottom:2rem;">
        <h2>All Policy Areas</h2>
        <p style="color:var(--slate-600);">Click any card to see the full policy with personalized impact calculations.</p>
      </div>
      <div class="policy-grid">
        ${sections.map(s => `<a href="${s.href}" class="policy-card" data-nav>
          <div class="policy-card-icon">${s.icon}</div>
          <h3>${s.title}</h3>
          <p>${s.desc}</p>
        </a>`).join('')}
      </div>
    </div></div>`;

  // Bind SPA nav
  main.querySelectorAll('[data-nav]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      let href = a.getAttribute('href');
      if (!href.startsWith(BASE)) href = BASE + href;
      history.pushState(null, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  });
}

// ─── TAX REFORM ────────────────────────────────────────────
function pageTax(main) {
  policyPage(main, {
    title: 'Tax Reform — The Andson Tax System',
    subtitle: '"We don\'t tax what you build. We tax what you hoard."',
    icon: '💰',
    impactId: 'tax-impact',
    impactFn: p => {
      if (!p.income) return { level: 'none', message: 'Enter your income in your profile to see your tax savings.' };
      const inc = Number(p.income);
      const std = 15000;
      const taxable = Math.max(0, inc - std);
      let fedTax = 0;
      const brackets = [[11600,0.10],[47150,0.12],[100525,0.22],[191950,0.24],[243725,0.32],[609350,0.35],[Infinity,0.37]];
      let prev = 0;
      for (const [cap, rate] of brackets) {
        if (taxable <= prev) break;
        fedTax += Math.min(taxable, cap) - prev > 0 ? (Math.min(taxable, cap) - prev) * rate : 0;
        prev = cap;
      }
      const payroll = Math.min(inc, 176100) * 0.0765;
      const totalEliminated = fedTax + payroll;
      const spending = Number(p.monthlySpending || inc * 0.35 / 12) * 12;
      const nst = spending * 0.27;
      const net = totalEliminated - nst;
      return {
        level: net > 0 ? 'affects' : 'partial',
        message: `You currently pay ~${fmtDollar(fedTax)} in federal income tax and ~${fmtDollar(payroll)} in payroll tax (${fmtDollar(totalEliminated)} total). Under the Andson Tax System, those are eliminated. Your estimated NST on non-essential spending: ${fmtDollar(nst)}/year. Net change: <strong>${net >= 0 ? '+' : '-'}${fmtDollar(net)}/year (${net >= 0 ? '+' : '-'}${fmtDollar(net/12)}/month)</strong>.`
      };
    },
    content: `
      <div class="calc-card">
        <h3>Real Wage Calculator</h3>
        <p style="color:var(--slate-600)">See what your paycheck actually becomes under the Andson Tax System.</p>
        <div class="calc-grid">
          ${calcField('tax-income', 'Annual Income ($)', '55000')}
          ${calcField('tax-spending', 'Monthly Non-Essential Spending ($)', '1500')}
        </div>
        <button class="btn btn-primary" onclick="calcTax()">Calculate</button>
        <div id="tax-result"></div>
      </div>

      <div class="calc-card">
        <h3>What Gets Eliminated</h3>
        <div class="stats-row">
          <div class="stat-card"><div class="stat-value">$0</div><div class="stat-label">Federal Income Tax</div></div>
          <div class="stat-card"><div class="stat-value">$0</div><div class="stat-label">Payroll Tax</div></div>
          <div class="stat-card"><div class="stat-value">Gone</div><div class="stat-label">IRS As You Know It</div></div>
          <div class="stat-card"><div class="stat-value">Gone</div><div class="stat-label">Petty Govt Fees</div></div>
        </div>
      </div>

      <div class="calc-card">
        <h3>What Replaces It</h3>
        <table class="data-table">
          <thead><tr><th>Revenue Source</th><th>Rate</th><th>Annual Revenue</th></tr></thead>
          <tbody>
            <tr><td>National Sales Tax (non-essentials)</td><td>27% (17% fed / 7% state / 3% local)</td><td>$2.0–2.4T</td></tr>
            <tr><td>Financial Transaction Tax</td><td>1% (50 free trades/yr)</td><td>$1.0–1.5T</td></tr>
            <tr><td>Wealth Tax (assets > $11M)</td><td>Tiered</td><td>$200–400B</td></tr>
            <tr><td>Collateralized Loan Rule (> $10M)</td><td>Loans as income</td><td>Hundreds of $B</td></tr>
            <tr><td>Stepped-up basis eliminated</td><td>Gains taxed at death</td><td>Included above</td></tr>
          </tbody>
        </table>
      </div>

      <div class="calc-card">
        <h3>NST Food Exemption Standard</h3>
        <p style="color:var(--slate-600)">Food earns exemption by meeting scientific criteria — not by lobbying. AI reads the ingredient list. Products with artificial colors, HFCS, BHA/BHT, partially hydrogenated oils, or NOVA Group 4 ultra-processing are taxed. Clean food is exempt. Manufacturers can reformulate at any time to earn the exemption.</p>
        <h4 style="margin-top:1rem;">Automatic Disqualifiers Include:</h4>
        <ul style="columns:2;padding-left:1.5rem;color:var(--slate-700);font-size:0.9375rem;margin-top:0.5rem;">
          <li>Artificial colors (Red 40, Yellow 5/6, Blue 1/2)</li>
          <li>High fructose corn syrup</li>
          <li>BHA, BHT, TBHQ</li>
          <li>Partially hydrogenated oils</li>
          <li>Added sugar > 10g/serving</li>
          <li>Sodium > 600mg/serving</li>
          <li>EU-banned ingredients (auto-updated)</li>
          <li>NOVA Group 4 ultra-processed</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>The Real Numbers — By Income Level</h3>
        <table class="data-table">
          <thead><tr><th>Income</th><th>Tax + Payroll Eliminated</th><th>Est. NST Paid</th><th>Net Annual Gain</th><th>Monthly Gain</th></tr></thead>
          <tbody>
            <tr><td>$30,000</td><td>$3,856</td><td>$1,620</td><td class="text-success"><strong>+$2,236</strong></td><td>+$186/mo</td></tr>
            <tr><td>$55,000</td><td>$8,769</td><td>$5,198</td><td class="text-success"><strong>+$3,571</strong></td><td>+$297/mo</td></tr>
            <tr><td>$100,000</td><td>$21,264</td><td>$13,500</td><td class="text-success"><strong>+$7,764</strong></td><td>+$647/mo</td></tr>
            <tr><td>$300,000</td><td>$82,769</td><td>$56,700</td><td class="text-success"><strong>+$26,069</strong></td><td>+$2,172/mo</td></tr>
          </tbody>
        </table>
        <p style="font-size:0.8125rem;color:var(--slate-500);margin-top:0.75rem;">Every income level gains. Lowest incomes gain the most proportionally. High-net-worth individuals also pay wealth tax, FTT, and collateralized loan taxes not shown here.</p>
      </div>
    `
  });
  prefillCalc();
}

function calcTax() {
  const inc = Number(document.getElementById('tax-income')?.value) || 0;
  const monthlySpend = Number(document.getElementById('tax-spending')?.value) || 0;
  if (!inc) return;

  const std = 15000;
  const taxable = Math.max(0, inc - std);
  let fedTax = 0;
  const brackets = [[11600,.10],[47150,.12],[100525,.22],[191950,.24],[243725,.32],[609350,.35],[Infinity,.37]];
  let prev = 0;
  for (const [cap, rate] of brackets) {
    if (taxable <= prev) break;
    fedTax += (Math.min(taxable, cap) - prev) * rate;
    prev = cap;
  }
  const payroll = Math.min(inc, 176100) * 0.0765;
  const totalElim = fedTax + payroll;
  const annualSpend = (monthlySpend || inc * 0.35 / 12) * 12;
  const nst = annualSpend * 0.27;
  const net = totalElim - nst;

  document.getElementById('tax-result').innerHTML = `
    <div class="result-box">
      <h4>Your Tax Comparison</h4>
      <div class="result-row"><span class="result-row-label">Federal Income Tax Eliminated</span><span class="result-row-value result-positive">+${fmtDollar(fedTax)}</span></div>
      <div class="result-row"><span class="result-row-label">Payroll Tax Eliminated</span><span class="result-row-value result-positive">+${fmtDollar(payroll)}</span></div>
      <div class="result-row"><span class="result-row-label">Estimated NST on Non-Essentials</span><span class="result-row-value result-negative">-${fmtDollar(nst)}</span></div>
      <div class="result-row" style="border-top:2px solid rgba(255,255,255,0.3);padding-top:1rem;">
        <span class="result-row-label" style="font-weight:700;">Net Annual Change</span>
        <span class="result-row-value ${net >= 0 ? 'result-positive' : 'result-negative'}" style="font-size:1.5rem;">${net >= 0 ? '+' : '-'}${fmtDollar(net)}</span>
      </div>
      <div class="result-label" style="margin-top:0.75rem;">${net >= 0 ? '+' : '-'}${fmtDollar(net/12)} per month</div>
    </div>`;
}

// ─── PROPERTY TAX ──────────────────────────────────────────
function pageProperty(main) {
  policyPage(main, {
    title: 'Property Tax Abolition',
    subtitle: '"If you own it, you own it. Full stop."',
    icon: '🏠',
    impactId: 'prop-impact',
    impactFn: p => {
      if (!p.housingSituation) return { level: 'none', message: 'Add your housing situation to your profile.' };
      if (p.housingSituation === 'Renter' || p.housingSituation === 'Living with family') {
        return { level: 'partial', message: 'You don\'t pay property tax directly, but this policy funds schools equally, eliminates fishing/hunting licenses, vehicle registration fees, and petty permits that affect everyone.' };
      }
      const pt = Number(p.propertyTax) || 4200;
      return { level: 'affects', message: `You currently pay ~${fmtDollar(pt)}/year in property tax. Under this plan, that goes to <strong>$0</strong> over 5 years — saving you ${fmtDollar(pt/12)}/month. Plus: no vehicle registration fees, no fishing/hunting licenses, no residential permit fees.` };
    },
    content: `
      <div class="calc-card">
        <h3>Property Tax Savings Calculator</h3>
        <div class="calc-grid">
          ${calcField('prop-tax', 'Current Annual Property Tax ($)', '4200')}
        </div>
        <button class="btn btn-primary" onclick="calcProperty()">Calculate Savings</button>
        <div id="prop-result"></div>
      </div>

      <div class="calc-card">
        <h3>The 5-Year Transition Plan</h3>
        <table class="data-table">
          <thead><tr><th>Year</th><th>Action</th><th>Property Tax Rate</th></tr></thead>
          <tbody>
            <tr><td>Year 1</td><td>NST goes live. Property taxes frozen. Petty fees suspended.</td><td>100% (frozen)</td></tr>
            <tr><td>Year 2</td><td>Property tax reduced 20%. Fishing/hunting/vehicle reg fees eliminated.</td><td>80%</td></tr>
            <tr><td>Year 3</td><td>Reduced another 30%. Investment properties still taxed.</td><td>50%</td></tr>
            <tr><td>Year 4</td><td>Reduced to 10%. Remaining permit fees eliminated.</td><td>10%</td></tr>
            <tr><td>Year 5</td><td>Abolished completely. Permanently.</td><td><strong>0%</strong></td></tr>
          </tbody>
        </table>
      </div>

      <div class="calc-card">
        <h3>What Else Gets Eliminated</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Fishing & hunting licenses (public lands)</li>
          <li>Vehicle registration fees (personal non-commercial)</li>
          <li>Residential building & improvement permits (non-safety)</li>
          <li>Residential permit fees for primary residence transactions</li>
          <li>Occupational licenses with no genuine public safety purpose</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>How Local Government Gets Funded Instead</h3>
        <p style="color:var(--slate-700)">NST revenue is collected nationally and distributed by formula — population, poverty rate, and geographic service cost. A rural county with 8,000 people covering a vast area gets <em>more</em> per resident than a dense wealthy suburb. The exact opposite of the property tax system.</p>
        <p style="color:var(--slate-700)">Schools receive equal per-student federal funding regardless of zip code. A child in rural Mississippi and a child in suburban Connecticut get identical resources.</p>
      </div>

      <div class="calc-card">
        <h3>Mineral Rights Reform</h3>
        <p style="color:var(--slate-700)">New severances of mineral rights from surface rights prohibited immediately. Existing severances enter a 10-year resolution period. Surface owners can purchase mineral rights beneath their land at fair market value. You own your land — all of it.</p>
      </div>
    `
  });
  prefillCalc();
}

function calcProperty() {
  const pt = Number(document.getElementById('prop-tax')?.value) || 0;
  if (!pt) return;
  const years = [1, 0.8, 0.5, 0.1, 0];
  let totalSaved = 0;
  const rows = years.map((rate, i) => {
    const paid = pt * rate;
    const saved = pt - paid;
    totalSaved += saved;
    return `<div class="result-row"><span class="result-row-label">Year ${i+1}</span><span class="result-row-value">${rate === 0 ? '<span class="result-positive">$0 — FREE</span>' : fmtDollar(paid)}</span></div>`;
  }).join('');

  document.getElementById('prop-result').innerHTML = `
    <div class="result-box">
      <h4>Your 5-Year Property Tax Phase-Out</h4>
      ${rows}
      <div class="result-row" style="border-top:2px solid rgba(255,255,255,0.3);padding-top:1rem;">
        <span class="result-row-label" style="font-weight:700;">Total Saved Over 5 Years</span>
        <span class="result-row-value result-positive" style="font-size:1.5rem;">+${fmtDollar(totalSaved)}</span>
      </div>
      <div class="result-label" style="margin-top:0.5rem;">Then ${fmtDollar(pt)} saved every year — forever.</div>
    </div>`;
}

// ─── NATIONAL DEBT ─────────────────────────────────────────
function pageDebt(main) {
  const debtTotal = 39_000_000_000_000;
  const perSecond = 83000;
  const interestAnnual = 1_000_000_000_000;
  const perHousehold = 7300;
  const pop = 334_000_000;

  policyPage(main, {
    title: 'National Debt & Fiscal Strategy',
    subtitle: '$39 trillion in debt. Growing at $83,000 per second. The plan to eliminate it.',
    icon: '📊',
    impactId: 'debt-impact',
    impactFn: p => {
      return { level: 'affects', message: `Every American household pays ~$${fmt(perHousehold)}/year just in interest on the national debt. That's ${fmtDollar(perHousehold/12)}/month of your taxes going to service a credit card bill you didn't run up.` };
    },
    content: `
      <div class="counter-grid">
        <div class="counter-card"><div class="counter-value" id="debt-counter">$${(debtTotal/1e12).toFixed(1)}T</div><div class="counter-label">National Debt</div></div>
        <div class="counter-card"><div class="counter-value">$${fmt(perSecond)}</div><div class="counter-label">Growing Per Second</div></div>
        <div class="counter-card"><div class="counter-value">$1T</div><div class="counter-label">Annual Interest Payments</div></div>
        <div class="counter-card"><div class="counter-value">$${fmt(perHousehold)}</div><div class="counter-label">Interest Per Household/Year</div></div>
      </div>

      <div class="calc-card">
        <h3>Revenue vs. Spending After Reforms</h3>
        <table class="data-table">
          <thead><tr><th>Source</th><th>Annual Amount</th></tr></thead>
          <tbody>
            <tr><td><strong>New Revenue</strong></td><td></td></tr>
            <tr><td>&nbsp;&nbsp;27% NST on non-essentials</td><td>$2.0–2.4T</td></tr>
            <tr><td>&nbsp;&nbsp;1% Financial Transaction Tax</td><td>$1.0–1.5T</td></tr>
            <tr><td>&nbsp;&nbsp;Wealth tax (> $11M)</td><td>$200–400B</td></tr>
            <tr><td>&nbsp;&nbsp;Collateralized loan rule + stepped-up basis</td><td>Hundreds of $B</td></tr>
            <tr style="background:var(--success-bg)"><td><strong>Total Revenue</strong></td><td><strong>$3.8–4.5T</strong></td></tr>
            <tr><td><strong>Spending Savings</strong></td><td></td></tr>
            <tr><td>&nbsp;&nbsp;Military contractor reform</td><td>$220–330B</td></tr>
            <tr><td>&nbsp;&nbsp;Agency consolidation</td><td>$100–150B</td></tr>
            <tr><td>&nbsp;&nbsp;AI procurement reform</td><td>$50–100B</td></tr>
            <tr><td>&nbsp;&nbsp;Fraud detection</td><td>$50–80B</td></tr>
            <tr><td>&nbsp;&nbsp;FEMA eliminated (absorbed into ACS)</td><td>$20–30B</td></tr>
            <tr><td>&nbsp;&nbsp;Student loan program eliminated</td><td>$85–100B disbursements stopped</td></tr>
            <tr><td>&nbsp;&nbsp;SSA restructuring (60K → 15K)</td><td>Additional $B</td></tr>
            <tr style="background:var(--success-bg)"><td><strong>Total Savings</strong></td><td><strong>$525–790B+</strong></td></tr>
          </tbody>
        </table>
      </div>

      <div class="calc-card">
        <h3>The Timeline</h3>
        <table class="data-table">
          <thead><tr><th>Period</th><th>Goal</th></tr></thead>
          <tbody>
            <tr><td>Years 1–5</td><td>Deficit narrows dramatically</td></tr>
            <tr><td>Years 5–10</td><td>Balanced budget achieved, debt begins declining</td></tr>
            <tr><td>Years 10–15</td><td>Surplus grows, interest shrinks, foreign debt renegotiated</td></tr>
            <tr><td>Years 15–30</td><td>Sustained surplus eliminates the national debt</td></tr>
          </tbody>
        </table>
      </div>

      <div class="calc-card">
        <h3>The Fiscal Accountability Office</h3>
        <p style="color:var(--slate-700)">One Senate-confirmed director. One AI system. One public dashboard. One mandate: eliminate the deficit in 10 years, the debt in 30. If revenue misses targets by >15% for two consecutive years after all spending cuts are exhausted, the NST rate adjusts up by max 1%. If surplus exceeds targets, it adjusts <em>down</em> automatically. The default direction is down.</p>
      </div>

      <div class="calc-card">
        <h3>Waste Itemizer — Verified Sources</h3>
        <p style="color:var(--slate-600);margin-bottom:1rem;font-size:0.875rem;">Every figure below is sourced from official government reports, academic research, or investigative journalism. Badges indicate data confidence level.</p>
        <div style="border:1px solid var(--slate-200);border-radius:8px;overflow:hidden;">

          <div class="waste-group-label">Fraud & Theft</div>

          <div class="waste-item">
            <div class="waste-item-top"><span class="waste-name">Federal fraud across government programs</span><span class="waste-amount">$233B–$521B/yr</span></div>
            <div class="waste-meta"><span class="waste-badge range">Range</span><span class="waste-source">GAO-24-105833, April 2024</span></div>
          </div>

          <div class="waste-item">
            <div class="waste-item-top"><span class="waste-name">Improper payments across federal agencies (FY2024)</span><span class="waste-amount">$162B/yr</span></div>
            <div class="waste-meta"><span class="waste-badge official">Official</span><span class="waste-source">GAO-25-107753</span></div>
          </div>

          <div class="waste-item">
            <div class="waste-item-top"><span class="waste-name">Tax gap — uncollected federal taxes (TY2022)</span><span class="waste-amount">$696B gross / $606B net</span></div>
            <div class="waste-meta"><span class="waste-badge official">Official</span><span class="waste-source">IRS Publication 5869, October 2024</span></div>
          </div>

          <div class="waste-group-label">Military</div>

          <div class="waste-item">
            <div class="waste-item-top"><span class="waste-name">Weapon program cost growth (32 programs, single year)</span><span class="waste-amount">$37B in one year</span></div>
            <div class="waste-meta"><span class="waste-badge official">Official</span><span class="waste-source">GAO-23-106059</span></div>
          </div>

          <div class="waste-item">
            <div class="waste-item-top"><span class="waste-name">Overseas military base costs (full-loaded estimate)</span><span class="waste-amount">$65B/yr</span></div>
            <div class="waste-meta"><span class="waste-badge derived">Derived</span><span class="waste-source">Quincy Institute / Pentagon Overseas Cost Summary — Pentagon's own $22B figure excludes personnel, healthcare, and dozens of line items</span></div>
          </div>

          <div class="waste-item">
            <div class="waste-item-top"><span class="waste-name">Contractor profit premium above competitive pricing</span><span class="waste-amount">~40% on fixed contracts</span></div>
            <div class="waste-meta"><span class="waste-badge derived">Derived</span><span class="waste-source">CBS/60 Minutes 2023; Sen. Grassley letter — documented as "nearly 40%"</span></div>
          </div>

          <div class="waste-group-label">Tax Avoidance (Legal Loopholes)</div>

          <div class="waste-item">
            <div class="waste-item-top"><span class="waste-name">Stepped-up basis loophole — forgone revenue (2024)</span><span class="waste-amount">$58B/yr</span></div>
            <div class="waste-meta"><span class="waste-badge official">Official</span><span class="waste-source">Joint Committee on Taxation, 2024</span></div>
          </div>

          <div class="waste-item">
            <div class="waste-item-top"><span class="waste-name">Buy-Borrow-Die loophole (closing revenue estimate)</span><span class="waste-amount">~$10–15B/yr</span></div>
            <div class="waste-meta"><span class="waste-badge range">Range</span><span class="waste-source">Yale Budget Lab 2024 — $102B–$147B over 10 years</span></div>
          </div>

          <div class="waste-item">
            <div class="waste-item-top"><span class="waste-name">Offshore corporate profit shifting</span><span class="waste-amount">$50–90B/yr</span></div>
            <div class="waste-meta"><span class="waste-badge range">Range</span><span class="waste-source">OECD estimates</span></div>
          </div>

          <div class="waste-group-label">Agency Overlap & Inefficiency</div>

          <div class="waste-item">
            <div class="waste-item-top"><span class="waste-name">Overlapping job training programs</span><span class="waste-amount">43 programs / 9 agencies</span></div>
            <div class="waste-meta"><span class="waste-badge official">Official</span><span class="waste-source">GAO-19-200 — updated from 47 in 2011</span></div>
          </div>

          <div class="waste-item">
            <div class="waste-item-top"><span class="waste-name">GAO open recommendations — potential savings</span><span class="waste-amount">$106–208B/yr</span></div>
            <div class="waste-meta"><span class="waste-badge range">Range</span><span class="waste-source">GAO-25-107743</span></div>
          </div>

          <div class="waste-group-label">IT & Technology</div>

          <div class="waste-item">
            <div class="waste-item-top"><span class="waste-name">Federal IT spent on legacy maintenance (of $105B total)</span><span class="waste-amount">$83B/yr (79%)</span></div>
            <div class="waste-meta"><span class="waste-badge official">Official</span><span class="waste-source">GAO-25-107795</span></div>
          </div>

          <div class="waste-group-label">Pharmaceutical</div>

          <div class="waste-item">
            <div class="waste-item-top"><span class="waste-name">US drug prices vs. OECD average</span><span class="waste-amount">2.78x overall / 4.22x brand</span></div>
            <div class="waste-meta"><span class="waste-badge official">Official</span><span class="waste-source">RAND Corporation, 2024 — multiplier shown; dollar savings depend on negotiation outcomes</span></div>
          </div>

        </div>
      </div>

      <div class="calc-card">
        <h3>One-Time Transition Costs — Acknowledged</h3>
        <table class="data-table">
          <thead><tr><th>Transition</th><th>One-Time Cost</th><th>Annual Savings</th></tr></thead>
          <tbody>
            <tr><td>Healthcare workforce (1.5M displaced from insurance admin)</td><td>$60–80B</td><td>$500B/yr overhead eliminated</td></tr>
            <tr><td>State/local tax department employees (NST replaces all)</td><td>$10–20B</td><td>$30–50B/yr from eliminating 50 tax bureaucracies</td></tr>
          </tbody>
        </table>
        <p style="font-size:0.875rem;color:var(--slate-600);margin-top:0.75rem;">These are real costs, acknowledged explicitly rather than hidden. They are one-time costs against permanent annual savings that dwarf them.</p>
      </div>

      <div class="calc-card">
        <h3>Major Program Costs — Verified</h3>
        <table class="data-table">
          <thead><tr><th>Program</th><th>Annual Cost</th><th>Funding</th></tr></thead>
          <tbody>
            <tr><td>Senior UBI (~8–11M qualifying seniors)</td><td>~$100B</td><td>NST + wealth tax revenue</td></tr>
            <tr><td>American Coverage System</td><td>$0 net (self-funding)</td><td>NST allocation; FEMA saves $20–30B/yr</td></tr>
            <tr><td>American Public University System</td><td>$0–30B net</td><td>Student loan elimination + admin consolidation</td></tr>
            <tr><td>National Skills Certification</td><td>~$1B</td><td>Offset by certification fees</td></tr>
          </tbody>
        </table>
      </div>

      <div class="calc-card">
        <h3>Foreign Debt Renegotiation</h3>
        <p style="color:var(--slate-700)">With a surplus, America can approach foreign debt holders from strength: Japan ($1.2T), UK ($895B), China ($700B). Convert to lower-rate long-term bonds. They get certainty. We get lower payments. For the first time, the conversation happens from strength — not desperation.</p>
      </div>

      <div class="calc-card">
        <h3>Debt Projection Chart</h3>
        <div class="chart-container"><canvas id="debt-chart"></canvas></div>
      </div>
    `
  });

  // Debt chart
  if (typeof Chart !== 'undefined') {
    const ctx = document.getElementById('debt-chart')?.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: Array.from({length:31}, (_,i) => `Year ${i}`),
          datasets: [{
            label: 'Debt (Current Path)',
            data: Array.from({length:31}, (_,i) => 39 + i * 1.8),
            borderColor: '#c53030', backgroundColor: 'rgba(197,48,48,0.1)', fill: true,
          },{
            label: 'Debt (Phillips Plan)',
            data: Array.from({length:31}, (_,i) => {
              if (i <= 5) return 39 - i * 0.5;
              if (i <= 10) return 36.5 - (i-5) * 2;
              if (i <= 15) return 26.5 - (i-10) * 3;
              return Math.max(0, 11.5 - (i-15) * 0.77);
            }),
            borderColor: '#2f855a', backgroundColor: 'rgba(47,133,90,0.1)', fill: true,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            y: { title: { display: true, text: 'Trillions ($)' }, beginAtZero: true }
          }
        }
      });
    }
  }
}

// ─── VETERANS ──────────────────────────────────────────────
function pageVeterans(main) {
  policyPage(main, {
    title: 'Veterans — Protecting Those Who Served',
    subtitle: '"You served, we calculated, we deposited."',
    icon: '🎖️',
    impactId: 'vet-impact',
    impactFn: p => {
      if (!p.veteranStatus || p.veteranStatus === 'Not a veteran') return { level: 'none', message: 'This policy applies to veterans and active duty service members.' };
      const yrs = Number(p.yearsServed) || 0;
      const stipend = yrs * 400;
      return { level: 'affects', message: `With ${yrs} years of service, you'd receive <strong>${fmtDollar(stipend)}/month</strong> (${fmtDollar(stipend * 12)}/year). Means-tested — reduces as other income rises. The floor is always there.` };
    },
    content: `
      <div class="calc-card">
        <h3>Veteran Stipend Calculator</h3>
        <div class="calc-grid">
          ${calcField('vet-years', 'Years of Military Service', '10')}
        </div>
        <button class="btn btn-primary" onclick="calcVeteran()">Calculate Stipend</button>
        <div id="vet-result"></div>
      </div>

      <div class="calc-card">
        <h3>Stipend Schedule</h3>
        <table class="data-table">
          <thead><tr><th>Years Served</th><th>Monthly Stipend</th><th>Annual Amount</th></tr></thead>
          <tbody>
            <tr><td>4 years</td><td>$1,600/mo</td><td>$19,200/yr</td></tr>
            <tr><td>10 years</td><td>$4,000/mo</td><td>$48,000/yr</td></tr>
            <tr><td>15 years</td><td>$6,000/mo</td><td>$72,000/yr</td></tr>
            <tr><td>20 years</td><td>$8,000/mo</td><td>$96,000/yr</td></tr>
          </tbody>
        </table>
        <p style="font-size:0.875rem;color:var(--slate-600);margin-top:1rem;">Medical discharge qualifies. Automatic calculation and deposit. No forms. No case workers.</p>
      </div>

      <div class="calc-card">
        <h3>Combat Veteran Age Rights</h3>
        <p style="color:var(--slate-700)">If you're old enough to be sent to war at 18, you're old enough to decide what you put in your body. All age restrictions at 21 for civilians apply at 18 for combat-deployed veterans. Permanent from deployment orders.</p>
      </div>

      <div class="calc-card">
        <h3>VA Reform</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Fully fund mental health care — no waitlists</li>
          <li>Streamline VA — cut bureaucracy between veteran and care</li>
          <li>End veteran homelessness — housing first</li>
          <li>Veteran Family Support Program</li>
          <li>Veteran-to-Civilian Career Bridge</li>
          <li>Veterans waiting on disability get the stipend while they wait</li>
        </ul>
      </div>
    `
  });
  prefillCalc();
}

function calcVeteran() {
  const yrs = Number(document.getElementById('vet-years')?.value) || 0;
  if (!yrs) return;
  const monthly = yrs * 400;
  document.getElementById('vet-result').innerHTML = `
    <div class="result-box">
      <div class="result-value">${fmtDollar(monthly)}/mo</div>
      <div class="result-label">${fmtDollar(monthly * 12)} per year • For life • Means-tested</div>
    </div>`;
}

// ─── SENIORS ───────────────────────────────────────────────
function pageSeniors(main) {
  policyPage(main, {
    title: 'Social Security Transition & Senior UBI',
    subtitle: 'Social Security is running out of money. We fix it — with honest math.',
    icon: '👴',
    impactId: 'senior-impact',
    impactFn: p => {
      const age = Number(p.age) || 0;
      if (age >= 65) return { level: 'affects', message: `At age ${age}, you may qualify for the Senior UBI — up to ~$2,450/month at full implementation. Strict means-testing: no retirement accounts, liquid assets below $10K, no significant home equity. ~8–11 million seniors qualify.` };
      if (age >= 50) return { level: 'partial', message: `At age ${age}, you'd have the choice: stay on the current SS track or take the inflation-adjusted buyout when you reach eligibility.` };
      if (age > 0) return { level: 'partial', message: `At age ${age}, you're under 50 — you'd get the automatic SS buyout (every dollar contributed, adjusted for inflation) and transition to the new system.` };
      return { level: 'none', message: 'Add your age to see how the SS transition affects you.' };
    },
    content: `
      <div class="calc-card">
        <h3>The Senior UBI — A Quality of Life Floor</h3>
        <p style="color:var(--slate-700)">This is not a check for everyone over 65. This is a guarantee that if you are old and you have nothing, you will not fall through the floor. <strong>Strict means-testing:</strong> no retirement account of any kind, liquid assets below $10,000, total monthly income below the floor, no significant home equity.</p>
        <p style="color:var(--slate-600);margin-top:0.75rem;font-size:0.9375rem;">~20–25% of Americans over 65 (11–14 million) have no retirement savings. Of those, ~8–11 million qualify under strict testing.</p>
      </div>

      <div class="calc-card">
        <h3>The Floor — Set by Real Data</h3>
        <p style="color:var(--slate-700)">Based on the <strong>MIT Living Wage Calculator</strong> national median for a single adult. Updated every February. Adjusted downward because healthcare is already covered through universal coverage.</p>
        <div class="result-box" style="margin-top:1rem;">
          <div class="result-value">~$2,450/mo</div>
          <div class="result-label">Current Adjusted Floor (at full implementation)</div>
        </div>
      </div>

      <div class="calc-card">
        <h3>Phase-In Schedule</h3>
        <table class="data-table">
          <thead><tr><th>Period</th><th>% of MIT Floor</th><th>Monthly Amount</th></tr></thead>
          <tbody>
            <tr><td>Years 1–5</td><td>60%</td><td>~$1,470/month</td></tr>
            <tr><td>Years 5–10</td><td>80%</td><td>~$1,960/month</td></tr>
            <tr><td>Years 10+</td><td>100%</td><td>~$2,450/month</td></tr>
          </tbody>
        </table>
        <p style="font-size:0.875rem;color:var(--slate-600);margin-top:1rem;">All figures adjust automatically with MIT data every February. No Congressional vote on the number.</p>
      </div>

      <div class="calc-card">
        <h3>The Cost — Honest and Verified</h3>
        <table class="data-table">
          <thead><tr><th>Metric</th><th>Figure</th></tr></thead>
          <tbody>
            <tr><td>Qualifying seniors</td><td>~8–11 million</td></tr>
            <tr><td>Average payment after SS offset</td><td>~$700/month</td></tr>
            <tr><td>Annual cost at full implementation</td><td>~$100 billion</td></tr>
            <tr><td>Funding source</td><td>NST + wealth tax revenue</td></tr>
          </tbody>
        </table>
      </div>

      <div class="calc-card">
        <h3>Social Security Buyout</h3>
        <p style="color:var(--slate-700)">Every dollar you and your employer contributed — adjusted for inflation using CPI. No interest.</p>
        <table class="data-table" style="margin-top:1rem;">
          <thead><tr><th>Age Group</th><th>Option</th></tr></thead>
          <tbody>
            <tr><td>Under 50</td><td>Automatic transition — full buyout adjusted for inflation</td></tr>
            <tr><td>50–61</td><td>Your choice — stay on current track or take the buyout</td></tr>
            <tr><td>62+</td><td>Converted to UBI — income floor guaranteed, no reduction</td></tr>
          </tbody>
        </table>
      </div>

      <div class="calc-card">
        <h3>SSA Restructuring</h3>
        <p style="color:var(--slate-700)">SSA restructures from ~60,000 to ~15,000 employees through buyouts and attrition. The people who remain ensure every eligible American receives their payment on time every month.</p>
      </div>
    `
  });
}

// ─── HEALTHCARE ────────────────────────────────────────────
function pageHealthcare(main) {
  policyPage(main, {
    title: 'Universal Healthcare & Pharmaceutical Reform',
    subtitle: 'Healthcare is not a privilege. Free at point of access — no premiums, no copays, no deductibles.',
    icon: '🏥',
    impactId: 'health-impact',
    impactFn: p => {
      const costs = Number(p.healthcareCosts) || 0;
      if (!costs) return { level: 'affects', message: 'Universal coverage — free at point of access. No premiums, no copays, no deductibles. Private insurance collapse is the intended outcome. Add your healthcare costs to see your savings.' };
      return { level: 'affects', message: `You currently spend ~${fmtDollar(costs)}/year on healthcare. Under universal coverage, primary care has no copays, no deductibles. Estimated savings: <strong>${fmtDollar(costs * 0.7)}/year</strong>.` };
    },
    content: `
      <div class="calc-card">
        <h3>Healthcare Savings Calculator</h3>
        <div class="calc-grid">
          ${calcField('hc-costs', 'Your Annual Healthcare Costs ($)', '6000')}
          ${calcField('hc-household', 'Household Size', '3')}
        </div>
        <button class="btn btn-primary" onclick="calcHealthcare()">Calculate</button>
        <div id="hc-result"></div>
      </div>

      <div class="calc-card">
        <h3>What's Covered — No Copays, No Deductibles</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Primary care</li>
          <li>Emergency care — fully covered</li>
          <li>Mental health — treated exactly like physical health, no session limits</li>
          <li>Prescription drugs — at negotiated prices</li>
          <li>Dental and vision — part of basic coverage</li>
          <li>Preventive care</li>
          <li>Addiction treatment — on demand, free, no waitlists</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Ending the Pharmaceutical Monopoly</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Medicare negotiates drug prices — immediately, no exceptions</li>
          <li>Reference pricing — if it costs $X in Canada, it costs $X here</li>
          <li>End evergreening patent abuse</li>
          <li>Fast-track generic approval</li>
          <li>Ban pharmaceutical lobbying</li>
          <li>Ban direct-to-consumer drug advertising</li>
          <li>Fine pharma companies 2x total sales for knowingly unsafe drugs</li>
          <li>Insulin at $35</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>The Backstop</h3>
        <p style="color:var(--slate-700)">If private health insurance collapses faster than anticipated — and it will collapse, the only question is how fast — the government fully operates universal coverage for all Americans automatically. There is no gap. No period where Americans are uncovered during the transition. The public system scales to cover everyone.</p>
      </div>

      <div class="calc-card">
        <h3>Healthcare Workforce Transition</h3>
        <p style="color:var(--slate-700)">~1.5 million Americans currently employed in claims denial and prior authorization. <strong>This is the intended outcome.</strong> That infrastructure exists to deny care. Its elimination is the point. Two years of wage replacement at 80% + free retraining. One-time cost: ~$60–80B. Annual savings from eliminating the overhead: <strong>$500B</strong>.</p>
      </div>

      <div class="calc-card">
        <h3>All-In Medical Pricing</h3>
        <p style="color:var(--slate-700)">Every hospital publishes actual prices for every procedure. No surprise billing. AEGIS cross-references all billing against published prices automatically. Criminal charges for knowing billing fraud.</p>
      </div>
    `
  });
  prefillCalc();
}

function calcHealthcare() {
  const costs = Number(document.getElementById('hc-costs')?.value) || 0;
  const hh = Number(document.getElementById('hc-household')?.value) || 1;
  if (!costs) return;
  const savings = costs * 0.7;
  document.getElementById('hc-result').innerHTML = `
    <div class="result-box">
      <h4>Estimated Annual Savings</h4>
      <div class="result-value result-positive">+${fmtDollar(savings)}</div>
      <div class="result-label">${fmtDollar(savings/12)} per month for a household of ${hh}</div>
    </div>`;
}

// ─── LOANS & BANKING ───────────────────────────────────────
function pageLoans(main) {
  policyPage(main, {
    title: 'Banking & Financial Industry Reform',
    subtitle: 'The top 5 banks control nearly 50% of U.S. banking assets. That ends.',
    icon: '🏦',
    impactId: 'loan-impact',
    impactFn: p => {
      const debt = Number(p.debtBalances) || 0;
      const rate = Number(p.debtRates) || 0;
      if (!debt || !rate) return { level: 'partial', message: 'Add your debt balances and interest rates to see how the 15% rate cap saves you money.' };
      if (rate <= 15) return { level: 'partial', message: `Your average rate of ${rate}% is already at or below the 15% cap. You'd still benefit from eliminated bank fees, Glass-Steagall reinstatement, and consumer protections.` };
      const currentInterest = debt * (rate / 100);
      const cappedInterest = debt * 0.15;
      const savings = currentInterest - cappedInterest;
      return { level: 'affects', message: `Your ${fmtDollar(debt)} in debt at ${rate}% costs you ${fmtDollar(currentInterest)}/yr in interest. Capped at 15%, that drops to ${fmtDollar(cappedInterest)}/yr — saving <strong>${fmtDollar(savings)}/yr (${fmtDollar(savings/12)}/mo)</strong>.` };
    },
    content: `
      <div class="calc-card">
        <h3>15% Rate Cap Calculator</h3>
        <div class="calc-grid">
          ${calcField('loan-bal', 'Total Debt Balance ($)', '35000')}
          ${calcField('loan-rate', 'Current Average Interest Rate (%)', '24')}
        </div>
        <button class="btn btn-primary" onclick="calcLoans()">Calculate Savings</button>
        <div id="loan-result"></div>
      </div>

      <div class="calc-card">
        <h3>What the 15% Cap Eliminates</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Entire payday loan industry (requires 300%+ to survive)</li>
          <li>29–34% APR predatory credit cards</li>
          <li>Car title loans</li>
          <li>Rent-to-own schemes with hidden rates above 15%</li>
          <li>Buy now pay later products with hidden rates</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Structural Banking Reform</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Reinstate Glass-Steagall — separate commercial and investment banking</li>
          <li>Break up institutions holding >10% of national assets</li>
          <li>Ban proprietary trading with depositor funds</li>
          <li>Failed banks fail (Iceland model) — depositors protected, bad banks unwound</li>
          <li>Corporations cannot own stock — only human beings</li>
          <li>Ban all corporate political donations (challenge to Citizens United)</li>
          <li>2-year revolving door ban for financial regulators, Treasury, Fed, SEC</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Student Loan Reform</h3>
        <p style="color:var(--slate-700)">Federal loan rates capped at 1%. Expanded income-based repayment. Structured relief for existing borrowers.</p>
      </div>
    `
  });
  prefillCalc();
}

function calcLoans() {
  const bal = Number(document.getElementById('loan-bal')?.value) || 0;
  const rate = Number(document.getElementById('loan-rate')?.value) || 0;
  if (!bal || !rate) return;
  const current = bal * (rate / 100);
  const capped = bal * 0.15;
  const savings = Math.max(0, current - capped);
  document.getElementById('loan-result').innerHTML = `
    <div class="result-box">
      <h4>Interest Rate Cap Savings</h4>
      <div class="result-row"><span class="result-row-label">Current Annual Interest (${rate}%)</span><span class="result-row-value result-negative">${fmtDollar(current)}</span></div>
      <div class="result-row"><span class="result-row-label">Capped Annual Interest (15%)</span><span class="result-row-value">${fmtDollar(capped)}</span></div>
      <div class="result-row" style="border-top:2px solid rgba(255,255,255,0.3);padding-top:1rem;">
        <span class="result-row-label" style="font-weight:700;">Annual Savings</span>
        <span class="result-row-value result-positive" style="font-size:1.5rem;">+${fmtDollar(savings)}</span>
      </div>
      <div class="result-label" style="margin-top:0.5rem;">${fmtDollar(savings/12)} per month back in your pocket</div>
    </div>`;
}

// ─── HOUSING ───────────────────────────────────────────────
function pageHousing(main) {
  policyPage(main, {
    title: 'Housing Reform',
    subtitle: '28 vacant homes for every homeless person. This is not a supply problem.',
    icon: '🔑',
    impactId: 'housing-impact',
    impactFn: p => {
      if (!p.housingSituation) return { level: 'none', message: 'Add your housing situation to see how this affects you.' };
      if (p.housingSituation === 'Renter') return { level: 'affects', message: 'Corporate homeownership ban will release millions of homes back to the market, reducing prices and rents. Rent stabilization and first-time buyer assistance directly benefit you.' };
      return { level: 'partial', message: 'As a homeowner, your neighborhood values stabilize as speculation ends. Property tax abolition (see Property Tax page) saves you thousands annually. Mineral rights reform protects your land.' };
    },
    content: `
      <div class="stats-row">
        <div class="stat-card"><div class="stat-value">16M</div><div class="stat-label">Empty Homes in America</div></div>
        <div class="stat-card"><div class="stat-value">770K</div><div class="stat-label">Homeless People</div></div>
        <div class="stat-card"><div class="stat-value">28:1</div><div class="stat-label">Vacant Homes Per Homeless Person</div></div>
      </div>

      <div class="calc-card">
        <h3>Corporate Ownership — Banned</h3>
        <p style="color:var(--slate-700)">No corporation, hedge fund, REIT, or investment firm may own single-family residential properties.</p>
        <table class="data-table" style="margin-top:1rem;">
          <thead><tr><th>Timeline</th><th>Action</th></tr></thead>
          <tbody>
            <tr><td>Day 1</td><td>No new corporate purchases of single-family homes</td></tr>
            <tr><td>Years 1–3</td><td>Existing holdings begin divestiture</td></tr>
            <tr><td>Years 3–5</td><td>Full divestiture complete</td></tr>
            <tr><td>After Year 5</td><td>Any remaining corporate-owned homes: forced sale at assessed value → first-time buyer fund</td></tr>
          </tbody>
        </table>
      </div>

      <div class="calc-card">
        <h3>Individual Ownership Limits</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Primary residence — own where you live</li>
          <li>Second personal home — one additional allowed</li>
          <li>Investment properties — maximum five total</li>
          <li>Everything above must be divested</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Used Homes — NST Exempt</h3>
        <p style="color:var(--slate-700)">Used homes are exempt from the National Sales Tax. No double taxation on secondhand property. The most common path to homeownership stays affordable.</p>
      </div>
    `
  });
}

// ─── MILITARY ──────────────────────────────────────────────
function pageMilitary(main) {
  policyPage(main, {
    title: 'Military Contract Reform',
    subtitle: 'Defending America, Not the Contractors. $960B → $550B with equal or better capability.',
    icon: '🛡️',
    impactId: 'mil-impact',
    impactFn: () => ({ level: 'affects', message: 'Military reform saves $310B+ annually that currently goes to contractor profits — redirected to debt reduction, veterans, and infrastructure. Every taxpayer benefits.' }),
    content: `
      <div class="stats-row">
        <div class="stat-card"><div class="stat-value">$960B</div><div class="stat-label">Current Budget</div></div>
        <div class="stat-card"><div class="stat-value">$550B</div><div class="stat-label">Reformed Budget</div></div>
        <div class="stat-card"><div class="stat-value">$310B+</div><div class="stat-label">Annual Savings</div></div>
        <div class="stat-card"><div class="stat-value">30-40%</div><div class="stat-label">Currently Lost to Contractor Profit</div></div>
      </div>

      <div class="calc-card">
        <h3>The $550B Reformed Budget</h3>
        <table class="data-table">
          <thead><tr><th>Category</th><th>Amount</th><th>Change</th></tr></thead>
          <tbody>
            <tr><td>Military personnel</td><td>$194.6B</td><td class="text-success">Zero cuts</td></tr>
            <tr><td>Operations & maintenance</td><td>$220B</td><td>Saved $80B (base consolidation)</td></tr>
            <tr><td>Procurement</td><td>$130B</td><td>Saved $75B (competitive bidding)</td></tr>
            <tr><td>Research & development</td><td>$130B</td><td>Redirected to cyber, AI, hypersonics</td></tr>
            <tr><td>Military construction</td><td>$5B</td><td>Reduced (overseas bases close)</td></tr>
            <tr><td>Defense-wide</td><td>$70B</td><td>Saved $30B (admin consolidation)</td></tr>
          </tbody>
        </table>
      </div>

      <div class="calc-card">
        <h3>The Manufacturing Cost Fraud</h3>
        <p style="color:var(--slate-700)">A Tomahawk missile costs $1.9M. Actual manufacturing cost: $100K–200K. Raytheon has been the sole manufacturer since 1997 — a 28-year monopoly. Houthis built equivalent missiles from hobby store components for $2,000 each.</p>
      </div>

      <div class="calc-card">
        <h3>Procurement Reform</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>End all cost-plus contracts — every contract is fixed-price, competitively bid</li>
          <li>Open book accounting mandatory</li>
          <li>Minimum two competing manufacturers for every major system</li>
          <li>Payment upon delivery — not upon billing</li>
          <li>AEGIS monitors every contract in real time</li>
          <li>Criminal liability for executives who knowingly overbill</li>
        </ul>
      </div>
    `
  });
}

// ─── DRUG POLICY ───────────────────────────────────────────
function pageDrugs(main) {
  policyPage(main, {
    title: 'Drug Policy & Addiction Recovery',
    subtitle: '"I don\'t care that people want to get high. I just want it to be safe."',
    icon: '💊',
    impactId: 'drug-impact',
    impactFn: () => ({ level: 'affects', message: 'Drug policy reform affects every American — 70,000 fentanyl deaths/year, $50B/year in drug prosecution costs redirected to treatment, criminal market destruction saves lives in every community.' }),
    content: `
      <div class="calc-card">
        <h3>Tier 1 — Natural Substances: Full Legalization & Regulation</h3>
        <p style="color:var(--slate-700)">Marijuana, psilocybin, peyote, ayahuasca, mescaline, coca leaf, naturally occurring psychedelics — legalized and regulated commercially.</p>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Licensed dispensaries — strict age verification (21+, 18 for combat vets)</li>
          <li>No advertising — ever, for any substance, to anyone</li>
          <li>Plain packaging — no branding designed for youth</li>
          <li>Non-profit or capped-profit production</li>
          <li>NST-taxed — revenue funds treatment</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Tier 2 — Synthetic Substances: Decriminalized, Not Legalized</h3>
        <p style="color:var(--slate-700)">Meth, fentanyl, synthetic opioids — personal possession decriminalized. No jail. Health assessment instead. Production and distribution remain serious crimes.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>Switzerland Clinical Model:</strong> Severe addicts access pharmaceutical-grade product in supervised clinical settings as a <em>transition mechanism</em>. Crime drops. HIV transmission drops to near zero. Employment increases.</p>
      </div>

      <div class="calc-card">
        <h3>How Legalization Eliminates Fentanyl Deaths</h3>
        <p style="color:var(--slate-700)">Fentanyl contaminates black market products — not legal ones. Legal regulated natural substances collapse the black market. No profit margin competing against legal, safer, cheaper products. The contamination deaths drop because the drugs stop containing fentanyl.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;">Alcohol prohibition created methanol poisoning deaths. Regulation eliminated them overnight. Same mechanism. Same solution.</p>
      </div>

      <div class="calc-card">
        <h3>Complete Addiction Recovery System</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Same-day treatment access — within 72 hours maximum, at no cost</li>
          <li>Any doctor can prescribe buprenorphine, any pharmacy can dispense</li>
          <li>Duration by medical need — not insurance limits</li>
          <li>Transitional housing connected to treatment</li>
          <li>Peer recovery support specialists</li>
          <li>Mental health, trauma, housing, employment treated simultaneously</li>
          <li>Funded by $50B annual drug prosecution savings</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Tobacco Manufacturing Restrictions</h3>
        <p style="color:var(--slate-700)">Tobacco stays legal. But: tobacco products must contain tobacco and nothing else. No chemical additives. No ammonia, menthol, sugars. Nicotine capped at natural leaf levels. Plain packaging. No advertising.</p>
      </div>

      <div class="calc-card">
        <h3>Criminal Market Destruction</h3>
        <div class="stats-row">
          <div class="stat-card"><div class="stat-value">$150B→$20B</div><div class="stat-label">Criminal Drug Market Revenue</div></div>
          <div class="stat-card"><div class="stat-value">80-85%</div><div class="stat-label">Revenue Destruction</div></div>
        </div>
      </div>
    `
  });
}

// ─── Content-only policy pages (no calculator) ─────────────

function pageEducation(main) {
  policyPage(main, {
    title: 'Education Reform', subtitle: 'The quality of a child\'s education depends on their zip code. That ends.', icon: '📚',
    impactId: 'edu-impact',
    impactFn: p => {
      const hh = Number(p.householdSize) || 0;
      if (hh > 1) return { level: 'affects', message: `With a household of ${hh}, education reform directly impacts your family: equal per-student funding regardless of zip code, universal pre-K, restored vocational education, student loan rates capped at 1%.` };
      return { level: 'partial', message: 'Education reform benefits every community: equal school funding, universal pre-K, vocational programs, and 1% student loan rates.' };
    },
    content: `
      <div class="calc-card"><h3>Equal Per-Student Federal Funding</h3><p style="color:var(--slate-700)">Every child receives identical per-student federal funding regardless of zip code. No local top-ups from property taxes. Tied to inflation and GDP growth. Automatically adjusts. Published and audited through OpenLedger.</p></div>
      <div class="calc-card"><h3>Key Reforms</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Montessori-informed public education — self-directed learning, mixed age groups</li><li>Vocational education restored to dignity — not a consolation prize</li><li>Universal pre-K for every child</li><li>Mandatory gun safety education</li><li>Student loan rates capped at 1%</li><li>Expanded income-based repayment</li><li>American Public University System replaces predatory private model (Ch 40)</li></ul></div>

      <div class="calc-card">
        <h3>Administrator Salary Reform</h3>
        <p style="color:var(--slate-600);margin-bottom:1rem;">In Eau Claire, WI — the 8th largest district — the highest-paid person made $218,089 in 2024. Average teacher: $67,679. That same year the district asked voters for an $18M property tax increase over a $13M shortfall.</p>
        <h4>The Locked Compensation Framework</h4>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>No administrator makes more than the <strong>lowest-paid teacher</strong> in their district</li>
          <li>Principals capped at the highest-paid teacher salary in their building</li>
          <li>Superintendent positions only required in districts above 10,000 students</li>
          <li>Above 10,000: superintendent capped at highest-paid teacher salary — their financial interest is tied to elevating teacher compensation</li>
        </ul>
        <p style="color:var(--slate-700);margin-top:1rem;">Every administrator's ceiling rises only when teacher pay rises. Districts that want good administrators have to pay teachers well first.</p>
      </div>

      <div class="calc-card">
        <h3>7% Administrative Overhead Ceiling</h3>
        <p style="color:var(--slate-700)">No school district may spend more than 7% of its total budget on administrative overhead — positions whose primary function is managing other staff rather than directly serving named students. You either have named students or you don't. Ungameable.</p>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Districts above 7% have two years to restructure or lose federal funding</li>
          <li>AEGIS monitors staffing classification annually</li>
          <li>Reclassifying positions without changing duties = flagged and published</li>
          <li>AI integration mandatory for scheduling, payroll, compliance, facilities</li>
          <li>Administrator salaries published by name through OpenLedger</li>
        </ul>
      </div>
    `
  });
}

function pageCriminalJustice(main) {
  policyPage(main, {
    title: 'Criminal Justice Reform', subtitle: '5% of the world\'s population. 25% of the world\'s prisoners.', icon: '⚖️',
    impactId: 'cj-impact', impactFn: () => ({ level: 'affects', message: 'Criminal justice reform affects every community: ending private prisons saves $80B/year, ending qualified immunity creates real police accountability, decriminalizing drug possession redirects $50B to treatment.' }),
    content: `
      <div class="stats-row"><div class="stat-card"><div class="stat-value">2M</div><div class="stat-label">People Behind Bars</div></div><div class="stat-card"><div class="stat-value">$80B</div><div class="stat-label">Annual Prison Spending</div></div><div class="stat-card"><div class="stat-value">60%</div><div class="stat-label">Non-Violent Offenders</div></div></div>
      <div class="calc-card"><h3>Core Reforms</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>End private prisons entirely — prison is not a profit center</li><li>End qualified immunity — officers sued personally for civil rights violations</li><li>Mandatory body cameras — always on, tampering is a crime</li><li>National misconduct registry — follows officers across states permanently</li><li>Department liability for patterns of misconduct</li><li>Personal liability insurance for officers</li><li>Drug possession decriminalized — users get help, not prison (Ch 27)</li><li>Prison labor: voluntary, community use only, real wages, vocational credentials</li></ul></div>
      <div class="calc-card"><h3>Statutes of Limitations — Eliminated</h3><p style="color:var(--slate-700)">Statutes of limitations are eliminated for <strong>all crimes</strong>. Every crime. No exceptions.</p><p style="color:var(--slate-700);margin-top:0.75rem;">Created in an era when evidence degraded — witnesses died, documents faded. That era is over. AEGIS monitors every transaction in real time. Digital records are permanent. Evidence doesn't degrade — it accumulates.</p><p style="color:var(--slate-700);margin-top:0.75rem;font-style:italic;">"The clock doesn't run out. Justice doesn't have an expiration date. If you did it and we can prove it — you answer for it. Period."</p></div>
    `
  });
}

function pageImmigration(main) {
  policyPage(main, {
    title: 'The Welcome America Immigration System', subtitle: '"Name one job an immigrant took that affected you personally."', icon: '🗽',
    impactId: 'imm-impact', impactFn: () => ({ level: 'affects', message: 'Immigration adds $8.9T to GDP over the next decade and $1.2T in federal tax revenue. Immigrants pay $383B in federal taxes and $196B in state/local taxes annually.' }),
    content: `
      <div class="calc-card"><h3>How It Works</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
        <li>Immediate moratorium on non-violent deportations for 2+ year residents</li>
        <li>10-year residents with no violent record → immediate citizenship path</li>
        <li>Annual Capacity Assessment — economic, housing, infrastructure, humanitarian, fiscal</li>
        <li>Fair lottery system — family size adds entries</li>
        <li>Immediate work authorization on Day 1</li>
        <li>60-day transitional support connected to job placement</li>
        <li>Regional distribution to where workers are needed</li>
        <li>AI-assisted asylum system — decisions within 30 days, max 120 days total</li>
        <li>Violent criminals: jail, serve time, then deportation</li>
        <li>Full benefits after 5 years of work and tax contribution</li>
      </ul></div>
    `
  });
}

function pageGovernment(main) {
  policyPage(main, {
    title: 'Government Reform & Anti-Corruption', subtitle: 'Corporations are not people. They do not need to own the government.', icon: '🏛️',
    impactId: 'gov-impact', impactFn: () => ({ level: 'affects', message: 'Government reform affects every voter: banning corporate donations, publicly funded elections, term limits, no-trading rules for officials, and real consequences for corruption.' }),
    content: `
      <div class="calc-card"><h3>Ending Corporate Influence</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Ban all corporate and PAC donations to political campaigns</li><li><strong>Lifetime ban</strong> on lobbying for all former federal government officials</li><li>Publicly funded elections with small-donor matching</li><li>Full real-time disclosure of all political spending</li></ul></div>
      <div class="calc-card"><h3>The Lobbying Location Requirement</h3><p style="color:var(--slate-700)">All official contact between lobbyists and federal elected officials must occur in the official's <strong>home state district office</strong>. Not in Washington. Not on K Street. Not over dinner at a Georgetown restaurant. Not on a golf course.</p><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;margin-top:0.75rem;"><li>Every visit logged, every visitor signs in</li><li>Meeting purpose documented and published through OpenLedger within 24 hours</li><li>Representatives spend more time where their constituents are</li><li>A union organizing members to contact their senator = democracy (protected)</li><li>A former senator paid $2M/yr by a defense contractor to call colleagues = corruption (lifetime ban)</li></ul></div>
      <div class="calc-card"><h3>Accountability</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>No trading individual financial instruments during service or 2 years after</li><li>Criminal liability for knowing violations</li><li>Strengthened independent ethics commission</li><li>Term limits: Senate 2 terms (12 yrs), House 4 terms (8 yrs)</li><li>Return to Civilian Life: former Congress members must move home within 90 days</li></ul></div>
      <div class="calc-card"><h3>Fair Elections</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Ranked-choice voting nationwide</li><li>Election Day as national holiday</li><li>Nonpartisan redistricting commissions</li><li>Enhanced cybersecurity for election infrastructure</li></ul></div>
    `
  });
}

function pageInfrastructure(main) {
  policyPage(main, {
    title: 'Infrastructure & Energy Independence', subtitle: 'America\'s infrastructure is graded D+. $1.5 trillion to fix it.', icon: '🌉',
    impactId: 'infra-impact', impactFn: () => ({ level: 'affects', message: 'Infrastructure investment creates millions of jobs, saves families $1,000+/yr in vehicle repairs from bad roads, and delivers broadband to every American home.' }),
    content: `
      <div class="stats-row"><div class="stat-card"><div class="stat-value">43,000+</div><div class="stat-label">Deficient Bridges</div></div><div class="stat-card"><div class="stat-value">$170B</div><div class="stat-label">Lost to Congestion/Year</div></div><div class="stat-card"><div class="stat-value">$1,000+</div><div class="stat-label">Per Family in Road Repairs</div></div></div>
      <div class="calc-card"><h3>The Investment</h3><table class="data-table"><thead><tr><th>Category</th><th>Investment</th></tr></thead><tbody>
        <tr><td>Roads, bridges, and transit</td><td>$600B</td></tr>
        <tr><td>Energy grids and utilities</td><td>$300B</td></tr>
        <tr><td>High-speed internet</td><td>$200B</td></tr>
        <tr><td>Smart cities and high-speed rail</td><td>$400B</td></tr>
        <tr><td>Power grid modernization</td><td>$500B</td></tr>
        <tr><td>Lead pipe replacement</td><td>$200B</td></tr>
        <tr><td>Fiber-optic broadband (100%)</td><td>$150B</td></tr>
      </tbody></table></div>
      <div class="calc-card"><h3>CivicSignal Connection</h3><p style="color:var(--slate-700)">Citizens report infrastructure problems directly through CivicSignal — GPS-tagged, publicly visible, mandatory response timelines. Small local contractors get first priority on jobs under $500,000.</p></div>
    `
  });
}

function pageBusiness(main) {
  policyPage(main, {
    title: 'Small Business & Entrepreneurship', subtitle: '99.9% of businesses are small businesses. Built one from nothing.', icon: '🏪',
    impactId: 'biz-impact', impactFn: () => ({ level: 'affects', message: 'Zero-interest microloans up to $50K, simplified regulations for businesses under 20 employees, first priority on government contracts under $500K.' }),
    content: `
      <div class="calc-card"><h3>Capital Access</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Zero-interest microloans up to $50,000</li><li>Low-interest loans up to $500,000</li><li>Public Business Development Banks</li><li>Federal matching for community-focused VC</li></ul></div>
      <div class="calc-card"><h3>Cut Red Tape</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>One-Stop National Business Startup Portal</li><li>Simplified reporting for businesses under 20 employees</li><li>Automatic 10-year sunset reviews of regulations</li></ul></div>
      <div class="calc-card"><h3>Break Monopolies</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Strengthen antitrust enforcement</li><li>Ban vertical integration across supply chains</li><li>Small contractors get first priority on government jobs under $500K</li></ul></div>
    `
  });
}

function pageAgriculture(main) {
  policyPage(main, {
    title: 'Agricultural Reform & Food System Overhaul', subtitle: 'The cheapest food in America is the worst food. We fix that.', icon: '🌾',
    impactId: 'ag-impact', impactFn: p => ({ level: 'affects', message: 'Agricultural reform saves every household $100–200/month on groceries by redirecting subsidies to fresh produce and breaking up the top 4 processors controlling 80%+ of beef.' }),
    content: `
      <div class="calc-card"><h3>Key Reforms</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>End commodity crop subsidies → redirect to fresh produce and family farming</li><li>No corporation controls >25% of any agricultural market</li><li>Ban corporate farmland ownership beyond operational needs</li><li>Ban all EU-banned pesticides and herbicides</li><li>Phase out glyphosate, atrazine, chlorpyrifos</li><li>Real organic certification — zero synthetic, third-party verified, QR tracking</li><li>Phase out worst factory farming practices over 10 years</li></ul></div>
    `
  });
}

function pageChildren(main) {
  policyPage(main, {
    title: 'Child Protection & Missing Children Prevention', subtitle: 'No child ages out of foster care into nothing.', icon: '🧒',
    impactId: 'child-impact', impactFn: () => ({ level: 'affects', message: 'Child protection reform creates federal rapid response for missing children, keeps siblings together in foster care, and connects aging-out youth directly to community infrastructure.' }),
    content: `
      <div class="calc-card"><h3>Core Programs</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>National Missing Children Command Center with AI-powered search</li><li>Amber Alert 2.0 — AI license plate recognition, cross-state coordination</li><li>Federal Child Welfare Oversight Board auditing state CPS</li><li>Siblings kept together — always</li><li>Aging out at 18 → community infrastructure pipeline (job training, mentorship, path to ownership)</li><li>Public transparency dashboards for child welfare performance</li></ul></div>
    `
  });
}

function pageTechnology(main) {
  policyPage(main, {
    title: 'Technology, AI & Space Leadership', subtitle: 'The 21st century battlefield is a semiconductor. China has $1.4T invested. We have a committee.', icon: '🤖',
    impactId: 'tech-impact', impactFn: () => ({ level: 'affects', message: '$500B AI fund, $250B domestic chip manufacturing, $200B cybersecurity shield, $100B NASA investment. The country that leads in AI sets the rules for everything else.' }),
    content: `
      <div class="stats-row"><div class="stat-card"><div class="stat-value">$500B</div><div class="stat-label">AI R&D Fund</div></div><div class="stat-card"><div class="stat-value">$250B</div><div class="stat-label">Chip Manufacturing</div></div><div class="stat-card"><div class="stat-value">$200B</div><div class="stat-label">Cybersecurity Shield</div></div><div class="stat-card"><div class="stat-value">$100B</div><div class="stat-label">NASA & Space</div></div></div>
      <div class="calc-card"><h3>Programs</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>National AI Workforce Initiative for retraining</li><li>AI Ethics & Accountability Standards</li><li>Algorithmic Transparency Law</li><li>Rare Earth & Mineral Security Act</li><li>Space Defense Command</li><li>AEGIS as national security infrastructure</li></ul></div>
    `
  });
}

function pageForeignPolicy(main) {
  policyPage(main, {
    title: 'Foreign Policy & Global Leadership', subtitle: 'Lead differently. Smarter, stronger, focused on peace.', icon: '🌍',
    impactId: 'fp-impact', impactFn: () => ({ level: 'affects', message: 'Foreign policy reform saves hundreds of billions by ending free-riding allies and shifting to technological superiority over numerical superiority.' }),
    content: `
      <div class="calc-card"><h3>Five Principles</h3><ol style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
        <li><strong>America Solvent = America Strong</strong> — no more bankrupting ourselves on military overreach</li>
        <li><strong>Allies Carry Their Weight</strong> — NATO $454B collectively, American forward presence scales with investment</li>
        <li><strong>Tech Superiority Over Numbers</strong> — cyber, AI, hypersonics beat trillion-dollar bloat</li>
        <li><strong>Nuclear Deterrence Non-Negotiable</strong> — triad fully funded, zero cuts</li>
        <li><strong>Diplomacy Reduces Military Necessity</strong> — rebuild State Department, a diplomat costs $150K/yr vs. billions for a war</li>
      </ol></div>
      <div class="calc-card"><h3>China Strategy</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Ban Chinese ownership of critical US infrastructure and tech</li><li>Full tech export controls</li><li>Counter Belt and Road with allied development financing</li><li>New supply chains outside authoritarian regions</li><li>Concentrated Indo-Pacific fleet</li></ul></div>
    `
  });
}

function pageEnvironment(main) {
  policyPage(main, {
    title: 'Climate & Environment', subtitle: 'You don\'t need a climate debate to know you shouldn\'t poison the water people drink.', icon: '🌿',
    impactId: 'env-impact', impactFn: () => ({ level: 'affects', message: 'Clean energy is economic and national security policy. Corporate emission accountability through AEGIS. No personal mandates — no gas stove bans, no vehicle mandates.' }),
    content: `
      <div class="calc-card"><h3>Approach</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Carbon fee on corporations above emission threshold — collected by AEGIS</li><li>Environmental violations are crimes — executives go to jail</li><li>Federal buildings → renewable energy within 10 years</li><li>Nuclear power back on table (small modular reactors)</li><li>70% renewable electricity by 2035</li><li>No personal mandates of any kind</li><li>Mandatory recycling with corporate packaging responsibility</li><li>Ban single-use plastics with no recycling pathway</li></ul></div>
    `
  });
}

function pageCommunity(main) {
  policyPage(main, {
    title: 'Community Infrastructure Investment', subtitle: '"We\'re building cities within cities. Owned by the people who live there."', icon: '🏘️',
    impactId: 'comm-impact', impactFn: () => ({ level: 'affects', message: 'Community investment builds city blocks owned by residents — manufacturing co-ops, affordable condos, storefronts, daycare, healthcare clinics. No outside investors. No corporate landlords.' }),
    content: `
      <div class="calc-card"><h3>The Block</h3><p style="color:var(--slate-700)">A city block. Purchased, developed, owned as a community asset. Manufacturing co-op at base, residential condos above, storefronts at street level, daycare inside, healthcare clinic on site, park in the middle.</p></div>
      <div class="calc-card"><h3>The Ownership Ladder</h3><ol style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li><strong>The Block</strong> — arrive with nothing, stabilize, build first equity through sweat equity</li><li><strong>The Neighborhood</strong> — move outward into rehabilitated houses, sell block condo at modest profit for down payment</li><li><strong>Generational Wealth</strong> — house appreciates as neighborhood improves. The cycle breaks completely.</li></ol></div>
    `
  });
}

function pageInsurance(main) {
  policyPage(main, {
    title: 'The American Coverage System', subtitle: '"Insurance exists to protect people from catastrophic loss. Not to generate profit."', icon: '📋',
    impactId: 'ins-impact', impactFn: () => ({ level: 'affects', message: 'The American Coverage System replaces private insurance with government-operated universal coverage at 2–3% overhead (vs. 12–18% private). Health, auto, home, renters, life, disability, title, and business interruption — all covered. FEMA eliminated.' }),
    content: `
      <div class="stats-row">
        <div class="stat-card"><div class="stat-value">12–18%</div><div class="stat-label">Private Insurer Overhead</div></div>
        <div class="stat-card"><div class="stat-value">2–3%</div><div class="stat-label">Medicare/ACS Overhead</div></div>
        <div class="stat-card"><div class="stat-value">$200–300B</div><div class="stat-label">Extracted Annually Before Claims</div></div>
      </div>

      <div class="calc-card"><h3>Universal Coverage — All Categories</h3>
        <table class="data-table"><thead><tr><th>Category</th><th>Coverage</th></tr></thead><tbody>
          <tr><td>Health</td><td>Universal coverage through public option, private insurance replaced</td></tr>
          <tr><td>Auto</td><td>Government operates at actual actuarial cost</td></tr>
          <tr><td>Home</td><td>National risk pool — every homeowner regardless of location or climate risk</td></tr>
          <tr><td>Renters</td><td>Every renter covered, no separate product required</td></tr>
          <tr><td>Life</td><td>Basic term coverage at actual actuarial cost</td></tr>
          <tr><td>Disability</td><td>Expanded from existing SS disability infrastructure</td></tr>
          <tr><td>Title</td><td>Government-operated, eliminating predatory closing costs</td></tr>
          <tr><td>Business Interruption</td><td>Basic coverage for small businesses</td></tr>
        </tbody></table>
        <p style="font-size:0.875rem;color:var(--slate-600);margin-top:1rem;">Funded through NST revenue allocation. No individual premiums. You are American. You are covered.</p>
      </div>

      <div class="calc-card"><h3>FEMA Is Eliminated</h3><p style="color:var(--slate-700)">FEMA was always government disaster insurance called something else. Under the ACS, disaster relief is a claim. Claims get paid automatically. No congressional vote. No disaster declaration theater. No waiting 6 months for Congress to approve hurricane aid. FEMA's $20–30B annual budget disappears from discretionary spending.</p></div>

      <div class="calc-card"><h3>What Happens to Private Insurance</h3><p style="color:var(--slate-700)">Private health insurance collapses when the public option is free at point of access. <strong>This is the intended outcome.</strong> Private auto, home, life insurers may compete — but cannot match 2–3% overhead vs. their 12–18%. They will shrink. Americans will be covered regardless.</p></div>

      <div class="calc-card"><h3>Professional & Corporate Liability</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Professional liability at actual actuarial cost, premiums based on negligence history tracked by AEGIS</li><li>3 documented negligence findings → permanent certification revocation nationally</li><li>Institutions maintaining negligent practitioners → corporate criminal liability</li><li>No quiet resignation and relicensing in another state</li></ul></div>

      <div class="calc-card"><h3>Statutes of Limitations — Eliminated</h3><p style="color:var(--slate-700)">For all crimes and civil wrongs. If you committed fraud in 1987 and we can prove it today — you answer for it today. If a doctor's negligence caused harm discovered a decade later — the victim has the same right to accountability. The clock never runs out. Justice does not expire.</p></div>
    `
  });
}

function pageGuns(main) {
  policyPage(main, {
    title: 'Gun Policy', subtitle: '"We\'ve been arguing about the weapon for thirty years while ignoring the wound."', icon: '🎯',
    impactId: 'gun-impact', impactFn: () => ({ level: 'affects', message: 'Gun policy focuses on root causes: mental health access, community connection, economic security. Plus universal background checks and red flag laws with due process.' }),
    content: `
      <div class="calc-card"><h3>What Actually Reduces Violence</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Communities where people feel they belong</li><li>Accessible, affordable, destigmatized mental health care</li><li>Economic security</li><li>Montessori-informed education that sees every child</li><li>A society that doesn't stay quiet about bullying</li></ul></div>
      <div class="calc-card"><h3>Policy Framework</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Universal background checks — no exceptions</li><li>Red flag laws with full due process</li><li>Mandatory gun safety education in schools</li><li>Responsible ownership protected — no confiscation, no blanket bans</li></ul></div>
    `
  });
}

function pageReproductive(main) {
  policyPage(main, {
    title: 'Reproductive Rights', subtitle: '"I\'m pro-life. All of it. Before the birth and after it."', icon: '🤰',
    impactId: 'repro-impact', impactFn: () => ({ level: 'affects', message: 'The full platform IS the pro-life position: universal healthcare, pre-K, community infrastructure, affordable food, senior UBI. Pro-life from conception through old age.' }),
    content: `
      <div class="calc-card"><h3>Position</h3><p style="color:var(--slate-700)">"If you're only pro-life until the cord is cut, you're not pro-life — you're pro-birth. Those aren't the same thing."</p>
      <p style="color:var(--slate-700);margin-top:1rem;">Extenuating circumstances — rape, incest, life of the mother — the choice belongs to the woman. Not the government.</p></div>
      <div class="calc-card"><h3>The Full Platform as the Real Pro-Life Position</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Universal healthcare</li><li>Universal pre-K</li><li>Community infrastructure for aging-out foster kids</li><li>Affordable healthy food</li><li>Senior UBI</li><li>Every other chapter in this handbook</li></ul></div>
    `
  });
}

function pageTransparency(main) {
  policyPage(main, {
    title: 'Government Transparency & AEGIS', subtitle: '"If you work for the American people, the American people get to watch."', icon: '🔍',
    impactId: 'trans-impact', impactFn: () => ({ level: 'affects', message: 'Five interconnected transparency systems: OpenLedger, CivicSignal, WhosRunningUSA, Accountability Gap Engine, and AEGIS. Every dollar tracked. Every vote cross-referenced. Every discrepancy public.' }),
    content: `
      <div class="calc-card"><h3>The Five-System Infrastructure</h3><table class="data-table"><thead><tr><th>System</th><th>Function</th></tr></thead><tbody>
        <tr><td><strong>OpenLedger</strong></td><td>Every government expenditure, searchable in plain language, updated in real time</td></tr>
        <tr><td><strong>CivicSignal</strong></td><td>Citizen reporting — GPS-tagged, mandatory response timelines, auto-escalation</td></tr>
        <tr><td><strong>WhosRunningUSA</strong></td><td>Every candidate, every vote, every dollar, every promise tracked</td></tr>
        <tr><td><strong>Accountability Gap Engine</strong></td><td>Auto cross-reference what politicians say vs. what they do</td></tr>
        <tr><td><strong>AEGIS</strong></td><td>AI monitoring every government transaction in real time</td></tr>
      </tbody></table></div>
      <div class="calc-card"><h3>AEGIS Core Functions</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Real-time transaction monitoring across all 430+ federal agencies</li><li>Pattern recognition — vendor billing 40% above market across agencies flagged in hours</li><li>Contractor open book auditing — $10K billed for $8 part flagged before payment</li><li>Benefit program integrity — dead people stop receiving checks same day</li><li>Market surveillance — unusual trading before government announcements flagged</li><li>Four-tier alert cascade: agency → IG → public → citizen subscribers</li></ul></div>
      <div class="calc-card"><h3>AEGIS Governance — Anti-Weaponization</h3><p style="color:var(--slate-700)"><strong>Governance structure:</strong> fully public — who controls AEGIS, how board members are appointed, what authority they have. Any citizen can verify through OpenLedger.</p><p style="color:var(--slate-700);margin-top:0.75rem;"><strong>Detection methodology:</strong> independently audited but <em>not</em> fully public. Publishing exactly what AEGIS looks for would allow sophisticated actors to structure transactions to avoid detection. Auditors rotate — no firm audits AEGIS twice in a row.</p><p style="color:var(--slate-700);margin-top:0.75rem;">AEGIS's own operations are published through OpenLedger — every flag, every referral, every case. The system watches itself.</p></div>
      <div class="calc-card"><h3>Body Cameras & Recording</h3><p style="color:var(--slate-700)">All federal law enforcement and officials: body cameras during all official functions. All meetings involving policy or budget: recorded and published within 72 hours. Federal funding for state/local law enforcement contingent on compliance within 2 years.</p></div>
    `
  });
}

function pageCorporate(main) {
  policyPage(main, {
    title: 'Corporate Criminal Accountability', subtitle: '"You steal billions with a spreadsheet and pay a fine. Steal a car and go to prison. Done with that math."', icon: '🔨',
    impactId: 'corp-impact', impactFn: () => ({ level: 'affects', message: 'Universal penalty: disgorgement of ALL profits from violation + 10%. Personal criminal liability for executives. The corporate structure is not a shield.' }),
    content: `
      <div class="calc-card"><h3>The Universal Penalty Standard</h3><p style="color:var(--slate-700)">Every fine, every penalty: disgorgement of all profits from violation <strong>plus 10%</strong>. You cannot profit from breaking the law. Not one dollar.</p>
      <p style="color:var(--slate-700);margin-top:0.75rem;">The 10% funds enforcement — the system pays for itself from the crimes it catches.</p></div>
      <div class="calc-card"><h3>Professional Negligence — Personal Accountability</h3><p style="color:var(--slate-700)">Doctors, lawyers, engineers, pharmacists — knowing negligence carries personal criminal prosecution. Three documented negligence findings = permanent certification revocation nationally through the National Skills Certification System. No quiet resignation and relicensing in another state.</p><p style="color:var(--slate-700);margin-top:0.75rem;">Institutions that knowingly maintained negligent practitioners face corporate criminal liability. Profit + 10% clawed back.</p></div>

      <div class="calc-card"><h3>Where This Applies</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Consumer fraud — hidden fees, deceptive pricing</li><li>Defense contractor fraud — overbilling, cost inflation</li><li>Predatory lending</li><li>Pharmaceutical fraud — knowingly dangerous drugs</li><li>Healthcare billing fraud</li><li>Environmental violations</li><li>Market manipulation and insider trading</li><li>Government contractor fraud</li><li>Professional negligence — knowing malpractice</li><li>Institutional liability — maintaining negligent practitioners</li></ul></div>

      <div class="calc-card"><h3>Statutes of Limitations — Eliminated</h3><p style="color:var(--slate-700)">For all crimes — corporate, professional, and individual. AEGIS creates permanent digital records. Evidence doesn't degrade — it accumulates. A corporation that poisoned a town in 1990 and spent 35 years running out the clock — the clock is gone.</p></div>
      <div class="calc-card"><h3>Corporate Accountability Division</h3><p style="color:var(--slate-700)">Dedicated DOJ division. Fixed-term appointments. Cases initiated by AEGIS referrals and citizen CivicSignal reports. Every case filed, conviction, fine, and acquittal — public record in real time through OpenLedger.</p></div>
    `
  });
}

function pageFed(main) {
  policyPage(main, {
    title: 'Federal Reserve Reform — The American Monetary Authority', subtitle: '"The Fed was designed in secret by bankers in 1913. The AMA operates in public, in plain English."', icon: '🏛️',
    impactId: 'fed-impact', impactFn: () => ({ level: 'affects', message: 'The Fed is replaced by the American Monetary Authority — fully transparent, Senate-confirmed board, rate decisions in plain English, all profits remitted to Treasury automatically.' }),
    content: `
      <div class="calc-card"><h3>AMA Functions</h3><table class="data-table"><thead><tr><th>Function</th><th>How</th></tr></thead><tbody>
        <tr><td>Inflation Control</td><td>Transparent public board, published methodology, plain English decisions within 24 hours</td></tr>
        <tr><td>Crisis Prevention</td><td>AEGIS detects patterns years in advance — no 2008-style surprises</td></tr>
        <tr><td>Money Supply</td><td>Treasury issuance managed directly, published in real time on OpenLedger</td></tr>
        <tr><td>Lending Oversight</td><td>Administers 15% consumer lending cap through AEGIS</td></tr>
      </tbody></table></div>
      <div class="calc-card"><h3>Mandatory Full Remittance</h3><p style="color:var(--slate-700)">All profits from Treasury holdings remitted to Treasury automatically and in full. No discretionary retention. No withholding. Formula published. Transfer automatic. Public verification through OpenLedger.</p></div>
    `
  });
}

function pagePoverty(main) {
  policyPage(main, {
    title: 'Anti-Poverty & Economic Mobility', subtitle: 'Poverty is a system failure. 38 million Americans below the poverty line.', icon: '📈',
    impactId: 'pov-impact',
    impactFn: p => {
      const inc = Number(p.income) || 0;
      if (inc && inc < 50000) return { level: 'affects', message: `At ${fmtDollar(inc)} income, anti-poverty policies directly benefit you: living wage standard, childcare capped at 7% of income, 12 weeks paid leave, baby bonds, 15% rate cap, and ban on cash bail.` };
      return { level: 'partial', message: 'Anti-poverty reforms strengthen every community: living wage, affordable childcare, paid leave, baby bonds at birth, and ending the poverty penalty in courts.' };
    },
    content: `
      <div class="calc-card"><h3>Core Programs</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>National Living Wage tied to local cost-of-living, adjusting every 2 years</li><li>Childcare capped at 7% of income</li><li>12 weeks national paid family leave</li><li>15% interest rate cap eliminating predatory lending</li><li>Universal Retirement Accounts with federal matching</li><li>Employee Ownership Incentives (ESOPs)</li><li>Ban cash bail for nonviolent offenses</li><li>Cap court fees, end poverty-based license suspensions</li><li>Fully fund public defender systems</li></ul></div>
    `
  });
}

function pageDemocracy(main) {
  policyPage(main, {
    title: 'Democracy Reform', subtitle: '"You should be making decisions for future generations while you still have skin in the game."', icon: '🗳️',
    impactId: 'dem-impact', impactFn: () => ({ level: 'affects', message: 'Democracy reform: term limits for all, age fitness assessments, proportional Electoral College, ranked-choice voting, blind application system, Supreme Court 18-year terms.' }),
    content: `
      <div class="calc-card"><h3>The 65 Rule</h3><p style="color:var(--slate-700)">No one begins a new term if they'll reach 65 before it concludes. Constitutional amendment pursued + immediate Federal Fitness Assessment Act: mandatory annual cognitive/physical assessment for officials over 70, results published publicly.</p></div>
      <div class="calc-card"><h3>Term Limits</h3><table class="data-table"><thead><tr><th>Office</th><th>Limit</th></tr></thead><tbody>
        <tr><td>Senate</td><td>2 terms (12 years)</td></tr>
        <tr><td>House</td><td>4 terms (8 years)</td></tr>
        <tr><td>President</td><td>2 terms (existing)</td></tr>
        <tr><td>Supreme Court</td><td>18-year staggered terms — 2 appointments per president per term</td></tr>
      </tbody></table></div>
      <div class="calc-card"><h3>Electoral College Reform</h3><p style="color:var(--slate-700)">Proportional allocation by congressional district (like Maine & Nebraska). Every district competitive. Every vote matters. Rural districts in blue states matter. Urban districts in red states matter.</p></div>
      <div class="calc-card"><h3>Other Reforms</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Blind Application System — name, race, gender, age removed from federal job/college apps</li><li>Death penalty only when guilt is undisputable (not just beyond reasonable doubt)</li><li>LGBTQ rights — same rights as everyone, no more, no less</li><li>Reparations through community infrastructure investment (Ch 29)</li></ul></div>
    `
  });
}

function pageConsumer(main) {
  policyPage(main, {
    title: 'Consumer Protection & Truth in Commerce', subtitle: 'The price you see is the price you pay. Every time. No exceptions.', icon: '🛒',
    impactId: 'consumer-impact', impactFn: () => ({ level: 'affects', message: 'All-in pricing law: every price shown is the final price. No hidden fees on airlines, hotels, tickets, car dealers, or cable. Subscription cancellation as easy as signup.' }),
    content: `
      <div class="calc-card"><h3>The All-In Pricing Law</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Airlines — total price including all fees before purchase</li><li>Hotels — total including resort/cleaning fees</li><li>Ticket platforms — no service fees at checkout</li><li>Car dealers — no documentation/preparation/market adjustment fees</li><li>Cable/internet — no broadcast/regulatory/enhancement fees</li><li>Only addition at checkout: government sales tax</li></ul></div>
      <div class="calc-card"><h3>Subscription Transparency</h3><p style="color:var(--slate-700)">Cancel as easily as you signed up. Same method, same time. No retention calls. 60-day written notice for price increases with clear opt-out. No silent mid-cycle increases.</p></div>
      <div class="calc-card"><h3>No Drug Advertising</h3><p style="color:var(--slate-700)">Ban direct-to-consumer prescription drug advertising. Your doctor decides medication — not a commercial. Saves $6–7B/yr embedded in drug prices.</p></div>
    `
  });
}

// ─── PUBLIC UNIVERSITY ─────────────────────────────────────
function pageUniversity(main) {
  policyPage(main, {
    title: 'The American Public University System', subtitle: '"We don\'t need new money to make college free. We need to stop wasting the money we already spend."', icon: '🎓',
    impactId: 'uni-impact',
    impactFn: p => {
      const age = Number(p.age) || 0;
      if (age > 0 && age < 30) return { level: 'affects', message: `At age ${age}, the American Public University System means free enrollment in any field — degree or vocational. No tuition. No student debt. The $1.7T student loan crisis ends.` };
      const hh = Number(p.householdSize) || 0;
      if (hh > 2) return { level: 'affects', message: `With a household of ${hh}, this means free college or vocational training for your family. No tuition. No debt. Every field available.` };
      return { level: 'partial', message: 'Free public university and vocational training for every American. Funded by consolidating 50 state bureaucracies into one — the savings pay for free college.' };
    },
    content: `
      <div class="stats-row">
        <div class="stat-card"><div class="stat-value">$1.7T</div><div class="stat-label">Current Student Debt</div></div>
        <div class="stat-card"><div class="stat-value">50</div><div class="stat-label">Redundant State Systems</div></div>
        <div class="stat-card"><div class="stat-value">$20–30B</div><div class="stat-label">Consolidation Savings</div></div>
        <div class="stat-card"><div class="stat-value">$0</div><div class="stat-label">Net New Federal Cost</div></div>
      </div>

      <div class="calc-card">
        <h3>How It Works</h3>
        <p style="color:var(--slate-700)">Federalize existing accredited public state universities and community colleges into one national system. Students pay nothing. Administrative savings from consolidation cover the cost of eliminating tuition.</p>
        <table class="data-table" style="margin-top:1rem;">
          <thead><tr><th>Current Funding</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td>Total public higher ed cost</td><td>~$350B/yr</td></tr>
            <tr><td>State funding</td><td>~$150B</td></tr>
            <tr><td>Federal grants & aid</td><td>~$120B</td></tr>
            <tr><td>Student tuition</td><td>~$100–130B</td></tr>
            <tr><td>Admin savings from consolidation</td><td>$20–30B</td></tr>
            <tr style="background:var(--success-bg)"><td><strong>Student loan program eliminated</strong></td><td><strong>$85–100B/yr stopped</strong></td></tr>
          </tbody>
        </table>
        <p style="font-size:0.875rem;color:var(--slate-600);margin-top:0.75rem;">Same money. Different path. No debt accumulation. The consolidation pays for free college.</p>
      </div>

      <div class="calc-card">
        <h3>All Fields. No Exceptions.</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li><strong>Blue collar:</strong> electricians, plumbers, mechanics, welders, carpenters, HVAC, construction</li>
          <li><strong>White collar:</strong> every academic and professional field</li>
          <li><strong>Emerging fields:</strong> AI, quantum computing, biotech, clean energy, cybersecurity, space systems</li>
          <li>Student enrollment drives capacity — demand signals what to expand or contract</li>
          <li>Private universities (Harvard, Yale) continue untouched</li>
          <li>Predatory mid-tier privates charging $60K/yr for worthless credentials collapse naturally</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>The Accountability Framework</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>One fully funded program per person</li>
          <li>Complete it + work in the field broadly defined for 2 years → obligation fulfilled</li>
          <li>Don't work in the field → 2 years government service OR automatic paycheck garnishment (max 5% of gross, suspended below $30K income)</li>
          <li>No interest. No collections. No credit destruction. No courts.</li>
          <li>AEGIS tracks employment and obligation automatically</li>
          <li>Second program available only after first obligation fulfilled</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Governance & Quality</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Independent board — staggered terms, Senate confirmed</li>
          <li>No political appointee touches curriculum, hiring, or standards</li>
          <li>Constitutionally protected formula funding — Congress cannot cut below floor</li>
          <li>Faculty at market rates on a national scale, published through OpenLedger</li>
          <li>UC system (government-run) produced 67 Nobel laureates — that's the standard</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Foster Care Connection</h3>
        <p style="color:var(--slate-700)">Every child aging out of foster care receives fully funded enrollment — degree or vocational — with no age cap. Supported housing and sweat equity in the community infrastructure pipeline runs simultaneously. You arrive with nothing. You have a roof. You study. You work. You build equity.</p>
      </div>
    `
  });
}

// ─── SKILLS CERTIFICATION ──────────────────────────────────
function pageCertification(main) {
  policyPage(main, {
    title: 'The National Skills Certification System', subtitle: '"The credential is what you can do — not where you went to learn it."', icon: '📜',
    impactId: 'cert-impact',
    impactFn: () => ({ level: 'affects', message: 'National competency-based certification breaks the school-name monopoly. Harvard grad and government university grad who both pass the same exam hold equivalent credentials. Federal contractors must hire on skills, not school names.' }),
    content: `
      <div class="stats-row">
        <div class="stat-card"><div class="stat-value">~$1B/yr</div><div class="stat-label">System Cost</div></div>
        <div class="stat-card"><div class="stat-value">$50–100</div><div class="stat-label">Per Attempt Fee</div></div>
        <div class="stat-card"><div class="stat-value">~$0</div><div class="stat-label">Net Federal Cost</div></div>
      </div>

      <div class="calc-card">
        <h3>How It Works</h3>
        <p style="color:var(--slate-700)">If you can demonstrate mastery in a controlled environment, under verified conditions, using the same standard applied to every other candidate — you are certified. Regardless of how you learned it, how long it took, or whether you attended a university or taught yourself.</p>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;margin-top:0.75rem;">
          <li>Standards written by rotating boards of the highest practitioners — not bureaucrats</li>
          <li>Knowledge fields: rigorous written + practical examination</li>
          <li>Hands-on fields (medicine, electrical, aviation): supervised practice component</li>
          <li>Existing license holders grandfathered automatically</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>The Three Attempt Rule</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>3 attempts per certification</li>
          <li>After 1st failure: free targeted crash course through the Public University System</li>
          <li>After 2nd failure: more intensive crash course</li>
          <li>After 3rd failure: that certification is closed</li>
          <li>May pursue any other certification — one door closes, every other stays open</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Supervised Practice</h3>
        <p style="color:var(--slate-700)">Fields involving direct responsibility for human safety require supervised practice before full certification. Hours set by the same practitioner board that writes the exam. National placement registry connects independent learners with supervising institutions.</p>
      </div>

      <div class="calc-card">
        <h3>The School Name Problem — Solved</h3>
        <p style="color:var(--slate-700)">Goldman Sachs targets a defined list of schools. Elite law firms recruit from five institutions. This is class reproduction, not meritocracy. The National Skills Certification is pass or fail. It doesn't know your school name or zip code. It knows whether you can do the work.</p>
        <h4 style="margin-top:1rem;">Federal Contractor Hiring Requirements</h4>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Companies with >$1M in federal contracts must demonstrate merit-based hiring</li>
          <li>School name cannot be used as a filter or screening criterion</li>
          <li>Hiring decisions subject to AEGIS audit</li>
          <li>Violations: contract suspension + profit + 10% clawback</li>
        </ul>
      </div>
    `
  });
}

// ─── ASK AI ────────────────────────────────────────────────
function pageAsk(main) {
  main.innerHTML = `
    <div class="page-header"><div class="container">
      <h1>Ask About Any Policy</h1>
      <p class="page-subtitle">Powered by AI. Ask anything about the Phillips platform. Your profile data is included for personalized answers.</p>
    </div></div>
    <div class="section"><div class="container">
      <div class="chat-container">
        <div class="chat-messages" id="chat-messages">
          <div class="chat-message assistant">
            <div class="chat-avatar">AI</div>
            <div class="chat-bubble">Hi! I can answer questions about any of the 39 policy chapters in the Blueprint for American Renewal. Ask me anything — how a specific policy works, how it affects you personally, or how different proposals connect. What would you like to know?</div>
          </div>
        </div>
        <div class="chat-input-row">
          <input type="text" id="chat-input" placeholder="Ask about any policy..." onkeydown="if(event.key==='Enter')sendChat()">
          <button class="btn btn-primary" onclick="sendChat()">Send</button>
        </div>
      </div>
    </div></div>`;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const messages = document.getElementById('chat-messages');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  messages.innerHTML += `<div class="chat-message user"><div class="chat-avatar">You</div><div class="chat-bubble">${escapeHtml(msg)}</div></div>`;
  messages.innerHTML += `<div class="chat-message assistant" id="chat-loading"><div class="chat-avatar">AI</div><div class="chat-bubble" style="opacity:0.6;">Thinking...</div></div>`;
  messages.scrollTop = messages.scrollHeight;

  try {
    const res = await fetch('/api/blueprint/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, profile: getProfile() }),
    });
    const data = await res.json();
    document.getElementById('chat-loading')?.remove();
    const answer = data.answer || data.error || 'No response.';
    messages.innerHTML += `<div class="chat-message assistant"><div class="chat-avatar">AI</div><div class="chat-bubble">${formatMarkdown(answer)}</div></div>`;
  } catch (err) {
    document.getElementById('chat-loading')?.remove();
    messages.innerHTML += `<div class="chat-message assistant"><div class="chat-avatar">AI</div><div class="chat-bubble" style="color:var(--error);">Error connecting to AI service. Please try again.</div></div>`;
  }
  messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatMarkdown(s) {
  return s.replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>');
}

// ─── 404 ───────────────────────────────────────────────────
function page404(main) {
  main.innerHTML = `
    <div class="section" style="text-align:center;padding:5rem 0;">
      <div class="container">
        <h1>Page Not Found</h1>
        <p style="color:var(--slate-600);margin:1rem 0 2rem;">The page you're looking for doesn't exist.</p>
        <a href="/" class="btn btn-primary" data-nav>Back to Home</a>
      </div>
    </div>`;
  main.querySelector('[data-nav]')?.addEventListener('click', e => {
    e.preventDefault();
    history.pushState(null, '', BASE + '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

// ─── Prefill from profile ──────────────────────────────────
function prefillCalc() {
  const p = getProfile();
  const map = {
    'tax-income': p.income, 'tax-spending': p.monthlySpending,
    'prop-tax': p.propertyTax, 'vet-years': p.yearsServed,
    'hc-costs': p.healthcareCosts, 'hc-household': p.householdSize,
    'loan-bal': p.debtBalances, 'loan-rate': p.debtRates,
  };
  for (const [id, val] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  }
}
