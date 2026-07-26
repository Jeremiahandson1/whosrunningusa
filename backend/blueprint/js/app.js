/* Phillips Policy Hub — SPA Router & All Pages */

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
    '/agencies': pageAgencies,
    '/pharma': pagePharma,
    '/minimum-wage': pageMinimumWage,
    '/integrity': pageIntegrity,
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
    { href:'/veterans', icon:'🎖️', title:'Veterans', desc:'Up to $400/month per year served toward the income floor. No forms. No case workers.' },
    { href:'/seniors', icon:'👴', title:'Seniors & Social Security', desc:'Senior UBI up to $5,000/mo. SS buyout option.' },
    { href:'/healthcare', icon:'🏥', title:'Healthcare', desc:'Universal coverage. No copays. Mental health parity.' },
    { href:'/pharma', icon:'🧪', title:'Pharmaceutical Reform', desc:'Medicare negotiation. Reference pricing. Insulin at $35.' },
    { href:'/loans', icon:'🏦', title:'Banking & Loans', desc:'15% rate cap. End payday lending. Break up too-big-to-fail.' },
    { href:'/housing', icon:'🔑', title:'Housing Reform', desc:'Ban corporate homeownership. End speculation.' },
    { href:'/military', icon:'🛡️', title:'Military Reform', desc:'Cut contractor corruption. $550B budget that buys more.' },
    { href:'/drugs', icon:'💊', title:'Drug Policy', desc:'Legalize natural substances. Treat addiction. Destroy cartels.' },
    { href:'/education', icon:'📚', title:'Education', desc:'Equal per-student funding. Universal pre-K. Vocational dignity.' },
    { href:'/criminal-justice', icon:'⚖️', title:'Criminal Justice', desc:'End private prisons. End qualified immunity. Real reform.' },
    { href:'/immigration', icon:'🗽', title:'Immigration', desc:'Welcome America system. Capacity-based. Humane.' },
    { href:'/government', icon:'🏛️', title:'Government Reform', desc:'Term limits. End corruption. Ban lobbying.' },
    { href:'/agencies', icon:'🏢', title:'Reducing Redundant Agencies', desc:'Cut overhead, not people. $100B/yr in consolidation savings.' },
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
    { href:'/integrity', icon:'🚫', title:'Public Service Integrity', desc:'No stock trading for officials. Two-year revolving-door ban.' },
    { href:'/corporate', icon:'🔨', title:'Corporate Accountability', desc:'Fines always exceed profits. Executives go to jail.' },
    { href:'/fed', icon:'🏛️', title:'Federal Reserve Reform', desc:'Replace the Fed. Full transparency. End the shadows.' },
    { href:'/poverty', icon:'📈', title:'Anti-Poverty', desc:'Living wage. Baby bonds. End the poverty penalty.' },
    { href:'/minimum-wage', icon:'💵', title:'Minimum Wage', desc:'$15/hr — worth $19–20 today after taxes vanish.' },
    { href:'/democracy', icon:'🗳️', title:'Democracy Reform', desc:'Term limits. Age limits. Ranked choice. Fair elections.' },
    { href:'/university', icon:'🎓', title:'Public University System', desc:'Federalize state universities. Free tuition. Consolidation pays for it.' },
    { href:'/certification', icon:'📜', title:'Skills Certification', desc:'National competency-based certification. The credential is what you can do, not where you went.' },
  ];

  main.innerHTML = `
    <div class="hero">
      <div class="container hero-content">
        <h1>A Blueprint for <span>American Renewal</span></h1>
        <p class="hero-tagline">"We're going to fix the world and it starts here."</p>
        <p>41 policy chapters. Personalized calculators. See exactly how each proposal affects <em>your</em> household.</p>
        <div class="hero-actions">
          <button class="btn btn-primary" onclick="renderProfileModal()">Build Your Profile</button>
          <a href="/tax" class="btn btn-secondary" data-nav>Start with Tax Reform</a>
        </div>
      </div>
    </div>
    <div class="section" style="background:var(--slate-50);"><div class="container">
      <div class="calc-card" style="max-width:800px;margin:0 auto;">
        <h2 style="margin-bottom:1rem;">Why I'm Running</h2>
        <p style="color:var(--slate-700)">I'm not a politician. I've never held office. I don't have a war chest or a party machine behind me.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;">What I have is a story that starts in Memphis with police lights reflecting off a house window, moves through a foster home in San Diego, through a prison cell at nineteen, through thirty years of rebuilding, and arrives here.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;">I'm running because I can't stand the thought of innocent people suffering — especially when it isn't at their own doing. That's not a campaign slogan. That's the sentence that explains my entire life.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;">I was a foster kid. I know what it feels like to have the system decide what happens to you. I was a felon. I know what it feels like when one decision follows you for decades. I was broke. I know what it feels like to build something from nothing with no safety net underneath you.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;">I've been on the wrong side of every system in this platform. That's not a liability. That's a qualification.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;font-weight:600;">This is what I'm going to do about it.</p>
      </div>
    </div></div>
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
    title: 'Tax Reform — The Phillips Tax System',
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
        message: `You currently pay ~${fmtDollar(fedTax)} in federal income tax and ~${fmtDollar(payroll)} in payroll tax (${fmtDollar(totalEliminated)} total). Under the Phillips Tax System, those are eliminated. Your estimated NST on non-essential spending: ${fmtDollar(nst)}/year. Net change: <strong>${net >= 0 ? '+' : '-'}${fmtDollar(net)}/year (${net >= 0 ? '+' : '-'}${fmtDollar(net/12)}/month)</strong>.`
      };
    },
    content: `
      <div class="calc-card">
        <h3>Real Wage Calculator</h3>
        <p style="color:var(--slate-600)">See what your paycheck actually becomes under the Phillips Tax System.</p>
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
        <div class="counter-card"><div class="counter-value live" id="debt-counter">Loading...</div><div class="counter-label"><span class="live-dot"></span>National Debt</div></div>
        <div class="counter-card"><div class="counter-value live" id="deficit-counter">Loading...</div><div class="counter-label"><span class="live-dot"></span>Deficit Since You Opened This Page</div></div>
        <div class="counter-card"><div class="counter-value live" id="percitizen-counter">Loading...</div><div class="counter-label"><span class="live-dot"></span>Your Share of the Debt</div></div>
        <div class="counter-card"><div class="counter-value live" id="interest-counter">Loading...</div><div class="counter-label"><span class="live-dot"></span>Interest Since You Opened This Page</div></div>
      </div>
      <p id="debt-asof" style="text-align:center;font-size:0.75rem;color:var(--slate-500);margin-top:-1rem;margin-bottom:2rem;">Source: US Treasury (Debt to the Penny) — loading...</p>

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

  // Live debt counters — fetch real data from US Treasury via backend
  const debtPerMs = 83000 / 1000; // $83K/sec = $83/ms (CBO estimate)
  const deficitPerYear = 1_832_000_000_000; // CBO FY2026 projected deficit
  const deficitPerMs = deficitPerYear / (365.25 * 24 * 3600 * 1000);
  const interestPerYear = 952_000_000_000; // CBO FY2026 net interest
  const interestPerMs = interestPerYear / (365.25 * 24 * 3600 * 1000);
  const population = 336_500_000; // Census 2026 est

  function formatBigMoney(n) {
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(3) + ' Trillion';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + ' billion';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + ' million';
    return '$' + Math.floor(n).toLocaleString('en-US');
  }

  // Fetch real debt from Treasury API (cached on backend)
  let debtStart = 38_990_389_667_489; // fallback
  let debtAsOf = '2026-03-26';
  const startTime = Date.now();

  fetch('/api/blueprint/debt')
    .then(r => r.json())
    .then(d => {
      if (d.totalDebt) {
        debtStart = d.totalDebt;
        debtAsOf = d.asOf;
        // Update the "as of" display
        const asOfEl = document.getElementById('debt-asof');
        if (asOfEl) asOfEl.textContent = 'Source: US Treasury, as of ' + d.asOf;
      }
    })
    .catch(() => {}); // use fallback

  let debtAnimFrame;
  function tickCounters() {
    const elapsed = Date.now() - startTime;
    const currentDebt = debtStart + elapsed * debtPerMs;
    const elDebt = document.getElementById('debt-counter');
    const elDeficit = document.getElementById('deficit-counter');
    const elCitizen = document.getElementById('percitizen-counter');
    const elInterest = document.getElementById('interest-counter');

    if (!elDebt) { cancelAnimationFrame(debtAnimFrame); return; }

    elDebt.textContent = formatBigMoney(currentDebt);
    elDeficit.textContent = formatBigMoney(elapsed * deficitPerMs);
    elCitizen.textContent = '$' + Math.floor(currentDebt / population).toLocaleString('en-US');
    elInterest.textContent = formatBigMoney(elapsed * interestPerMs);

    debtAnimFrame = requestAnimationFrame(tickCounters);
  }
  tickCounters();
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
      return { level: 'affects', message: `With ${yrs} years of service, you'd receive <strong>up to ${fmtDollar(stipend)}/month</strong> toward the $2,450/month income floor. The stipend fills the gap between your current income and the floor — if you already meet it, you receive nothing. Automatic calculation, automatic deposit, adjusted monthly in real time.` };
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
          <thead><tr><th>Years Served</th><th>Max Monthly Stipend</th><th>Max Annual Amount</th></tr></thead>
          <tbody>
            <tr><td>4 years</td><td>Up to $1,600/mo</td><td>Up to $19,200/yr</td></tr>
            <tr><td>10 years</td><td>Up to $4,000/mo</td><td>Up to $48,000/yr</td></tr>
          </tbody>
        </table>
        <p style="font-size:0.875rem;color:var(--slate-600);margin-top:1rem;">The stipend fills the gap between your current income and the income floor (currently $2,450/month). Your maximum stipend can never exceed the floor. As the floor rises each February with the MIT Living Wage Calculator, so does the stipend available. A career military retiree with a pension does not qualify. Medical discharge qualifies. Automatic calculation and real-time deposit adjustment. No forms. No caseworkers.</p>
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
      <div class="result-value">Up to ${fmtDollar(monthly)}/mo</div>
      <div class="result-label">Up to ${fmtDollar(monthly * 12)} per year • Toward the $2,450/mo floor • For life • Means-tested</div>
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
        <h3>Protecting American Pensions</h3>
        <p style="color:var(--slate-700)">A pension is deferred compensation — wages already earned, already worked for, temporarily held by the employer. Under this platform:</p>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li><strong>The Earned Wages Principle:</strong> In any bankruptcy, pension obligations are reclassified as worker property — not creditor claims. Workers are made whole first.</li>
          <li><strong>Pension Solvency Mandate:</strong> Every company must maintain full funding through a segregated trust or full PBGC coverage. Below 90% triggers automatic fines. Below 80% triggers executive compensation restrictions. Below 70% triggers federal receivership.</li>
          <li><strong>Executive Clawback:</strong> If a company enters bankruptcy with an underfunded pension, executive compensation from the preceding seven years is subject to mandatory clawback to cover the shortfall.</li>
          <li><strong>Federal Contract Conditions:</strong> Any company receiving federal contracts or bailout funding cannot reduce or discharge pension obligations. Period.</li>
        </ul>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>Public sector pensions:</strong> The Required Annual Contribution is a mandatory appropriation — comes off the top before anything else in the budget. Elected officials who authorize a budget that fails to include the full contribution are <em>personally financially liable</em> and subject to immediate removal from office.</p>
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
        <h3>Mental Health Parity</h3>
        <p style="color:var(--slate-700)">Mental health care treated identically to physical health care. No separate deductibles. No separate limits. No insurance company deciding that ten therapy sessions is enough. A broken leg gets treated until it heals. A broken mind deserves the same standard.</p>
      </div>

      <div class="calc-card">
        <h3>How It's Funded</h3>
        <p style="color:var(--slate-700)">Pharmaceutical savings of $300–500 billion annually. Insurance overhead elimination — $500 billion (the 20–30% of every premium currently going to claims denial departments, prior authorization bureaucracies, and executive compensation). AEGIS fraud detection eliminating $80 billion in medical billing fraud annually. Dedicated NST revenue allocation. A healthier country costs less to treat. The math is cumulative and it works.</p>
      </div>

      <div class="calc-card">
        <h3>All-In Medical Pricing</h3>
        <p style="color:var(--slate-700)">Every hospital, clinic, and medical provider publishes actual prices for every procedure publicly before treatment wherever possible. No surprise billing. The price shown is the price paid. AEGIS cross-references all medical billing against published prices automatically — a hospital billing $15,000 for a procedure listed at $3,000 is flagged instantly. Criminal charges for knowing billing fraud. Profit plus 10% clawed back.</p>
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
        <h3>The Iceland Banking Model — Failed Banks Fail</h3>
        <p style="color:var(--slate-700)">In 2008 America bailed out the banks. The banks survived. Eight million Americans lost their homes anyway. Iceland let their banks fail, jailed the bankers, protected ordinary depositors, and recovered faster than any country that chose bailout.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;">Under this platform: failed banks fail. Domestic depositors protected through FDIC. Good assets transferred to new restructured institutions. Bad assets stay in the failed entity and get unwound. Predatory mortgages restructured to benefit homeowners: principal reduced to actual market value, interest capped at 15%, payments reset to affordable levels. The bank is gone. The banker goes to jail. The homeowner keeps their house.</p>
      </div>

      <div class="calc-card">
        <h3>Corporate Stock Ownership Prohibition</h3>
        <p style="color:var(--slate-700)">Corporations cannot own stock. Only human beings can own stock. A corporation is a legal fiction created by government charter. It can conduct business. It cannot accumulate ownership of other businesses. Three-year divestment period for existing corporate equity holdings. Investment vehicles managed for the direct benefit of individual human beneficiaries — pension funds, mutual funds — are exempt.</p>
      </div>

      <div class="calc-card">
        <h3>Student Loan Reform</h3>
        <p style="color:var(--slate-700)">Federal loan rates capped at 1%. Expanded income-based repayment. Structured relief for existing borrowers. The American Public University System (Chapter 40) replaces the predatory private institution model entirely — ending the need for student loans at all.</p>
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
        <h3>Housing Is Not a Business</h3>
        <p style="color:var(--slate-700)">Prisons aren't businesses. Hospitals aren't businesses. Schools aren't businesses. The moment we decided that the roof over an American family's head was an asset class to be traded we started losing. A home is a home. Not a portfolio.</p>
      </div>

      <div class="calc-card">
        <h3>Corporate Ownership — Banned</h3>
        <p style="color:var(--slate-700)">No corporation, hedge fund, REIT, or investment firm may own single-family residential properties. A corporation is not a person and does not need a home.</p>
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
        <p style="color:var(--slate-700)">Used homes are exempt from the National Sales Tax. No double taxation on secondhand property transactions. You buy a home that was previously owned — no NST. This encourages real transactions over speculation and protects working families from being taxed on the most common path to homeownership.</p>
      </div>

      <div class="calc-card">
        <h3>Mineral Rights Reform</h3>
        <p style="color:var(--slate-700)">The severance of mineral rights from surface rights — the mechanism by which a corporation may own what lies beneath land owned by another — ends. A family may own their land and a corporation arrives to drill beneath it, extract from it, damage it, and profit from it while the surface owner bears all the environmental risk.</p>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;margin-top:0.75rem;">
          <li>New severances of mineral rights from surface rights prohibited immediately</li>
          <li>Existing severances enter a mandatory ten-year resolution period</li>
          <li>Surface owners have the right to purchase mineral rights at fair market value</li>
          <li>At ten years, unresolved severances revert to surface owner ownership through compensated federal acquisition</li>
        </ul>
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
        <h3>The China Efficiency Gap</h3>
        <p style="color:var(--slate-700)">China is closing the military capability gap with America while spending approximately one-third as much. This is not because China is more efficient. It is because America extracts 30–40% of every defense dollar in contractor profit before it reaches an actual weapon. A reformed $550 billion military procurement system with competitive bidding and open book accounting buys equivalent or superior capability to the current $960 billion system.</p>
      </div>

      <div class="calc-card">
        <h3>Procurement Reform</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>End all cost-plus contracts — every contract is fixed-price, competitively bid</li>
          <li>Open book accounting mandatory — every contractor shows actual cost vs. billed amount</li>
          <li>Sole source monopolies eliminated — minimum two competing manufacturers for every major system</li>
          <li>Performance-based contracts — payment upon delivery of working capability, not upon billing</li>
          <li>AEGIS monitors every contract in real time — flags any invoice above documented cost plus defined margin</li>
          <li>Criminal liability for executives who knowingly overbill — profit plus 10% clawed back, personal prosecution</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Strategic Rebalancing</h3>
        <p style="color:var(--slate-700)">America's military mission under this platform is clear: <strong>nuclear deterrence, Pacific fleet capability, cyber warfare leadership, space-based intelligence, and rapid deployable special operations forces.</strong></p>
        <p style="color:var(--slate-700);margin-top:0.75rem;">America is not the world's policeman. Allies that have been free-riding on American protection for decades — particularly European NATO members who now collectively spend $454 billion — carry their own weight or American forward presence scales proportionally.</p>
      </div>

      <div class="calc-card">
        <h3>Ethics & Accountability</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Two-year ban on military officials entering contracting firms they oversaw</li>
          <li>All defense contractor lobbying recorded and published publicly</li>
          <li>Citizen Oversight Commission on Defense Procurement</li>
          <li>AEGIS real-time monitoring of all procurement contracts</li>
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
      <div class="calc-card">
        <h3>A Personal Note</h3>
        <p style="color:var(--slate-700)">I'm a felon. I was in prison at nineteen. I had a drug charge at twenty-seven. I know what the system looks like from the inside — and what it looks like from the inside has very little to do with justice. That's not a disqualification. That's a qualification.</p>
      </div>

      <div class="stats-row"><div class="stat-card"><div class="stat-value">2M</div><div class="stat-label">People Behind Bars</div></div><div class="stat-card"><div class="stat-value">$80B</div><div class="stat-label">Annual Prison Spending</div></div><div class="stat-card"><div class="stat-value">60%</div><div class="stat-label">Non-Violent Offenders</div></div><div class="stat-card"><div class="stat-value">5%/25%</div><div class="stat-label">World Population / World Prisoners</div></div></div>

      <div class="calc-card">
        <h3>End Private Prisons Entirely</h3>
        <p style="color:var(--slate-700)">Private prisons are banned. Prison is not a profit center. Every incarcerated person is housed in a public facility accountable to public oversight.</p>
      </div>

      <div class="calc-card">
        <h3>End Qualified Immunity</h3>
        <p style="color:var(--slate-700)">Officers can be sued personally for civil rights violations. The Supreme Court invented qualified immunity in 1967. It is not in the Constitution. It is not in any statute. Nine justices created it. We end it.</p>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Mandatory body cameras — always on, footage preserved, tampering is a serious crime, footage stored on independent server</li>
          <li>Misconduct registry — follows officers across all departments and states permanently</li>
          <li>Department liability — cities and departments face consequences for patterns of misconduct</li>
          <li>Personal liability insurance — officers carry coverage like doctors carry malpractice insurance</li>
          <li>Chain of command accountability — chiefs and cities liable for officer conduct</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Prison Labor Reform — Community Use Only</h3>
        <p style="color:var(--slate-700)">Voluntary participation, community use only, real wages deposited into a personal reentry fund, vocational credentials built during service. <strong>Not one dollar of prison labor goes to a private corporation. Ever.</strong></p>
      </div>

      <div class="calc-card">
        <h3>Drug Policy — Health Not Crime</h3>
        <p style="color:var(--slate-700)">Drug possession for personal use is decriminalized. Users are not criminals. They are people who need help. The $50 billion annually spent on drug prosecution redirects entirely to treatment infrastructure. See the Drug Policy page for the complete framework.</p>
      </div>

      <div class="calc-card">
        <h3>Corporate Criminal Accountability</h3>
        <p style="color:var(--slate-700)">The same accountability standards that apply to street crime apply to corporate crime. A CEO who knowingly designed a system to extract money from vulnerable people through fraud faces personal criminal prosecution — not a fine negotiated by lawyers. The profit plus 10% penalty applies universally. Nobody hides behind a corporate structure.</p>
      </div>

      <div class="calc-card"><h3>Statutes of Limitations — Eliminated</h3><p style="color:var(--slate-700)">Statutes of limitations are eliminated for <strong>all crimes</strong>. Every crime. No exceptions.</p><p style="color:var(--slate-700);margin-top:0.75rem;">Created in an era when evidence degraded — witnesses died, documents faded. That era is over. AEGIS monitors every transaction in real time. Digital records are permanent. Evidence doesn't degrade — it accumulates.</p><p style="color:var(--slate-700);margin-top:0.75rem;">If you committed fraud in 1987 and we can prove it today — you answer for it today. If a doctor's negligence caused harm discovered a decade later — the victim has the same right to accountability.</p><p style="color:var(--slate-700);margin-top:0.75rem;font-style:italic;">"The clock doesn't run out. Justice doesn't have an expiration date. If you did it and we can prove it — you answer for it. Period."</p></div>
    `
  });
}

function pageImmigration(main) {
  policyPage(main, {
    title: 'The Welcome America Immigration System', subtitle: '"Name one job an immigrant took that affected you personally."', icon: '🗽',
    impactId: 'imm-impact', impactFn: () => ({ level: 'affects', message: 'Immigration adds $8.9T to GDP over the next decade and $1.2T in federal tax revenue. Immigrants pay $383B in federal taxes and $196B in state/local taxes annually.' }),
    content: `
      <div class="calc-card">
        <h3>The Foundation</h3>
        <p style="color:var(--slate-700)">America is a nation of immigrants. Anyone trying to make a better life for themselves and their family is welcome. The question is not whether to welcome people — it is how to do it fairly, transparently, and sustainably.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;">The data is clear: immigration is not an invasion. Over 35% of people encountered at the border in recent years were families with children — overwhelmingly from Central and South American countries fleeing poverty, gang violence, political persecution, and economic collapse.</p>
      </div>

      <div class="calc-card">
        <h3>The Economic Case</h3>
        <div class="stats-row">
          <div class="stat-card"><div class="stat-value">$8.9T</div><div class="stat-label">GDP Boost Over Next Decade (CBO)</div></div>
          <div class="stat-card"><div class="stat-value">$1.2T</div><div class="stat-label">Added Federal Tax Revenue</div></div>
          <div class="stat-card"><div class="stat-value">$383B</div><div class="stat-label">Federal Taxes Paid Annually</div></div>
          <div class="stat-card"><div class="stat-value">46%</div><div class="stat-label">Fortune 500 Founded by Immigrants</div></div>
        </div>
        <p style="font-size:0.875rem;color:var(--slate-600);margin-top:0.75rem;">Deportation of undocumented immigrants would reduce US real GDP by as much as 7% by 2028. Immigrants produced 23% of all patents despite comprising 16% of the inventor workforce.</p>
      </div>

      <div class="calc-card">
        <h3>Immediate Moratorium on Non-Violent Deportations</h3>
        <p style="color:var(--slate-700)">Immediate moratorium on deportations for anyone who has been in the country more than two years with no violent criminal record. They stay. They receive a work permit immediately. They begin a five-year path to permanent residency. After permanent residency, five more years to citizenship if they choose it.</p>
      </div>

      <div class="calc-card">
        <h3>Ten-Year Resident Citizenship Path</h3>
        <p style="color:var(--slate-700)">Anyone who has been in this country continuously for ten or more years with no violent criminal record receives an immediate and permanent path to citizenship. You grew up here. This is your country. The paperwork your parents didn't file when you were eight years old does not define your American identity.</p>
      </div>

      <div class="calc-card">
        <h3>The Annual Capacity Assessment</h3>
        <p style="color:var(--slate-700)">No fixed annual immigration number. Every year the federal government publishes a transparent public assessment through OpenLedger covering five factors:</p>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li><strong>Economic capacity</strong> — current labor market gaps by industry and region</li>
          <li><strong>Housing capacity</strong> — available housing units nationally and regionally</li>
          <li><strong>Infrastructure capacity</strong> — schools, hospitals, roads, public services</li>
          <li><strong>Humanitarian obligation</strong> — global crisis situations creating moral obligation</li>
          <li><strong>Fiscal capacity</strong> — what the transitional support program can actually fund</li>
        </ul>
        <p style="color:var(--slate-700);margin-top:0.75rem;">Congress votes on the resulting annual number. Citizens can see exactly how it was calculated. No politics. No ideology. Just math and humanity.</p>
      </div>

      <div class="calc-card">
        <h3>The Lottery System</h3>
        <p style="color:var(--slate-700)">Applications enter a national lottery. Every person gets one entry. Every dependent family member adds one entry to that family's application — a family of four has four entries, giving larger families proportionally better odds which reflects humanitarian reality. The lottery is run publicly and transparently. No backroom decisions. No preference for wealthy applicants. No preference based on country of origin. Pure fairness.</p>
      </div>

      <div class="calc-card">
        <h3>Immediate Work Authorization & Transitional Support</h3>
        <p style="color:var(--slate-700)">Every person who enters through the legal lottery pathway receives <strong>immediate work authorization on Day 1</strong>. Not after months of processing. Day one. They can work, earn, and support themselves from the moment they arrive.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>60 days of transitional support</strong> — basic shelter, basic food, connection to employers with open positions. After 60 days they are working, paying taxes, and self-sufficient. The construction industry alone faces a shortage of 500,000 workers. There are jobs waiting.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>Regional distribution</strong> connects people to regions where they are actually needed. Rural Midwestern counties with declining population, empty houses, labor shortages, and good schools have enormous capacity.</p>
      </div>

      <div class="calc-card">
        <h3>AI-Assisted Asylum System</h3>
        <p style="color:var(--slate-700)">The current 1.5 million case backlog exists because there are not enough decision-makers. The answer is not more judges — it is a faster system.</p>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Same-day intake interview with trained officers</li>
          <li>AI translation in real time across any language</li>
          <li>Cross-referencing claims against continuously updated global country conditions database</li>
          <li>Decision within 30 days, one appeal with 30-day review window</li>
          <li>Total maximum timeline: <strong>120 days</strong> from presentation to final decision</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Violent Criminals & Benefit Eligibility</h3>
        <p style="color:var(--slate-700)"><strong>Violent criminals:</strong> You commit a violent crime in America — you go to jail. Same as any American. You serve your time. After serving your sentence — deportation to country of origin.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>Five-year benefit eligibility:</strong> Full benefit eligibility after five years of documented work and tax contribution. You pay in before you draw out — the same deal every working American has.</p>
      </div>
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
      <div class="calc-card">
        <h3>Public Service Financial Integrity Act</h3>
        <p style="color:var(--slate-700)">The single most corrupting force in American government is not bribery — it is the legal, normalized practice of officials using their access to non-public policy information to enrich themselves through financial markets.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>The No-Trading Rule:</strong> Any person holding federal elected office, any appointed official, any senior executive branch employee, and any member of their immediate household is prohibited from purchasing or selling individual stocks, bonds, options, or derivatives for the duration of their service and for <strong>two years after</strong>.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>What is permitted:</strong> Widely diversified index funds in a blind trust. Government bonds. Real property. You may participate in the broad success of the American economy. You may not trade on your knowledge of what the government is about to do.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;">All financial holdings disclosed in real time through OpenLedger. AEGIS cross-references financial disclosure against market data. Violations are referred for <strong>criminal prosecution</strong> — not an ethics committee referral.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;font-style:italic;">"You want to serve the American people? Prove it. Put your portfolio in a blind trust, step away from the trading terminal, and govern."</p>
      </div>

      <div class="calc-card"><h3>Accountability</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Criminal liability for knowing violations</li><li>Strengthened independent ethics commission with real consequences</li><li>Term limits: Senate 2 terms (12 yrs), House 4 terms (8 yrs)</li></ul></div>
      <div class="calc-card"><h3>Fair Elections</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Ranked-choice voting nationwide</li><li>Election Day as national holiday</li><li>Nonpartisan redistricting commissions</li><li>Enhanced cybersecurity for election infrastructure</li></ul></div>

      <div class="calc-card">
        <h3>Transparency & Open Government</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>All government meetings involving public money or policy decisions recorded and published</li>
          <li>All bills written in plain language and made public 30 days before voting</li>
          <li>OpenLedger — every government contract and expenditure publicly searchable in real time</li>
          <li>Body cameras on all government officials in official capacity</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>The Return to Civilian Life Provision</h3>
        <p style="color:var(--slate-700)">Any former member of Congress must return to their home state and establish primary residence there within 90 days of leaving office. You make the laws. You go home and live under the laws. That is not a burden — that is the point.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;font-style:italic;">"The moment a politician knows they're going home to live under their own laws — they start writing better laws."</p>
      </div>

      <div class="calc-card">
        <h3>Reducing Redundant Agencies</h3>
        <p style="color:var(--slate-700)">The federal government has accumulated agencies the way old houses accumulate furniture — one piece at a time until nobody remembers why half of it is there. We're clearing the house.</p>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Presidential Reorganization Office established in Year 1</li>
          <li>Top-to-bottom audit of every federal agency within 18 months</li>
          <li>47 separate job training programs across 9 agencies → consolidated</li>
          <li>Food safety split between USDA and FDA → unified</li>
          <li>Housing assistance fragmented across HUD, USDA, Treasury → unified</li>
          <li>Independent annual audits for all agencies above $1B budget</li>
          <li>Savings: <strong>$100 billion annually</strong></li>
        </ul>
        <p style="color:var(--slate-700);margin-top:0.75rem;">This is not about gutting services. People who need food assistance, housing support, job training, and emergency help will still receive those things — from a system that actually works. We're cutting overhead. We're not cutting people.</p>
      </div>
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
      <div class="calc-card">
        <h3>CivicSignal Connection</h3>
        <p style="color:var(--slate-700)">Citizens report infrastructure problems directly through CivicSignal — the national citizen reporting platform. Every pothole, every broken streetlight, every dangerous intersection, GPS-tagged and publicly visible. Government agencies receive direct notification. Small local contractors get first priority on jobs under $500,000. The system connects citizen-identified problems to local solutions without political gatekeeping.</p>
      </div>

      <div class="calc-card">
        <h3>Energy Independence</h3>
        <p style="color:var(--slate-700)">Energy independence is national security. Dependence on foreign oil is dependence on governments that do not share our values. Massive investment in renewable energy alongside existing sources. Grid modernization. Domestic battery and semiconductor manufacturing. Energy efficiency standards that reduce consumption without mandating lifestyle changes.</p>
      </div>

      <div class="calc-card">
        <h3>Water Safety & Broadband</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li><strong>$200 billion</strong> to replace all lead-contaminated pipes nationwide</li>
          <li><strong>$150 billion</strong> to deliver high-speed fiber-optic broadband to 100% of American homes</li>
        </ul>
      </div>
    `
  });
}

function pageBusiness(main) {
  policyPage(main, {
    title: 'Small Business & Entrepreneurship', subtitle: '99.9% of businesses are small businesses. Built one from nothing.', icon: '🏪',
    impactId: 'biz-impact', impactFn: () => ({ level: 'affects', message: 'Zero-interest microloans up to $50K, simplified regulations for businesses under 20 employees, first priority on government contracts under $500K.' }),
    content: `
      <div class="calc-card">
        <h3>I Built One From Nothing</h3>
        <p style="color:var(--slate-700)">99.9% of all businesses in America are small businesses. I built one from nothing. No degree, no investors, no roadmap. Self-taught. Bootstrapped. I know exactly what the system does to small business owners — and what it could do for them if it actually worked.</p>
      </div>

      <div class="calc-card">
        <h3>Capital Access Reform</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li><strong>National Community Lending Program:</strong> zero-interest microloans up to $50,000, low-interest loans up to $500,000</li>
          <li>Public Business Development Banks modeled after North Dakota</li>
          <li>Venture Capital Parity: federal matching funds for community-focused VC</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Cut Red Tape</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li><strong>One-Stop National Business Startup Portal:</strong> unified licensing and compliance</li>
          <li><strong>Regulatory Safe Harbor:</strong> simplified reporting for businesses under 20 employees</li>
          <li><strong>Sunset Review:</strong> automatic 10-year reviews of federal business regulations</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Break Corporate Monopolies</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Strengthen antitrust enforcement</li>
          <li>Ban vertical integration across supply chains</li>
          <li>Competitive bidding mandates for federal procurement — small contractors get first priority on government jobs under $500,000</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Tax Code Reform</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Lower effective tax rates for businesses under $10M revenue</li>
          <li>Ban offshore profit shifting for large corporations</li>
          <li>Enhanced depreciation and reinvestment credits for small businesses</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Licensing Reform</h3>
        <p style="color:var(--slate-700)">Government licensing exists for one purpose — demonstrable public safety. Where licensing meets that standard it is retained and made equitable: fees at actual cost only, national reciprocity so a license in one state is valid in all fifty, renewal only where genuinely needed.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;">Where licensing does not meet the public safety standard it is eliminated. Interior decorators, hair braiders, tour guides, florists — these requirements protect incumbent businesses from competition, not the public from harm.</p>
      </div>
    `
  });
}

function pageAgriculture(main) {
  policyPage(main, {
    title: 'Agricultural Reform & Food System Overhaul', subtitle: 'The cheapest food in America is the worst food. We fix that.', icon: '🌾',
    impactId: 'ag-impact', impactFn: p => ({ level: 'affects', message: 'Agricultural reform saves every household $100–200/month on groceries by redirecting subsidies to fresh produce and breaking up the top 4 processors controlling 80%+ of beef.' }),
    content: `
      <div class="calc-card">
        <h3>A Food System Built for Profit, Not People</h3>
        <p style="color:var(--slate-700)">The cheapest food in America is the worst food in America. And we wonder why we're sick. The top 4 beef processors control over 80% of the market. Federal subsidies overwhelmingly fund corn, soy, and wheat — the raw ingredients of junk food. The U.S. allows hundreds of pesticides and herbicides banned in Europe.</p>
      </div>

      <div class="calc-card">
        <h3>Redirect Agricultural Subsidies</h3>
        <p style="color:var(--slate-700)">End commodity crop subsidies. Redirect to fresh produce, fruits, vegetables, and sustainable family farming. Transition support for farmers moving to natural farming — nobody gets left behind.</p>
      </div>

      <div class="calc-card">
        <h3>Break Up Corporate Agricultural Monopolies</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>No single corporation controls more than 25% of any agricultural market</li>
          <li>Ban corporate ownership of farmland beyond operational needs</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Eliminate Harmful Chemicals</h3>
        <p style="color:var(--slate-700)">Ban all pesticides and herbicides currently banned in the European Union. Phase out glyphosate, atrazine, and chlorpyrifos on a clear timeline. Corporate farms get a deadline — no extensions, no lobbying exemptions.</p>
      </div>

      <div class="calc-card">
        <h3>Real Organic Certification</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Zero synthetic pesticides. Zero synthetic fertilizers. Zero GMO inputs. No exceptions.</li>
          <li>Third-party independent verification</li>
          <li>Criminal penalties for fraudulent organic labeling</li>
          <li>QR code farm-to-shelf tracking</li>
        </ul>
        <p style="color:var(--slate-700);margin-top:0.75rem;font-style:italic;">"Organic should mean something. Right now it's a sticker you buy. Under this administration it will mean what your grandmother thought it meant."</p>
      </div>

      <div class="calc-card">
        <h3>Phase Out Factory Farming</h3>
        <p style="color:var(--slate-700)">National animal welfare standards — every animal deserves space, light, and a life worth living. Ten-year phase-out of the most inhumane practices. Full transparency labeling on every animal product.</p>
      </div>
    `
  });
}

function pageChildren(main) {
  policyPage(main, {
    title: 'Child Protection & Missing Children Prevention', subtitle: 'No child ages out of foster care into nothing.', icon: '🧒',
    impactId: 'child-impact', impactFn: () => ({ level: 'affects', message: 'Child protection reform creates federal rapid response for missing children, keeps siblings together in foster care, and connects aging-out youth directly to community infrastructure.' }),
    content: `
      <div class="calc-card">
        <h3>A Personal Note</h3>
        <p style="color:var(--slate-700)">My sister was molested by a family member. I was eight years old when we were taken into foster care. I know what it means for the system to intervene in a child's life — and I know what it means when it doesn't intervene soon enough. I also know what happens when kids age out of that system. Under my administration, no child ages out of foster care into nothing.</p>
      </div>

      <div class="calc-card">
        <h3>National Missing Children Command Center</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Federal command center with full-time investigators, analysts, and AI-powered search tools</li>
          <li>Fully integrated federal, state, and local law enforcement databases</li>
          <li>Nationalized rapid deployment team for any jurisdiction immediately upon a missing child report</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Amber Alert 2.0</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>AI-powered license plate recognition scans</li>
          <li>National highway, airport, bus terminal, and port coordination</li>
          <li>Instant cell phone alerts that cross state lines</li>
          <li>Automatic federal notification when a child crosses state lines</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Federal Child Welfare Oversight Board</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Audit state CPS agencies for performance, case backlog, and child outcomes</li>
          <li>National standards for foster care safety, reporting, and licensing</li>
          <li>Public transparency dashboards tracking child welfare agency performance</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Keeping Siblings Together — Always</h3>
        <p style="color:var(--slate-700)">My sister and I went into foster care together. That mattered. The system often separates siblings. We keep them together — always. Siblings are each other's only family in a system that has removed them from everything else.</p>
      </div>

      <div class="calc-card">
        <h3>Aging Out — The Pipeline to Community</h3>
        <p style="color:var(--slate-700)">Every child who ages out of foster care at 18 enters the community infrastructure pipeline. Not a shelter — a community. Job training. Mentorship from people who've been where they are. A path to ownership as they stabilize. Fully funded enrollment in the American Public University System — degree or vocational certification — with no age cap.</p>
      </div>
    `
  });
}

function pageTechnology(main) {
  policyPage(main, {
    title: 'Technology, AI & Space Leadership', subtitle: 'The 21st century battlefield is a semiconductor. China has $1.4T invested. We have a committee.', icon: '🤖',
    impactId: 'tech-impact', impactFn: () => ({ level: 'affects', message: '$500B AI fund, $250B domestic chip manufacturing, $200B cybersecurity shield, $100B NASA investment. The country that leads in AI sets the rules for everything else.' }),
    content: `
      <div class="calc-card">
        <h3>The Race We Cannot Lose</h3>
        <p style="color:var(--slate-700)">The 21st century battlefield is not a field. It's a semiconductor. It's an algorithm. It's a satellite. The country that leads in artificial intelligence, quantum computing, and space will set the rules for everything else. China has a $1.4 trillion AI and technology investment fund. We have a committee.</p>
      </div>

      <div class="stats-row"><div class="stat-card"><div class="stat-value">$500B</div><div class="stat-label">AI R&D Fund</div></div><div class="stat-card"><div class="stat-value">$250B</div><div class="stat-label">Chip Manufacturing</div></div><div class="stat-card"><div class="stat-value">$200B</div><div class="stat-label">Cybersecurity Shield</div></div><div class="stat-card"><div class="stat-value">$100B</div><div class="stat-label">NASA & Space</div></div></div>

      <div class="calc-card">
        <h3>National AI Leadership & Workforce Transition</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li><strong>$500 billion AI R&D Investment Fund</strong> — the largest single investment in AI in world history</li>
          <li>National AI Workforce Initiative for worker retraining — preparing Americans for the jobs AI creates, not just the ones it displaces</li>
          <li>AI Ethics & Accountability Standards — ensuring AI serves people, not the other way around</li>
          <li>National Algorithmic Transparency Law — if an algorithm makes decisions about your life, you have the right to know how</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Semiconductor Sovereignty</h3>
        <p style="color:var(--slate-700)"><strong>$250 billion Domestic Chip Manufacturing Fund.</strong> America cannot remain dependent on Taiwan for 90% of the world's most advanced semiconductors — one geopolitical crisis away from catastrophic supply chain failure.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>Rare Earth & Mineral Security Act</strong> — secure domestic supply chains for the materials that power every advanced technology.</p>
      </div>

      <div class="calc-card">
        <h3>Cybersecurity & Space</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li><strong>$200 billion National Cybersecurity Shield</strong> — protect U.S. networks and critical infrastructure</li>
          <li>Digital Infrastructure Sovereignty to secure U.S. networks from foreign interference</li>
          <li><strong>$100 billion NASA & Space Industry Investment</strong></li>
          <li>National Space Resources Sovereignty Act</li>
          <li>Space Defense Command</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>AEGIS as National Security Infrastructure</h3>
        <p style="color:var(--slate-700)">The same AI-powered monitoring system that tracks government financial transactions serves as early warning infrastructure for economic threats. AEGIS cross-references all financial flows for foreign interference patterns, monitors critical infrastructure contract awards for suspicious connections, and flags supply chain vulnerabilities in real time. National security and fiscal accountability are the same infrastructure.</p>
      </div>
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
      <div class="calc-card"><h3>Strategic Rivalry with China</h3><ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;"><li>Ban Chinese ownership of critical U.S. infrastructure, technology, and media outlets</li><li>Maintain full technological export controls on semiconductors, AI, and quantum technologies</li><li>Counter Belt and Road debt diplomacy with allied development financing alternatives</li><li>Build new global supply chains outside authoritarian-controlled regions</li><li>Concentrated Indo-Pacific military capability rather than dispersed global presence</li></ul></div>

      <div class="calc-card">
        <h3>Global Anti-Corruption & Humanitarian Leadership</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Global Anti-Corruption Initiative targeting offshore tax havens and transnational bribery</li>
          <li>Sanction foreign oligarchs who exploit global loopholes</li>
          <li>Rebuild America's global health leadership through pandemic preparedness</li>
          <li>Strengthen international refugee systems with improved vetting and accountability</li>
        </ul>
      </div>
    `
  });
}

function pageEnvironment(main) {
  policyPage(main, {
    title: 'Climate & Environment', subtitle: 'You don\'t need a climate debate to know you shouldn\'t poison the water people drink.', icon: '🌿',
    impactId: 'env-impact', impactFn: () => ({ level: 'affects', message: 'Clean energy is economic and national security policy. Corporate emission accountability through AEGIS. No personal mandates — no gas stove bans, no vehicle mandates.' }),
    content: `
      <div class="calc-card">
        <h3>The Philosophy</h3>
        <p style="color:var(--slate-700)">You don't need a debate about climate science to know you shouldn't poison the water people drink or the air people breathe. Clean energy is economic policy and national security policy. Every dollar spent on foreign energy is a dollar sent to governments that don't share our values. Every clean energy job is an American job.</p>
      </div>

      <div class="calc-card">
        <h3>Corporate Emission Accountability Through AEGIS</h3>
        <p style="color:var(--slate-700)">A carbon fee applies to corporations above a defined emission threshold — collected through AEGIS automatically. No lobbying exemptions. No offset games. No self-reporting. AEGIS monitors emissions data, cross-references reported figures against energy consumption and production data, flags discrepancies in real time.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>Environmental violations are crimes</strong> — executives go to jail, not just companies paying fines they write off. Profit plus 10% clawed back on all proceeds from pollution-generating activities.</p>
      </div>

      <div class="calc-card">
        <h3>Clean Energy Infrastructure</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Federal buildings converted to renewable energy within 10 years through reformed contracting — competitive bidding, no cost-plus, small contractors first</li>
          <li>New federal construction: zero emission standard mandatory</li>
          <li>Electric grid modernization treated as national security infrastructure</li>
          <li>70% renewable electricity by 2035</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Nuclear Power — Back on the Table</h3>
        <p style="color:var(--slate-700)">Modern small modular reactors, not 1970s technology. Nuclear provides reliable baseload power that solar and wind cannot provide alone. A serious clean energy policy that excludes nuclear is not serious.</p>
      </div>

      <div class="calc-card">
        <h3>No Personal Mandates</h3>
        <p style="color:var(--slate-700)">The government does not tell people how to live in their homes. No bans on gas stoves. No mandated vehicle choices. No lifestyle mandates of any kind. The government regulates corporations that pollute and incentivizes clean energy through market mechanisms. Individual Americans make their own choices.</p>
      </div>

      <div class="calc-card">
        <h3>Strict Recycling</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>National recycling standards — mandatory, not voluntary</li>
          <li>Corporate responsibility for packaging waste</li>
          <li>Investment in recycling infrastructure so the system actually works</li>
          <li>Ban single-use plastics that have no recycling pathway</li>
        </ul>
      </div>
    `
  });
}

function pageCommunity(main) {
  policyPage(main, {
    title: 'Community Infrastructure Investment', subtitle: '"We\'re building cities within cities. Owned by the people who live there."', icon: '🏘️',
    impactId: 'comm-impact', impactFn: () => ({ level: 'affects', message: 'Community investment builds city blocks owned by residents — manufacturing co-ops, affordable condos, storefronts, daycare, healthcare clinics. No outside investors. No corporate landlords.' }),
    content: `
      <div class="calc-card">
        <h3>The Original Idea</h3>
        <p style="color:var(--slate-700)">I looked at what disenfranchised communities were missing and designed what filling that gap would actually look like. Not a check. Not a program. A place. The government funds football stadiums so billionaires can own them. I'm using the same mechanism — but this time the people who live there own it.</p>
      </div>

      <div class="calc-card">
        <h3>The Block</h3>
        <p style="color:var(--slate-700)">A city block. Purchased, developed, and owned as a community asset. Square building wrapping the perimeter:</p>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Manufacturing cooperative at the base — worker-owned, profits distributed to worker owners</li>
          <li>Residential condos above — purchased through affordable entry programs and sweat equity</li>
          <li>Storefronts at street level — owned or leased by residents at below-market rates</li>
          <li>Daycare inside the building</li>
          <li>Healthcare clinic on site</li>
          <li>Park in the middle</li>
        </ul>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>No outside investors. No corporate landlords. No flipping. Ever.</strong></p>
      </div>

      <div class="calc-card">
        <h3>The Ownership Ladder</h3>
        <ol style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li><strong>Step 1 — The Blocks:</strong> Arrive with nothing, stabilize, build first equity through sweat equity and affordable entry programs.</li>
          <li><strong>Step 2 — The Surrounding Neighborhood:</strong> Move outward into rehabilitated houses. Sell your block condo at a modest profit for your down payment.</li>
          <li><strong>Step 3 — Generational Wealth:</strong> Your house appreciates as the neighborhood improves. The cycle breaks completely.</li>
        </ol>
      </div>

      <div class="calc-card">
        <h3>Reparations — Infrastructure Over Checks</h3>
        <p style="color:var(--slate-700)">This is the most honest and effective form of reparations this country has ever proposed — targeted investment in the communities that were deliberately stripped of wealth for generations. Not a payment for the past. An investment in the future.</p>
      </div>
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
      <div class="calc-card">
        <h3>My Position</h3>
        <p style="color:var(--slate-700)">I personally hate guns. I believe they exist to kill. I also understand that it is not my place to impose that belief on 330 million Americans.</p>
      </div>

      <div class="calc-card">
        <h3>The Real Problem</h3>
        <p style="color:var(--slate-700)">Mass shooters feel invisible. Disconnected. The gun is the last chapter. The disconnect is the whole book.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;font-style:italic;">"We've been arguing about the weapon for thirty years while ignoring the wound. I'm done with that argument. We're treating the wound."</p>
      </div>

      <div class="calc-card">
        <h3>What Actually Reduces Violence</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>A society that doesn't stay quiet about bullying</li>
          <li>Communities where people feel they belong — Montessori education builds this from day one</li>
          <li>Mental health care that is accessible, affordable, and destigmatized</li>
          <li>Economic security — desperation and hopelessness are violence risk factors</li>
          <li>Montessori-informed education that sees every child as capable</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>The Policy Framework</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Universal background checks — no exceptions, no loopholes</li>
          <li>Red flag laws with full due process</li>
          <li>Mandatory gun safety education in schools throughout all grade levels — knowing the truth about something makes you safer around it</li>
          <li>Responsible ownership protected — no confiscation, no blanket bans</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>A Note on My Own Status</h3>
        <p style="color:var(--slate-700)">I am a felon. I am federally prohibited from owning a firearm. I write this from the position of someone who has been on the wrong side of the system and understands what it actually does to people.</p>
      </div>
    `
  });
}

function pageReproductive(main) {
  policyPage(main, {
    title: 'Reproductive Rights', subtitle: '"I\'m pro-life. All of it. Before the birth and after it."', icon: '🤰',
    impactId: 'repro-impact', impactFn: () => ({ level: 'affects', message: 'The full platform IS the pro-life position: universal healthcare, pre-K, community infrastructure, affordable food, senior UBI. Pro-life from conception through old age.' }),
    content: `
      <div class="calc-card">
        <h3>My Position</h3>
        <p style="color:var(--slate-700)">I believe life begins at conception. That is my genuine belief — not a political position adopted to win votes. If someone punches a pregnant woman and kills the baby we charge them with murder. We cannot say it is a life in that moment and not a life in every other moment. That inconsistency is not logic — it is politics.</p>
      </div>

      <div class="calc-card">
        <h3>The Hypocrisies — Both Sides</h3>
        <p style="color:var(--slate-700)"><strong>The left</strong> says "my body my choice" — but calls it a double homicide when someone kills a pregnant woman. You cannot have it both ways.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>The right</strong> says they are pro-life. But the moment that baby is born they cut every program that would actually keep it alive. No universal healthcare. No childcare support. No housing assistance. No food security. They fight for the birth and abandon the child.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;font-style:italic;">"I'm pro-life. All of it. Before the birth and after it. If you're only pro-life until the cord is cut you're not pro-life — you're pro-birth. Those aren't the same thing."</p>
      </div>

      <div class="calc-card">
        <h3>Extenuating Circumstances</h3>
        <p style="color:var(--slate-700)">Rape. Incest — which is still rape. A pregnancy that will kill the mother. In these circumstances the choice belongs to the woman. Not the government. Not a committee. The woman.</p>
      </div>

      <div class="calc-card">
        <h3>The Full Platform as the Real Pro-Life Position</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Universal healthcare</li>
          <li>Universal pre-K</li>
          <li>Community infrastructure for aging-out foster kids</li>
          <li>Affordable healthy food through agricultural reform</li>
          <li>Senior UBI — dignity through old age</li>
          <li>Every other chapter in this handbook is part of this one</li>
        </ul>
        <p style="color:var(--slate-700);margin-top:0.75rem;">That is pro-life from conception through old age.</p>
      </div>
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
      <div class="calc-card">
        <h3>The Problem</h3>
        <p style="color:var(--slate-700)">The Federal Reserve was designed in 1913 by bankers, for bankers, in a secret meeting on Jekyll Island in Georgia. That is not conspiracy theory — that is documented history. A group of the most powerful bankers in America met in secret, drafted the Federal Reserve Act, and handed it to Congress to pass.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;">The circular interest payment relationship: the government pays the Fed interest on Treasury bonds the Fed holds. The Fed covers its operating costs and returns most of the remainder to the Treasury — but not all of it, not reliably, and not with any predictability. In 2022 and 2023 the Fed stopped remitting anything because rising interest rates created accounting losses. The government paid interest and got nothing back. That relationship ends.</p>
      </div>

      <div class="calc-card"><h3>Mandatory Full Remittance</h3><p style="color:var(--slate-700)">All profits generated by the AMA from Treasury security holdings are remitted to the Treasury automatically and in full. No discretionary retention. No withholding in years of accounting losses. The formula is published. The transfer is automatic. The public can verify it through OpenLedger.</p></div>

      <div class="calc-card">
        <h3>Crisis Prevention Through AEGIS</h3>
        <p style="color:var(--slate-700)">The best emergency power is the one you never have to use. The 2008 crisis didn't appear overnight. The toxic assets were building for years. AEGIS would have flagged the pattern in 2005 or 2006 — giving years of warning before the collapse. The AMA has time to act deliberately: raise capital requirements, restrict dangerous instruments, require divestment of concentrated positions. No emergency powers needed because AEGIS eliminates the surprises that require emergency response.</p>
      </div>

      <div class="calc-card">
        <h3>Predatory Lending — The 15% Cap Connection</h3>
        <p style="color:var(--slate-700)">The AMA administers the 15% national consumer lending cap. Every consumer lending product — credit cards, personal loans, auto loans — is capped at 15% total cost of credit calculated as APR including all fees. The AMA monitors compliance through AEGIS, which cross-references all consumer lending rates against the cap in real time. Any lender exceeding the cap gets flagged and referred to the Corporate Accountability Division.</p>
      </div>
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
      <div class="calc-card">
        <h3>The Truth About Poverty</h3>
        <p style="color:var(--slate-700)">Poverty in America is not a moral failure of individuals. It is a failure of systems, policies, and priorities. Over 38 million Americans live below the poverty line. Nearly 60% of Americans live paycheck to paycheck. We don't need to shame poor people. We need to fix the systems that keep them poor.</p>
      </div>

      <div class="calc-card">
        <h3>The Minimum Wage Under This Platform</h3>
        <p style="color:var(--slate-700)">$15 per hour federal minimum wage. Mandatory cost-of-living adjustments every two years tied to local indexes. No state may fall below the federal floor.</p>
        <table class="data-table" style="margin-top:1rem;">
          <thead><tr><th>$15/hr</th><th>Current System</th><th>Under This Platform</th></tr></thead>
          <tbody>
            <tr><td>Gross Monthly</td><td>$2,600</td><td>$2,600</td></tr>
            <tr><td>Federal Income Tax</td><td>-$260</td><td class="text-success"><strong>$0 — eliminated</strong></td></tr>
            <tr><td>Payroll Tax</td><td>-$199</td><td class="text-success"><strong>$0 — eliminated</strong></td></tr>
            <tr><td>Healthcare Premiums</td><td>-$400</td><td class="text-success"><strong>$0 — universal coverage</strong></td></tr>
            <tr style="background:var(--success-bg)"><td><strong>Take Home</strong></td><td>~$1,741/mo</td><td><strong>~$2,600/mo</strong></td></tr>
          </tbody>
        </table>
        <p style="font-size:0.875rem;color:var(--slate-600);margin-top:0.75rem;">That's <strong>$859 more per month</strong> in real purchasing power without raising the wage a single dollar. Add agricultural reform saving $100–200/month on groceries, housing reform stabilizing rents, and prescription drugs at negotiated prices. The real value of $15/hour under this platform is closer to $19–20/hour under the current system.</p>
        <p style="font-size:0.875rem;color:var(--slate-600);margin-top:0.5rem;font-style:italic;">"Politicians argue about the minimum wage number. I'm showing you the math. $15 an hour under this platform puts more money in your pocket than $20 an hour does today."</p>
      </div>

      <div class="calc-card">
        <h3>Guaranteed Work Should Equal Guaranteed Stability</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>National Living Wage Standard tied to local cost-of-living indexes, adjusting every two years</li>
          <li>Affordable Childcare Guarantee: cap childcare costs at <strong>7% of income</strong></li>
          <li>National Paid Family Leave: <strong>12 weeks</strong> paid leave for all workers</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Affordable Housing & Homeownership</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Massive Workforce Housing Investment via public-private partnerships</li>
          <li>Down Payment Assistance Programs for first-time buyers</li>
          <li>Corporate housing ban freeing millions of homes for actual families</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>End Predatory Financial Practices</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>National cap on consumer interest rates at <strong>15% APR</strong> — total cost of credit including all fees</li>
          <li>Payday loans — eliminated entirely (business model requires 300%+ to survive)</li>
          <li>Auto lending reform banning abusive dealer practices</li>
          <li>Medical billing transparency — all-in pricing, no surprise bills</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Build Wealth for Working Families</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Universal Retirement Accounts for all workers with federal matching</li>
          <li>Employee Ownership Incentives to promote ESOPs and cooperatives</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>End the Poverty Penalty in the Legal System</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Ban cash bail for nonviolent offenses</li>
          <li>Cap court fees and eliminate poverty-based license suspensions</li>
          <li>Fully fund public defender systems</li>
        </ul>
      </div>
    `
  });
}

function pageDemocracy(main) {
  policyPage(main, {
    title: 'Democracy Reform', subtitle: '"You should be making decisions for future generations while you still have skin in the game."', icon: '🗳️',
    impactId: 'dem-impact', impactFn: () => ({ level: 'affects', message: 'Democracy reform: term limits for all, age fitness assessments, proportional Electoral College, ranked-choice voting, blind application system, Supreme Court 18-year terms.' }),
    content: `
      <div class="calc-card">
        <h3>The 65 Rule — Two Tracks</h3>
        <p style="color:var(--slate-700)">No one should begin a new term of federal service if they will reach the age of 65 before that term concludes.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>Track 1 — Constitutional Amendment:</strong> Advocated from day one. No person may begin a new term of federal elected office or begin a new federal judicial appointment if they will reach 65 before that term concludes. Requires two-thirds of both houses and three-quarters of states. A long road. We walk it anyway.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>Track 2 — Federal Fitness Assessment Act:</strong> Immediate statutory implementation. Every person holding federal elected office or federal judicial appointment above age 70 undergoes a mandatory annual cognitive and physical fitness assessment administered by an independent medical panel — Mayo Clinic, Johns Hopkins, Cleveland Clinic. Results published publicly through OpenLedger. No political appointments. No administration control.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;font-style:italic;">"I can't pass a law today saying you can't start a new term if you'll be 65 before it ends — the Constitution doesn't allow that without an amendment. So I'm doing two things. I'm starting the amendment process on day one because the principle is right. And while that process runs I'm making sure every American knows whether the person voting on their future can still pass a basic cognitive assessment."</p>
      </div>
      <div class="calc-card"><h3>Term Limits</h3><table class="data-table"><thead><tr><th>Office</th><th>Limit</th></tr></thead><tbody>
        <tr><td>Senate</td><td>2 terms (12 years)</td></tr>
        <tr><td>House</td><td>4 terms (8 years)</td></tr>
        <tr><td>President</td><td>2 terms (existing)</td></tr>
        <tr><td>Supreme Court</td><td>18-year staggered terms — 2 appointments per president per term</td></tr>
      </tbody></table></div>
      <div class="calc-card">
        <h3>Electoral College Reform — Proportional by Congressional District</h3>
        <p style="color:var(--slate-700)">Pure popular vote means three metropolitan areas decide every election. The current winner-take-all Electoral College creates a swing state stranglehold where six states get all the attention and the other forty-four are ignored.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>The solution:</strong> Proportional Electoral College allocation by congressional district. Maine and Nebraska already do this. Win a district, earn that electoral vote. The two senate bonus votes go to the statewide popular vote winner. Every district competitive. Every vote matters. Rural districts in blue states matter. Urban districts in red states matter. Every American matters — not just those in six swing states.</p>
      </div>

      <div class="calc-card">
        <h3>The Blind Application System</h3>
        <p style="color:var(--slate-700)">Every application for federal employment, college admission receiving federal funds, and government contracting gets assigned a number. Name removed. Race removed. Gender removed. Age removed. Address removed. Evaluators see only qualifications, experience, and merit.</p>
      </div>

      <div class="calc-card">
        <h3>Death Penalty Reform</h3>
        <p style="color:var(--slate-700)">I support the death penalty — but only when guilt is <strong>undisputable</strong>. Not beyond a reasonable doubt. Undisputable. Multiple independent forms of evidence required simultaneously.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;"><strong>Qualifying offenses:</strong> child rape, murder with undisputable evidence, corporate and institutional leaders whose knowing decisions directly caused mass death, human trafficking leadership.</p>
      </div>

      <div class="calc-card">
        <h3>LGBTQ Rights</h3>
        <p style="color:var(--slate-700)">LGBTQ Americans are Americans. They have the same rights as every other American — no more, no less. This administration will not legislate who people are. Everyone deserves to be treated with dignity regardless of who they love.</p>
      </div>
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
      <div class="calc-card">
        <h3>No Direct-to-Consumer Drug Advertising</h3>
        <p style="color:var(--slate-700)">Prescription drug advertising to the general public is banned. The United States and New Zealand are the only two developed nations that allow it. Your doctor should tell you what medication you need — not a commercial with a golden retriever and a warning that the drug may cause death.</p>
        <p style="color:var(--slate-700);margin-top:0.75rem;">The $6–7 billion pharmaceutical companies spend annually on consumer advertising — a cost embedded in drug prices — is eliminated. Drug companies may advertise to medical professionals through appropriate medical channels. They may not advertise prescription medications to the general public.</p>
      </div>

      <div class="calc-card">
        <h3>Medical Price Transparency</h3>
        <p style="color:var(--slate-700)">Every hospital, clinic, and medical provider publishes actual prices for every procedure publicly. AEGIS cross-references all medical billing against published prices automatically — a hospital billing $15,000 for a procedure listed at $3,000 is flagged instantly and <em>before payment is made</em>. Criminal charges for knowing billing fraud. Profit plus 10% clawed back.</p>
      </div>

      <div class="calc-card">
        <h3>The 15% National Interest Rate Cap</h3>
        <p style="color:var(--slate-700)">A national interest rate cap of 15% applies to all consumer lending. Total cost of credit — every fee, every charge, every point — calculated as APR. The 15% ceiling covers all of it with no exceptions. A lender making 15% on money they're lending is making an extraordinary return — 3x the risk-free rate. That's a healthy profitable lending business. Anything above that isn't lending — it's extraction.</p>
      </div>

      <div class="calc-card">
        <h3>Corporate Criminal Accountability for Consumer Fraud</h3>
        <p style="color:var(--slate-700)">An executive who knowingly designs a hidden fee structure that manipulates consumers is not an aggressive business operator — they are a thief with a good lawyer. The executive who sat in the meeting, saw the research, approved the policy, and signed off on it faces personal criminal prosecution. Profit plus 10% clawed back from the company, plus criminal charges for the individuals who made the decision.</p>
      </div>
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
// ─── REDUCING REDUNDANT AGENCIES ───────────────────────────
function pageAgencies(main) {
  policyPage(main, {
    title: 'Reducing Redundant Agencies',
    subtitle: '"We\'re clearing the house. We\'re cutting overhead — not people."',
    icon: '🏢',
    impactId: 'agencies-impact',
    impactFn: p => ({ level: 'affects', message: 'Agency consolidation removes duplicate bureaucracy — an estimated <strong>$100 billion per year</strong> in overhead — while every service you rely on (food assistance, housing support, job training, emergency help) keeps running through a system that actually works.' }),
    content: `
      <div class="calc-card">
        <h3>What We're Doing</h3>
        <p style="color:var(--slate-700)">The federal government has accumulated agencies the way old houses accumulate furniture — one piece at a time until nobody remembers why half of it is there. We're clearing the house.</p>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Presidential Reorganization Office established in Year 1</li>
          <li>Top-to-bottom audit of every federal agency within 18 months</li>
          <li>Consolidate overlapping programs into unified, accountable entities</li>
          <li>Mandatory real-time public dashboards for every major agency</li>
          <li>Independent annual audits for all agencies above $1B budget</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>Target Areas — Documented Overlap</h3>
        <table class="data-table">
          <thead><tr><th>Function</th><th>The Redundancy</th></tr></thead>
          <tbody>
            <tr><td>Job training</td><td>47 separate programs across 9 agencies</td></tr>
            <tr><td>Food safety</td><td>Split between USDA and FDA with overlapping jurisdictions</td></tr>
            <tr><td>Housing assistance</td><td>Fragmented across HUD, USDA, Treasury, and others</td></tr>
            <tr><td>Emergency management</td><td>Coordination failures that cost lives</td></tr>
            <tr><td>Consumer product safety</td><td>At least 20 federal agencies with overlapping jurisdiction</td></tr>
            <tr><td>Non-emergency medical transport</td><td>42 programs across 6 departments serving the same people</td></tr>
          </tbody>
        </table>
      </div>

      <div class="calc-card">
        <h3>What We're Not Doing</h3>
        <p style="color:var(--slate-700)">This is not about gutting services. People who need food assistance, housing support, job training, and emergency help will still receive those things — from a system that actually works. We're cutting overhead. We're not cutting people.</p>
        <div class="stats-row" style="margin-top:1rem;">
          <div class="stat-card"><div class="stat-value">$100B</div><div class="stat-label">Annual Savings</div></div>
          <div class="stat-card"><div class="stat-value">18 mo</div><div class="stat-label">Full Audit Timeline</div></div>
          <div class="stat-card"><div class="stat-value">$1B+</div><div class="stat-label">Independent Audit Threshold</div></div>
        </div>
      </div>
    `
  });
}

