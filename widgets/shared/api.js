const API_URL = import.meta.env.VITE_API_URL || 'https://whosrunningusa-api.onrender.com/api';

export async function widgetFetch(endpoint) {
  const res = await fetch(`${API_URL}${endpoint}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export function trackEvent(widgetType, eventType, eventData = {}, apiKey = null) {
  const body = {
    widget_type: widgetType,
    host_domain: window.location.hostname,
    event_type: eventType,
    event_data: eventData,
  };
  if (apiKey) body.api_key = apiKey;

  // Fire and forget — don't block widget rendering
  fetch(`${API_URL}/widgets/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {}); // silently ignore tracking failures
}

export function formatDollars(n) {
  if (!n && n !== 0) return '—';
  const abs = Math.abs(Number(n));
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Number(n).toLocaleString()}`;
}

export function formatPct(n) {
  return `${Math.round(Number(n) || 0)}%`;
}
