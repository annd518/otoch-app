// Dispatch offers and the nurse profile (server/src/routes/nurseOffers.ts).
// Pure: takes an HttpClient, no React Native imports.
import { API_PATHS } from '../config/api'
import { isRecord, type ApiResult } from './apiResult'
import type { HttpClient } from './httpClient'
import { parseStaffOrderEnvelope, type StaffOrder } from './staffOrders'

export interface Offer {
  id: string
  wave: number
  expiresAt: string
  // Seconds left when the list was fetched. Use remainingSeconds() so a phone with a
  // wrong clock still counts down correctly.
  secondsLeft: number
  items: { serviceCode: string; name: string; quantity: number }[]
  scheduledFor: string | null
  timeSlot: string | null
  area: string | null
  earnings: { nurseShareMnt: number; sharePercent: number; isFixture: boolean } | null
}

export interface NurseProfile {
  status: 'PENDING' | 'VERIFIED' | 'SUSPENDED'
  isActive: boolean
  licenseNo: string | null
  licenseExpiresAt: string | null
  skillTags: string[]
  // Why the nurse cannot go online; null when they can.
  blocker: string | null
}

const text = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const optText = (v: unknown): string | null => (text(v) ? v : null)

function parseOffer(value: unknown): Offer | null {
  if (!isRecord(value) || !text(value.id) || !text(value.expiresAt) || !isRecord(value.order)) return null
  const order = value.order
  const items: Offer['items'] = []
  if (Array.isArray(order.items)) {
    for (const raw of order.items) {
      if (!isRecord(raw) || !text(raw.serviceCode) || !text(raw.name)) return null
      items.push({ serviceCode: raw.serviceCode, name: raw.name, quantity: typeof raw.quantity === 'number' ? raw.quantity : 1 })
    }
  }
  const e = value.earnings
  return {
    id: value.id,
    wave: typeof value.wave === 'number' ? value.wave : 1,
    expiresAt: value.expiresAt,
    secondsLeft: typeof value.secondsLeft === 'number' ? Math.max(0, value.secondsLeft) : 0,
    items,
    scheduledFor: optText(order.scheduledFor),
    timeSlot: optText(order.timeSlot),
    area: optText(order.area),
    earnings:
      isRecord(e) && typeof e.nurseShareMnt === 'number'
        ? {
            nurseShareMnt: e.nurseShareMnt,
            sharePercent: typeof e.sharePercent === 'number' ? e.sharePercent : 70,
            isFixture: e.isFixture === true,
          }
        : null,
  }
}

export function parseOffers(data: unknown): Offer[] | null {
  if (!isRecord(data) || !Array.isArray(data.offers)) return null
  const offers: Offer[] = []
  for (const raw of data.offers) {
    const offer = parseOffer(raw)
    if (!offer) return null
    offers.push(offer)
  }
  return offers
}

export function parseProfileEnvelope(data: unknown): { profile: NurseProfile | null } | null {
  if (!isRecord(data) || !('profile' in data)) return null
  const p = data.profile
  if (p === null) return { profile: null }
  if (!isRecord(p) || (p.status !== 'PENDING' && p.status !== 'VERIFIED' && p.status !== 'SUSPENDED')) return null
  return {
    profile: {
      status: p.status,
      isActive: p.isActive === true,
      licenseNo: optText(p.licenseNo),
      licenseExpiresAt: optText(p.licenseExpiresAt),
      skillTags: Array.isArray(p.skillTags) ? p.skillTags.filter((t): t is string => typeof t === 'string') : [],
      blocker: optText(p.blocker),
    },
  }
}

// Seconds left now, from the server's `secondsLeft` and the local time elapsed since
// that answer arrived (not the phone's wall clock).
export function remainingSeconds(offer: Pick<Offer, 'secondsLeft'>, fetchedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil(offer.secondsLeft - (nowMs - fetchedAtMs) / 1000))
}

export const formatCountdown = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export const fetchOffers = (client: HttpClient): Promise<ApiResult<Offer[]>> =>
  client.request({ method: 'GET', path: API_PATHS.nurse.offers, parse: parseOffers })

export const acceptOffer = (client: HttpClient, id: string): Promise<ApiResult<StaffOrder>> =>
  client.request({ method: 'POST', path: API_PATHS.nurse.accept(id), body: {}, parse: parseStaffOrderEnvelope })

// The server answers data: null; the parser must still return a non-null value.
export const declineOffer = (client: HttpClient, id: string): Promise<ApiResult<true>> =>
  client.request({ method: 'POST', path: API_PATHS.nurse.decline(id), body: {}, parse: () => true as const })

export const fetchProfile = (client: HttpClient) =>
  client.request({ method: 'GET', path: API_PATHS.nurse.me, parse: parseProfileEnvelope })

export const setOnline = (client: HttpClient, isActive: boolean) =>
  client.request({ method: 'PUT', path: API_PATHS.nurse.me, body: { isActive }, parse: parseProfileEnvelope })
