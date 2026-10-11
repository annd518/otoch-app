// Mongolian numbers have 8 digits. The current server requires
// emergencyContact to be at least 10 characters (server parentController
// parentSchema), so a bare 8-digit number is sent with the +976 prefix.
export function normalizeMongolianPhone(input: string): string {
  const trimmed = input.trim()
  const digits = trimmed.replace(/[\s-]/g, '')
  if (/^\d{8}$/.test(digits)) return `+976${digits}`
  return trimmed
}
