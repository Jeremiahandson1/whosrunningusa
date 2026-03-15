/**
 * Convert a name to consistent title case for display.
 * Handles: ALL CAPS, "LASTNAME, FIRSTNAME", Mc/O' patterns.
 */
export function formatDisplayName(name) {
  if (!name) return name
  // If name is not all-caps and not all-lowercase, assume it's already formatted
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return name
  return name
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bMc([a-z])/g, (_, c) => 'Mc' + c.toUpperCase())
    .replace(/\bO'([a-z])/g, (_, c) => "O'" + c.toUpperCase())
}
