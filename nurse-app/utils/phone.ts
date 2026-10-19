// Mongolian mobile numbers have 8 digits; the server wants E.164 (+976XXXXXXXX).
export function toE164(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '')
  if (/^\d{8}$/.test(digits)) return `+976${digits}`
  if (/^\+976\d{8}$/.test(digits)) return digits
  return null
}
