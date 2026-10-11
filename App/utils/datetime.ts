// Visits happen in Mongolia. Asia/Ulaanbaatar is UTC+8 with no daylight saving,
// so a fixed offset is exact and avoids depending on the phone's time zone.
export const ULAANBAATAR_OFFSET = '+08:00'
const ULAANBAATAR_OFFSET_MS = 8 * 60 * 60 * 1000

export function isValidCalendarDate(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return false
  const [, y, m, d] = match
  const year = Number(y)
  const month = Number(m)
  const day = Number(d)
  const probe = new Date(Date.UTC(year, month - 1, day))
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
}

// "2026-10-20" + "09:00-11:00" -> "2026-10-20T01:00:00.000Z"
export function slotStartToUtcIso(date: string, slot: string): string | null {
  if (!isValidCalendarDate(date)) return null
  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(slot)
  if (!match) return null
  const [, hh, mm] = match
  if (Number(hh) > 23 || Number(mm) > 59) return null
  const instant = new Date(`${date}T${hh}:${mm}:00${ULAANBAATAR_OFFSET}`)
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString()
}

// Calendar date in Ulaanbaatar for a given instant, as YYYY-MM-DD.
export function ulaanbaatarDate(now: Date): string {
  return new Date(now.getTime() + ULAANBAATAR_OFFSET_MS).toISOString().slice(0, 10)
}

// "2026-10-20" + "09:00-11:00" -> "2026-10-20T09:00:00+08:00"
// Orders API (docs/l1-1-api.md §3.1) expects ISO-8601 with an explicit offset.
export function slotStartToUlaanbaatarIso(date: string, slot: string): string | null {
  if (slotStartToUtcIso(date, slot) === null) return null
  return `${date}T${slot.slice(0, 5)}:00${ULAANBAATAR_OFFSET}`
}
