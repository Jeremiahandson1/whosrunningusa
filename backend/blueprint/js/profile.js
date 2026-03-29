/* Profile system — persists across all pages via localStorage */
const PROFILE_KEY = 'phillips_policy_profile';

const PROFILE_FIELDS = [
  { key: 'income', label: 'Annual Income ($)', type: 'number', placeholder: '65000' },
  { key: 'filingStatus', label: 'Filing Status', type: 'select', options: ['', 'Single', 'Married Filing Jointly', 'Head of Household'] },
  { key: 'monthlySpending', label: 'Non-Essential Monthly Spending ($)', type: 'number', placeholder: '1500' },
  { key: 'tradesPerYear', label: 'Financial Trades Per Year', type: 'number', placeholder: '50' },
  { key: 'netWorth', label: 'Net Worth ($)', type: 'number', placeholder: '250000' },
  { key: 'housingSituation', label: 'Housing Situation', type: 'select', options: ['', 'Renter', 'Homeowner (with mortgage)', 'Homeowner (paid off)', 'Living with family'] },
  { key: 'propertyTax', label: 'Annual Property Tax ($)', type: 'number', placeholder: '4200' },
  { key: 'healthcareCosts', label: 'Annual Healthcare Costs ($)', type: 'number', placeholder: '6000' },
  { key: 'debtBalances', label: 'Total Debt Balances ($)', type: 'number', placeholder: '35000' },
  { key: 'debtRates', label: 'Average Debt Interest Rate (%)', type: 'number', placeholder: '18' },
  { key: 'age', label: 'Age', type: 'number', placeholder: '35' },
  { key: 'householdSize', label: 'Household Size', type: 'number', placeholder: '3' },
  { key: 'veteranStatus', label: 'Veteran Status', type: 'select', options: ['', 'Not a veteran', 'Veteran', 'Active duty'] },
  { key: 'yearsServed', label: 'Years of Military Service', type: 'number', placeholder: '0' },
];

function getProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { return {}; }
}

function saveProfile(data) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('profile-updated', { detail: data }));
}

function profileCompletionCount() {
  const p = getProfile();
  return PROFILE_FIELDS.filter(f => p[f.key] && String(p[f.key]).trim() !== '').length;
}

function profileCompletionPct() {
  return Math.round((profileCompletionCount() / PROFILE_FIELDS.length) * 100);
}

function renderProfileModal() {
  const existing = document.getElementById('profile-modal-overlay');
  if (existing) existing.remove();

  const profile = getProfile();

  const overlay = document.createElement('div');
  overlay.id = 'profile-modal-overlay';
  overlay.className = 'modal-overlay open';

  let fieldsHTML = PROFILE_FIELDS.map(f => {
    const val = profile[f.key] || '';
    if (f.type === 'select') {
      const opts = f.options.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o || '— Select —'}</option>`).join('');
      return `<div class="calc-field"><label for="pf-${f.key}">${f.label}</label><select id="pf-${f.key}" data-key="${f.key}">${opts}</select></div>`;
    }
    return `<div class="calc-field"><label for="pf-${f.key}">${f.label}</label><input id="pf-${f.key}" type="number" data-key="${f.key}" value="${val}" placeholder="${f.placeholder || ''}"></div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal">
      <button class="modal-close" id="profile-close">&times;</button>
      <h2>Your Profile</h2>
      <p style="color:var(--slate-600);margin-bottom:1.5rem;">Fill in your details to see personalized policy impacts across every page. Your data stays in your browser — it is never sent to a server.</p>
      <div class="calc-grid">${fieldsHTML}</div>
      <div style="display:flex;gap:0.75rem;margin-top:1rem;">
        <button class="btn btn-primary" id="profile-save">Save Profile</button>
        <button class="btn btn-secondary" id="profile-clear">Clear All</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  document.getElementById('profile-close').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('profile-save').onclick = () => {
    const data = {};
    overlay.querySelectorAll('[data-key]').forEach(el => {
      const v = el.value.trim();
      if (v) data[el.dataset.key] = el.type === 'number' ? Number(v) : v;
    });
    saveProfile(data);
    overlay.remove();
    if (typeof onProfileUpdated === 'function') onProfileUpdated();
  };

  document.getElementById('profile-clear').onclick = () => {
    saveProfile({});
    overlay.remove();
    if (typeof onProfileUpdated === 'function') onProfileUpdated();
  };
}
