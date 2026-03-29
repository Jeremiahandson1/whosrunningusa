/* Persistent navigation — matches WhosRunningUSA header pattern */
function bp(path) { return (typeof BASE !== 'undefined' ? BASE : '') + path; }

const NAV_SECTIONS = [
  { label: 'Economy', children: [
    { href: '/tax', label: 'Tax Reform' },
    { href: '/property', label: 'Property Tax' },
    { href: '/debt', label: 'National Debt' },
    { href: '/loans', label: 'Banking & Loans' },
    { href: '/business', label: 'Small Business' },
    { href: '/poverty', label: 'Anti-Poverty' },
    { href: '/fed', label: 'Federal Reserve' },
  ]},
  { label: 'People', children: [
    { href: '/healthcare', label: 'Healthcare' },
    { href: '/veterans', label: 'Veterans' },
    { href: '/seniors', label: 'Seniors & SS' },
    { href: '/education', label: 'Education' },
    { href: '/university', label: 'Public University' },
    { href: '/housing', label: 'Housing' },
    { href: '/children', label: 'Child Protection' },
    { href: '/community', label: 'Community Investment' },
  ]},
  { label: 'Reform', children: [
    { href: '/government', label: 'Government Reform' },
    { href: '/military', label: 'Military' },
    { href: '/criminal-justice', label: 'Criminal Justice' },
    { href: '/transparency', label: 'Transparency & AEGIS' },
    { href: '/corporate', label: 'Corporate Accountability' },
    { href: '/insurance', label: 'Insurance Reform' },
    { href: '/consumer', label: 'Consumer Protection' },
  ]},
  { label: 'Society', children: [
    { href: '/drugs', label: 'Drug Policy' },
    { href: '/immigration', label: 'Immigration' },
    { href: '/guns', label: 'Gun Policy' },
    { href: '/reproductive', label: 'Reproductive Rights' },
    { href: '/agriculture', label: 'Agriculture & Food' },
    { href: '/environment', label: 'Climate & Environment' },
  ]},
  { label: 'Future', children: [
    { href: '/infrastructure', label: 'Infrastructure' },
    { href: '/technology', label: 'Tech, AI & Space' },
    { href: '/foreign-policy', label: 'Foreign Policy' },
    { href: '/democracy', label: 'Democracy Reform' },
    { href: '/certification', label: 'Skills Certification' },
  ]},
];

// Prefix all hrefs with BASE
NAV_SECTIONS.forEach(s => s.children.forEach(c => { if (!c.href.startsWith(BASE)) c.href = bp(c.href); }));
const ALL_NAV_LINKS = NAV_SECTIONS.flatMap(s => s.children);
ALL_NAV_LINKS.push({ href: bp('/ask'), label: 'Ask AI' });

