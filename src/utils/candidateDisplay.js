/**
 * Shared candidate display helpers — keeps the response-rate + party-color
 * rendering consistent across cards, profiles, and list pages.
 */

// Map raw party strings to a short key and an accent color.
export function partyKey(raw) {
  if (!raw) return 'other'
  const p = String(raw).toLowerCase()
  if (p.includes('democrat')) return 'D'
  if (p.includes('republican')) return 'R'
  if (p.includes('libertarian')) return 'L'
  if (p.includes('green')) return 'G'
  if (p.includes('independent')) return 'I'
  return 'other'
}

export const PARTY_COLORS = {
  D: '#2563eb',
  R: '#dc2626',
  L: '#d97706',
  G: '#16a34a',
  I: '#7c3aed',
  other: '#64748b',
}

export function partyColor(raw) {
  return PARTY_COLORS[partyKey(raw)]
}

/**
 * Return the right response-rate display for a candidate.
 *
 * Shadow profiles with no questions answered get "No questions yet" in a
 * neutral gray — a blaring red 0% on every card makes the whole site read
 * as a rating system that hates every politician. Red/amber are reserved
 * for candidates who actually have questions AND a poor response rate.
 *
 * Returns { value, label, color, isEmpty }.
 */
export function responseRateDisplay(candidate) {
  const asked = Number(candidate?.total_questions_received || 0)
  const rate = Number(candidate?.qa_response_rate || 0)

  if (asked === 0) {
    return {
      value: 'No questions yet',
      label: 'Response Rate',
      color: 'var(--slate-500)',
      isEmpty: true,
    }
  }

  let color = 'var(--error)'
  let label = 'Low'
  if (rate >= 80) { color = 'var(--success)'; label = 'High' }
  else if (rate >= 50) { color = 'var(--warning)'; label = 'Medium' }

  return {
    value: `${Math.round(rate)}%`,
    label: `Response Rate (${label})`,
    color,
    isEmpty: false,
  }
}
