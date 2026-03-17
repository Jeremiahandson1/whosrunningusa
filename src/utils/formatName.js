/**
 * Convert a name to consistent title case for display.
 * Handles: ALL CAPS, "LASTNAME, FIRSTNAME", Mc/O' patterns, nickname extraction.
 */
export function formatDisplayName(name) {
  if (!name) return name

  // Title-case helper
  const titleCase = (s) => s
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bMc([a-z])/g, (_, c) => 'Mc' + c.toUpperCase())
    .replace(/\bO'([a-z])/g, (_, c) => "O'" + c.toUpperCase())

  // Detect "Lastname, Firstname ..." format (with or without ALL CAPS)
  const commaIdx = name.indexOf(',')
  if (commaIdx > 0 && commaIdx < name.length - 1) {
    const lastName = titleCase(name.slice(0, commaIdx).trim())
    const rest = name.slice(commaIdx + 1).trim()

    // Extract nickname in quotes or parens
    const nicknameMatch = rest.match(/['"'\u2018\u2019\u201C\u201D]([^'"'\u2018\u2019\u201C\u201D]+)['"'\u2018\u2019\u201C\u201D]/) ||
                           rest.match(/\(([^)]+)\)/)
    const nickname = nicknameMatch ? titleCase(nicknameMatch[1].trim()) : null
    const firstName = titleCase(rest.split(/\s+/)[0])
    const displayFirst = nickname || firstName
    return `${displayFirst} ${lastName}`
  }

  // If already mixed case (not all-caps, not all-lowercase), return as-is
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return name

  return titleCase(name)
}
