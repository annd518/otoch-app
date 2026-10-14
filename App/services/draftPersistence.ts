// Keeps the unsaved part of a booking across an app restart.
//
// Only the step 1 choices are kept: service, patient reference, address, zone,
// map point, date and time. Health data in bookingForm (consent, medication,
// family, referral answers) and free-text notes are never written to the
// device. Once the server has the draft, "Захиалга" resumes it from the server
// instead (app/orders/[id].tsx), so nothing is kept locally after that.
import type { ApiMode } from '../utils/apiConfig'
import { ulaanbaatarDate } from '../utils/datetime'
import {
  EMPTY_DETAILS,
  INITIAL_DRAFT,
  isBlocked,
  type BookingDraftState,
  type SelectedService,
} from './bookingDraft'

export const DRAFT_PERSIST_VERSION = 1
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export interface PersistedDraft {
  v: typeof DRAFT_PERSIST_VERSION
  userId: string
  savedAt: number
  service: SelectedService
  details: {
    parentId: string | null
    parentName: string
    addressText: string
    zoneId?: string
    lat?: number
    lng?: number
    date: string
    timeSlot: string
  }
}

// null means "nothing worth keeping": no service yet, already on the server,
// or stopped by a red flag (that state is kept by utils/pendingBlocks + server).
export function toPersistedDraft(
  state: BookingDraftState,
  userId: string,
  nowMs: number,
): PersistedDraft | null {
  if (!state.service || state.server || isBlocked(state)) return null
  const d = state.details
  return {
    v: DRAFT_PERSIST_VERSION,
    userId,
    savedAt: nowMs,
    service: state.service,
    details: {
      parentId: d.parentId,
      parentName: d.parentName,
      addressText: d.addressText,
      ...(d.zoneId !== undefined && { zoneId: d.zoneId }),
      ...(d.lat !== undefined && { lat: d.lat }),
      ...(d.lng !== undefined && { lng: d.lng }),
      date: d.date,
      timeSlot: d.timeSlot,
    },
  }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const optional = <T>(v: unknown, check: (x: unknown) => x is T): v is T | undefined =>
  v === undefined || check(v)
const isMode = (v: unknown): v is ApiMode => v === 'real' || v === 'mock'

function parseService(v: unknown): SelectedService | null {
  if (!isObj(v)) return null
  const { id, code, name, priceMnt, durationMin, requiresReferral, catalogVersion, isFixture, source, formConfig } = v
  if (
    !isStr(id) || !isStr(code) || !isStr(name) || !isNum(priceMnt) || !isNum(durationMin) ||
    typeof requiresReferral !== 'boolean' || !(catalogVersion === null || isStr(catalogVersion)) ||
    typeof isFixture !== 'boolean' || !isMode(source) || !(formConfig === undefined || isObj(formConfig))
  )
    return null
  return {
    id, code, name, priceMnt, durationMin, requiresReferral, catalogVersion, isFixture, source,
    ...(formConfig !== undefined && { formConfig: formConfig as SelectedService['formConfig'] }),
  }
}

// Validates what came back from storage. Anything unexpected, another user's
// draft, or a draft older than DRAFT_MAX_AGE_MS is dropped. A date that has
// already passed is cleared (with its time) so the user picks a new one; the
// server checks availability again when the draft is saved.
export function fromPersistedDraft(raw: unknown, userId: string, now: Date): BookingDraftState | null {
  if (!isObj(raw) || raw.v !== DRAFT_PERSIST_VERSION || raw.userId !== userId || !isNum(raw.savedAt)) return null
  const age = now.getTime() - raw.savedAt
  if (age < 0 || age > DRAFT_MAX_AGE_MS) return null
  const service = parseService(raw.service)
  const d = raw.details
  if (!service || !isObj(d)) return null
  if (
    !(d.parentId === null || isStr(d.parentId)) || !isStr(d.parentName) || !isStr(d.addressText) ||
    !optional(d.zoneId, isStr) || !optional(d.lat, isNum) || !optional(d.lng, isNum) ||
    !isStr(d.date) || !isStr(d.timeSlot)
  )
    return null
  const past = d.date !== '' && d.date < ulaanbaatarDate(now)
  return {
    ...INITIAL_DRAFT,
    service,
    details: {
      ...EMPTY_DETAILS,
      parentId: d.parentId,
      parentName: d.parentName,
      addressText: d.addressText,
      ...(d.zoneId !== undefined && { zoneId: d.zoneId }),
      ...(d.lat !== undefined && { lat: d.lat }),
      ...(d.lng !== undefined && { lng: d.lng }),
      date: past ? '' : d.date,
      timeSlot: past ? '' : d.timeSlot,
    },
    dirty: true,
  }
}