// ─── PHARMACEUTICAL MONOPOLY ───────────────────────────────
function pagePharma(main) {
  policyPage(main, {
    title: 'Ending the Pharmaceutical Monopoly',
    subtitle: '"Medications Americans invented and paid to develop — priced for Americans to actually afford."',
    icon: '🧪',
    impactId: 'pharma-impact',
    impactFn: p => {
      if (p.healthcareCosts) {
        return { level: 'affects', message: `You report ${fmtDollar(p.healthcareCosts)}/year in healthcare costs. Reference pricing and Medicare negotiation target the prescription share of that directly — Americans pay <strong>2.78× the OECD average</strong> (4.22× for brand-name drugs) today. Insulin drops to $35.` };
      }
      return { level: 'affects', message: 'Every American pays inflated drug prices — at the pharmacy and indirectly through premiums and taxes. Reference pricing ties U.S. prices to what other developed nations pay. Insulin at $35.' };
    },
    content: `
      <div class="calc-card">
        <h3>The Problem</h3>
        <p style="color:var(--slate-700)">An American diabetic pays ten times what a Canadian pays for the same insulin made by the same company. A senior chooses between medication and groceries every month until one of them runs out. This is not a supply problem. It is a legalized monopoly problem — enforced by a government that took the money and looked the other way.</p>
      </div>

      <div class="calc-card">
        <h3>The Fix</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Medicare negotiates drug prices — immediately, fully, no exceptions</li>
          <li>Reference pricing — if a drug costs $X in Canada or Germany, it costs $X here</li>
          <li>Patent reform — end evergreening, one meaningful extension per drug</li>
          <li>Fast-track generic approval — eliminate pay-to-delay deals</li>
          <li>Ban pharmaceutical lobbying — period</li>
          <li>End direct-to-consumer prescription drug advertising (only the U.S. and New Zealand allow it)</li>
          <li>Fine companies twice their total sales for any drug knowingly released unsafe</li>
          <li>Publicly funded research must produce public benefit — or the loans are repaid</li>
          <li>Domestic drug manufacturing — end foreign supply-chain dependency</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>The Result</h3>
        <div class="stats-row">
          <div class="stat-card"><div class="stat-value">$35</div><div class="stat-label">Insulin, Capped</div></div>
          <div class="stat-card"><div class="stat-value">$6–7B</div><div class="stat-label">Annual Drug Ads Eliminated</div></div>
          <div class="stat-card"><div class="stat-value">2.78×</div><div class="stat-label">U.S. Prices vs OECD</div></div>
        </div>
        <p style="font-size:0.875rem;color:var(--slate-600);margin-top:1rem;">The $6–7 billion pharmaceutical companies spend annually on consumer advertising — a cost embedded in every drug price — is eliminated, producing immediate downward pricing pressure.</p>
      </div>
    `
  });
}

