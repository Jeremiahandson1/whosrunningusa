/* Impact card rendering — shows personalized policy relevance */

function renderImpactCard(containerId, assessment) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const profile = getProfile();
  if (!profile || Object.keys(profile).length === 0) {
    el.innerHTML = `<div class="impact-card none">
      <div class="impact-icon">👤</div>
      <div class="impact-content">
        <div class="impact-label">Fill out your profile to see how this policy affects you</div>
        <p class="impact-detail">Click the Profile button in the nav to enter your information.</p>
      </div>
    </div>`;
    return;
  }

  const result = assessment(profile);
  const typeClass = result.level === 'affects' ? 'affects' : result.level === 'partial' ? 'partial' : 'none';
  const icon = result.level === 'affects' ? '✅' : result.level === 'partial' ? '⚠️' : '➖';
  const label = result.level === 'affects' ? 'Affects You' : result.level === 'partial' ? 'Partially Affects You' : 'Does Not Apply';

  el.innerHTML = `<div class="impact-card ${typeClass}">
    <div class="impact-icon">${icon}</div>
    <div class="impact-content">
      <div class="impact-label">${label}</div>
      <p class="impact-detail">${result.message}</p>
    </div>
  </div>`;
}

function fmt(n) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtDollar(n) {
  return '$' + fmt(Math.abs(n));
}
