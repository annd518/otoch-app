// Support channel shown when a payment needs manual checking (reconciliation)
// and on the profile. The values come from the owner through
// EXPO_PUBLIC_SUPPORT_PHONE / EXPO_PUBLIC_SUPPORT_URL; nothing is invented when
// they are empty. These are public values, never credentials.
export interface SupportContact {
  // dialable number for a tel: link, digits with an optional leading +
  phone: string | null
  // https:// page (help centre, chat)
  url: string | null
}

// 103 is the emergency line, not a support channel; short codes are refused
// so a typo cannot turn the button into an emergency call.
const MIN_DIGITS = 6
const MAX_DIGITS = 15

export function parseSupportPhone(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!/^\+?[\d\s-]+$/.test(trimmed)) return null
  const plus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null
  return plus ? `+${digits}` : digits
}

export function parseSupportUrl(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return /^https:\/\/[^\s/?#]+\.[^\s/?#]+(?:[/?#]\S*)?$/.test(trimmed) ? trimmed : null
}

export function parseSupportContact(phone: string | undefined, url: string | undefined): SupportContact {
  return { phone: parseSupportPhone(phone), url: parseSupportUrl(url) }
}

export function hasSupportContact(contact: SupportContact): boolean {
  return contact.phone !== null || contact.url !== null
}