// ─── MINIMUM WAGE ──────────────────────────────────────────
function pageMinimumWage(main) {
  policyPage(main, {
    title: 'Minimum Wage — The Real Math',
    subtitle: '"Politicians argue about the number. I\'m showing you the math."',
    icon: '💵',
    impactId: 'wage-impact',
    impactFn: p => {
      if (!p.income) return { level: 'none', message: 'Add your income to your profile to see how the eliminated taxes change your take-home pay.' };
      const inc = Number(p.income);
      const taxable = Math.max(0, inc - 15000);
      let fedTax = 0;
      const brackets = [[11600,0.10],[47150,0.12],[100525,0.22],[191950,0.24],[243725,0.32],[609350,0.35],[Infinity,0.37]];
      let prev = 0;
      for (const [cap, rate] of brackets) { if (taxable <= prev) break; fedTax += (Math.min(taxable, cap) - prev) * rate; prev = cap; }
      const payroll = Math.min(inc, 176100) * 0.0765;
      const gain = fedTax + payroll + 4800;
      return { level: 'affects', message: `Without raising your wage one dollar, eliminating federal income tax (${fmtDollar(fedTax)}), payroll tax (${fmtDollar(payroll)}), and healthcare premiums (~$4,800) puts about <strong>${fmtDollar(gain)}/year more (${fmtDollar(gain/12)}/month)</strong> in your pocket.` };
    },
    content: `
      <div class="calc-card">
        <h3>The Floor</h3>
        <p style="color:var(--slate-700)"><strong>$15 per hour</strong> federal minimum wage. Mandatory cost-of-living adjustments every two years tied to local indexes. No state may fall below the federal floor.</p>
      </div>

      <div class="calc-card">
        <h3>Real Take-Home Calculator</h3>
        <p style="color:var(--slate-600)">See what your paycheck becomes when income tax, payroll tax, and healthcare premiums all go to zero.</p>
        <div class="calc-grid">
          ${calcField('wage-rate', 'Hourly Wage ($)', '15')}
          ${calcField('wage-hours', 'Hours Per Week', '40')}
        </div>
        <button class="btn btn-primary" onclick="calcWage()">Calculate</button>
        <div id="wage-result"></div>
      </div>

      <div class="calc-card">
        <h3>$15/hour, 40 hours — Side by Side</h3>
        <table class="data-table">
          <thead><tr><th></th><th>Current System</th><th>Under This Platform</th></tr></thead>
          <tbody>
            <tr><td>Gross monthly</td><td>$2,600</td><td>$2,600</td></tr>
            <tr><td>Federal income tax</td><td>−$260</td><td class="text-success">$0 — eliminated</td></tr>
            <tr><td>Payroll tax</td><td>−$199</td><td class="text-success">$0 — eliminated</td></tr>
            <tr><td>Healthcare premiums</td><td>−$400</td><td class="text-success">$0 — universal</td></tr>
            <tr style="background:var(--success-bg)"><td><strong>Take home</strong></td><td><strong>~$1,741</strong></td><td><strong>~$2,600</strong></td></tr>
          </tbody>
        </table>
        <p style="font-size:0.9375rem;color:var(--slate-700);margin-top:1rem;">That's <strong>$859 more per month</strong> in real purchasing power without raising the wage a single dollar. Add agricultural reform saving $100–200/month on groceries, housing reform stabilizing rents, and prescription drugs at negotiated prices — and the real value of $15/hour under this platform is closer to <strong>$19–20/hour</strong> today.</p>
      </div>
    `
  });
  prefillCalc();
}

