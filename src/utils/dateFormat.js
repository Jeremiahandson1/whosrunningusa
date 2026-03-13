/**
 * Consistent date formatting utilities for WhosRunningUSA
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Format a date string as "Mar 13, 2026"
 */
export function formatDate(dateString) {
  if (!dateString) return ''
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return ''
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/**
 * Format a date string as "Mar 13, 2026 at 2:30 PM"
 */
export function formatDateTime(dateString) {
  if (!dateString) return ''
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return ''
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${time}`
}

/**
 * Format a date string as relative time:
 * - "just now" (< 1 min)
 * - "2 minutes ago", "3 hours ago", "5 days ago"
 * - Falls back to "Mar 13" format for dates older than 7 days
 */
export function formatRelative(dateString) {
  if (!dateString) return ''
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diffMs = now - d
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`

  // For older dates, show "Mar 13" (same year) or "Mar 13, 2025" (different year)
  const sameYear = d.getFullYear() === now.getFullYear()
  return sameYear
    ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
    : `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/**
 * Format a date range as "Mar 13-15, 2026" or "Mar 13 - Apr 2, 2026"
 * Handles same-month, cross-month, and cross-year ranges.
 */
export function formatDateRange(start, end) {
  if (!start) return ''
  const s = new Date(start)
  if (isNaN(s.getTime())) return ''
  if (!end) return formatDate(start)
  const e = new Date(end)
  if (isNaN(e.getTime())) return formatDate(start)

  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth()) {
      // Same month: "Mar 13-15, 2026"
      return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()}-${e.getDate()}, ${s.getFullYear()}`
    }
    // Different month, same year: "Mar 13 - Apr 2, 2026"
    return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()} - ${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`
  }
  // Different years: "Dec 30, 2025 - Jan 2, 2026"
  return `${formatDate(start)} - ${formatDate(end)}`
}

/**
 * Format time until a future date:
 * - "tomorrow"
 * - "in 2 hours", "in 3 days"
 * - "today" if same calendar day
 * - Falls back to formatDate for dates more than 30 days out
 */
export function timeUntil(dateString) {
  if (!dateString) return ''
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diffMs = d - now

  if (diffMs < 0) return formatDate(dateString) // already past

  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 60) return 'today'
  if (diffHours < 24) return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`

  // Check if it's tomorrow (next calendar day)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate()) {
    return 'tomorrow'
  }

  if (diffDays <= 30) return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`
  return formatDate(dateString)
}