function renderNav() {
  const path = window.location.pathname;
  const count = profileCompletionCount();
  const total = PROFILE_FIELDS.length;
  const pct = profileCompletionPct();
  const indicatorClass = pct >= 70 ? 'high' : pct >= 30 ? 'mid' : 'low';

  // Desktop: grouped dropdowns
  const desktopNavHTML = NAV_SECTIONS.map((section, i) => {
    const isActive = section.children.some(c => c.href === path);
    return `<div class="nav-dropdown" data-dropdown="${i}">
      <button class="nav-link ${isActive ? 'active' : ''}" data-dropdown-toggle="${i}">${section.label} <span style="font-size:0.6em">&#9662;</span></button>
      <div class="nav-dropdown-menu" id="dropdown-${i}">
        ${section.children.map(l => `<a href="${l.href}" class="nav-dropdown-item ${path === l.href ? 'active' : ''}" data-nav>${l.label}</a>`).join('')}
      </div>
    </div>`;
  }).join('');

  // Mobile: flat list grouped
  const mobileLinksHTML = `<a href="${bp('/')}" class="mobile-nav-link ${path === bp('/') || path === BASE ? 'active' : ''}" data-nav>Home</a>` +
    NAV_SECTIONS.map(section =>
      `<div class="mobile-nav-group-label">${section.label}</div>` +
      section.children.map(l =>
        `<a href="${l.href}" class="mobile-nav-link ${path === l.href ? 'active' : ''}" data-nav>${l.label}</a>`
      ).join('')
    ).join('') +
    `<div class="mobile-nav-group-label">Tools</div>
     <a href="${bp('/ask')}" class="mobile-nav-link ${path === bp('/ask') ? 'active' : ''}" data-nav>Ask AI</a>`;

  const header = document.createElement('header');
  header.className = 'header';
  header.innerHTML = `
    <div class="container header-inner">
      <a href="${bp('/')}" class="logo" data-nav>
        <div class="logo-mark"><span>JP</span></div>
        <span>Phillips<span style="color:var(--burgundy-600)">Policy</span></span>
      </a>
      <nav class="nav desktop-nav">
        ${desktopNavHTML}
        <a href="${bp('/ask')}" class="nav-link ${path === bp('/ask') ? 'active' : ''}" data-nav>Ask AI</a>
      </nav>
      <div class="nav-actions desktop-nav">
        <button class="profile-btn" id="nav-profile-btn">
          <span class="profile-indicator ${indicatorClass}">${count}</span>
          <span class="desktop-label">Profile</span>
        </button>
      </div>
      <button class="mobile-menu-btn" id="mobile-toggle">&#9776;</button>
    </div>
    <div class="mobile-menu" id="mobile-menu">
      <nav class="mobile-nav">${mobileLinksHTML}</nav>
      <div style="padding-top:1rem;border-top:1px solid var(--slate-200);">
        <button class="btn btn-secondary" style="width:100%" id="mobile-profile-btn">Profile (${count}/${total})</button>
      </div>
    </div>`;

  const target = document.getElementById('app-header');
  if (target) { target.innerHTML = ''; target.appendChild(header); }

  // Dropdown toggles
  header.querySelectorAll('[data-dropdown-toggle]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.dropdownToggle;
      const menu = document.getElementById('dropdown-' + id);
      const wasOpen = menu.classList.contains('open');
      // Close all
      header.querySelectorAll('.nav-dropdown-menu').forEach(m => m.classList.remove('open'));
      if (!wasOpen) menu.classList.toggle('open');
    });
  });

  // Close dropdowns on outside click
  document.addEventListener('click', () => {
    header.querySelectorAll('.nav-dropdown-menu').forEach(m => m.classList.remove('open'));
  });

  // Event listeners
  document.getElementById('nav-profile-btn')?.addEventListener('click', renderProfileModal);
  document.getElementById('mobile-profile-btn')?.addEventListener('click', () => { document.getElementById('mobile-menu').classList.remove('open'); renderProfileModal(); });
  document.getElementById('mobile-toggle')?.addEventListener('click', () => {
    document.getElementById('mobile-menu').classList.toggle('open');
  });

  // SPA navigation
  header.querySelectorAll('[data-nav]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const href = a.getAttribute('href');
      history.pushState(null, '', href);
      header.querySelectorAll('.nav-dropdown-menu').forEach(m => m.classList.remove('open'));
      document.getElementById('mobile-menu')?.classList.remove('open');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  });
}

function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <div class="container">
      <div style="display:grid;grid-template-columns:2fr repeat(3,1fr);gap:2rem;" class="footer-grid-custom">
        <div>
          <div class="footer-brand">Phillips Policy Hub</div>
          <p class="footer-tagline" style="font-family:var(--font-display);font-style:italic;">"We're going to fix the world and it starts here."</p>
          <p style="font-size:0.875rem;max-width:360px;">See exactly how each proposal impacts your household. Fill out your profile to get personalized numbers on every page.</p>
        </div>
        ${NAV_SECTIONS.slice(0, 3).map(section => `<div>
          <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--slate-500);margin-bottom:0.75rem;">${section.label}</div>
          ${section.children.map(l => `<a href="${l.href}" data-nav style="font-size:0.875rem;color:var(--slate-400);display:block;padding:0.2rem 0;">${l.label}</a>`).join('')}
        </div>`).join('')}
      </div>
      <div class="footer-bottom">
        <p>&copy; ${new Date().getFullYear()} Phillips Policy Hub. All rights reserved.</p>
        <p style="color:var(--slate-500);">A <a href="https://whosrunningusa.com" style="color:var(--slate-400);" target="_blank">WhosRunningUSA</a> initiative.</p>
      </div>
    </div>`;

  const target = document.getElementById('app-footer');
  if (target) { target.innerHTML = ''; target.appendChild(footer); }

  footer.querySelectorAll('[data-nav]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      history.pushState(null, '', a.getAttribute('href'));
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  });
}