function calcWage() {
  const rate = Number(document.getElementById('wage-rate')?.value) || 0;
  const hours = Number(document.getElementById('wage-hours')?.value) || 0;
  if (!rate || !hours) return;
  const annual = rate * hours * 52;
  const taxable = Math.max(0, annual - 15000);
  let fedTax = 0;
  const brackets = [[11600,0.10],[47150,0.12],[100525,0.22],[191950,0.24],[243725,0.32],[609350,0.35],[Infinity,0.37]];
  let prev = 0;
  for (const [cap, brate] of brackets) { if (taxable <= prev) break; fedTax += (Math.min(taxable, cap) - prev) * brate; prev = cap; }
  const payroll = Math.min(annual, 176100) * 0.0765;
  const currentTakeMo = (annual - fedTax - payroll - 4800) / 12;
  const platformTakeMo = annual / 12;
  const gainMo = platformTakeMo - currentTakeMo;
  document.getElementById('wage-result').innerHTML = `
    <div class="result-box">
      <h4>Your Monthly Take-Home</h4>
      <div class="result-row"><span class="result-row-label">Current system</span><span class="result-row-value">${fmtDollar(currentTakeMo)}/mo</span></div>
      <div class="result-row"><span class="result-row-label">Under this platform</span><span class="result-row-value result-positive">${fmtDollar(platformTakeMo)}/mo</span></div>
      <div class="result-row" style="border-top:2px solid rgba(255,255,255,0.3);padding-top:1rem;">
        <span class="result-row-label" style="font-weight:700;">You Keep</span>
        <span class="result-row-value result-positive" style="font-size:1.5rem;">+${fmtDollar(gainMo)}/mo</span>
      </div>
      <div class="result-label" style="margin-top:0.5rem;">+${fmtDollar(gainMo*12)} per year — same wage, more money.</div>
    </div>`;
}

// ─── PUBLIC SERVICE FINANCIAL INTEGRITY ────────────────────
function pageIntegrity(main) {
  policyPage(main, {
    title: 'Public Service Financial Integrity Act',
    subtitle: '"You want to serve the American people? Put your portfolio in a blind trust and govern."',
    icon: '🚫',
    impactId: 'integrity-impact',
    impactFn: p => ({ level: 'affects', message: 'This applies to every federal elected official, appointee, senior executive, and regulator — plus their immediate household. For everyone else, it means a government where officials can no longer trade on what they know before you do, with every flag published publicly on OpenLedger.' }),
    content: `
      <div class="calc-card">
        <h3>The Problem</h3>
        <p style="color:var(--slate-700)">The single most corrupting force in American government is not bribery — it is the legal, normalized practice of officials using non-public policy information to enrich themselves through financial markets. A senator on the banking committee trading bank stocks. A congressman who gets a classified briefing and sells airline stocks the next morning. This is insider trading. It is legal for members of Congress. That ends.</p>
      </div>

      <div class="calc-card">
        <h3>The No-Trading Rule</h3>
        <p style="color:var(--slate-700)">Any federal elected official, appointed official, senior executive-branch employee, federal regulator — and any member of their immediate household — is prohibited from buying or selling individual stocks, bonds, options, derivatives, or any other individual financial instrument for the duration of their service and for <strong>two years after</strong>.</p>
        <h4 style="margin-top:1rem;">What Is Permitted</h4>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>Widely diversified index funds held in a blind trust</li>
          <li>A blind trust managed by an independent fiduciary — no communication with the official</li>
          <li>Government bonds</li>
          <li>Real property not subject to government regulatory decisions</li>
        </ul>
        <p style="color:var(--slate-600);font-size:0.9375rem;">You may participate in the broad success of the American economy. You may not trade on your knowledge of what the government is about to do.</p>
      </div>

      <div class="calc-card">
        <h3>The Two-Year Revolving-Door Ban</h3>
        <p style="color:var(--slate-700)">A defense official who approves a $10 billion contract retires and joins the contractor's board six months later. The implicit promise of future employment corrupts present decision-making. Former officials are barred for two years from employment, consulting, board membership, or any compensated relationship with any entity they regulated, contracted with, or had authority over — and from lobbying any federal agency on related matters.</p>
      </div>

      <div class="calc-card">
        <h3>Enforcement — Criminal, Not an Ethics Memo</h3>
        <ul style="padding-left:1.5rem;color:var(--slate-700);line-height:2;">
          <li>All holdings of covered officials disclosed in real time on OpenLedger — within 48 hours of any transaction</li>
          <li>AEGIS cross-references disclosures against market data automatically</li>
          <li>Violations referred automatically to the Corporate Accountability Division — criminal prosecution, not an ethics-committee referral</li>
          <li>Penalty: disgorgement of all profits plus 10%, plus personal criminal prosecution for knowing violations</li>
          <li>AEGIS flags unusual trading by anyone preceding government action — every flag published publicly with a relationship map; a preliminary investigation opens within 72 hours</li>
        </ul>
      </div>

      <div class="calc-card">
        <h3>The Sacrifice Principle</h3>
        <p style="color:var(--slate-700)">Public service requires sacrifice. You are asking the American people to trust you with their money, their laws, and their future. The minimum demonstration of that trustworthiness is the willingness to set aside personal financial enrichment for the duration of that service. If you're here for the right reasons, that's not a sacrifice — it's obvious.</p>
      </div>
    `
  });
}

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
