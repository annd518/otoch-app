import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { BookingForm, CatalogService } from '../services/apiTypes'
import {
  INITIAL_DRAFT,
  bookingDraftReducer,
  type BookingDraftAction,
  type BookingDraftState,
} from '../services/bookingDraft'
import { DRAFT_MAX_AGE_MS, fromPersistedDraft, toPersistedDraft } from '../services/draftPersistence'

const SERVICE: CatalogService = {
  id: 'svc_s01',
  code: 'S01',
  name: 'Гэрийн үзлэг (тест)',
  description: '',
  category: 'HOME_VISIT',
  priceMnt: 45000,
  durationMin: 60,
  requiresReferral: false,
  redFlagQuestionnaire: 'V2',
  isActive: true,
  isFixture: true,
}
const FORM: BookingForm = {
  consent: { service: true, sensitiveData: true, signer: 'RECIPIENT', version: 'V2_2026_10', acceptedAt: '2026-10-14T01:00:00Z' },
  familyPresent: true,
  postoperative: false,
  medication: { name: 'Эм (тест)', dose: '1', route: 'IV', expiresAt: '2027-01-01', doseNumber: 2 },
}
const NOW = new Date('2026-10-14T02:00:00Z') // 10:00 in Ulaanbaatar
const USER = 'user_a'

function apply(...actions: BookingDraftAction[]): BookingDraftState {
  return actions.reduce(bookingDraftReducer, INITIAL_DRAFT)
}

const filled = apply(
  { type: 'selectService', service: SERVICE, catalogVersion: 'cat-1', source: 'real' },
  {
    type: 'updateDetails',
    patch: {
      parentId: 'parent_1', parentName: 'Д. Цэцэг', addressText: 'Улаанбаатар, 1-р хороо, 5-р байр',
      zoneId: 'zone_1', lat: 47.91, lng: 106.92, date: '2026-10-16', timeSlot: '09:00-10:00',
      notes: 'Эмзэг тэмдэглэл', bookingForm: FORM,
    },
  },
)

// What survives a JSON round trip through AsyncStorage
const roundTrip = (state: BookingDraftState, at = NOW): unknown =>
  JSON.parse(JSON.stringify(toPersistedDraft(state, USER, at.getTime())))

describe('unsaved booking draft survives an app restart', () => {
  it('keeps service, patient, address, zone, point, date and time', () => {
    const restored = fromPersistedDraft(roundTrip(filled), USER, NOW)
    assert.ok(restored)
    // undefined keys (formConfig) do not survive JSON, the values do
    assert.deepEqual(restored.service, JSON.parse(JSON.stringify(filled.service)))
    assert.equal(restored.details.parentId, 'parent_1')
    assert.equal(restored.details.addressText, 'Улаанбаатар, 1-р хороо, 5-р байр')
    assert.equal(restored.details.zoneId, 'zone_1')
    assert.equal(restored.details.lat, 47.91)
    assert.equal(restored.details.lng, 106.92)
    assert.equal(restored.details.date, '2026-10-16')
    assert.equal(restored.details.timeSlot, '09:00-10:00')
    assert.equal(restored.dirty, true)
    assert.equal(restored.server, null)
    assert.equal(restored.pendingCreate, null)
  })

  it('never writes health data or notes to the device', () => {
    const raw = JSON.stringify(toPersistedDraft(filled, USER, NOW.getTime()))
    for (const secret of ['bookingForm', 'medication', 'Эм (тест)', 'consent', 'Эмзэг тэмдэглэл', 'notes'])
      assert.equal(raw.includes(secret), false, secret)
    const restored = fromPersistedDraft(JSON.parse(raw), USER, NOW)
    assert.equal(restored?.details.bookingForm, undefined)
    assert.equal(restored?.details.notes, '')
  })

  it('keeps nothing once the server has the draft (resumed from "Захиалга")', () => {
    const saved: BookingDraftState = {
      ...filled,
      server: {
        orderId: 'order_1', version: 1, status: 'DRAFT', parentId: 'parent_1', serviceCode: 'S01',
        ignoredFields: [], referralUploadAvailable: null, source: 'real',
      },
    }
    assert.equal(toPersistedDraft(saved, USER, NOW.getTime()), null)
  })

  it('keeps nothing for a red flag block or an empty draft', () => {
    const blocked = bookingDraftReducer(filled, { type: 'redFlagBlocked', advice: null })
    assert.equal(toPersistedDraft(blocked, USER, NOW.getTime()), null)
    assert.equal(toPersistedDraft(INITIAL_DRAFT, USER, NOW.getTime()), null)
  })

  it("another account never gets this user's draft", () => {
    assert.equal(fromPersistedDraft(roundTrip(filled), 'user_b', NOW), null)
  })

  it('drops drafts older than 7 days, from the future, or malformed', () => {
    const old = new Date(NOW.getTime() - DRAFT_MAX_AGE_MS - 1)
    assert.equal(fromPersistedDraft(roundTrip(filled, old), USER, NOW), null)
    const future = new Date(NOW.getTime() + 60_000)
    assert.equal(fromPersistedDraft(roundTrip(filled, future), USER, NOW), null)
    for (const bad of [null, 'x', [], { v: 2 }, { ...(roundTrip(filled) as object), service: { id: 1 } }])
      assert.equal(fromPersistedDraft(bad, USER, NOW), null)
  })

  it('a date that has passed is cleared with its time, the rest stays', () => {
    const later = new Date('2026-10-17T02:00:00Z')
    const restored = fromPersistedDraft(roundTrip(filled), USER, later)
    assert.equal(restored?.details.date, '')
    assert.equal(restored?.details.timeSlot, '')
    assert.equal(restored?.details.addressText, 'Улаанбаатар, 1-р хороо, 5-р байр')
  })

  it('restoring never overwrites a booking the user already started', () => {
    const restored = fromPersistedDraft(roundTrip(filled), USER, NOW)
    assert.ok(restored)
    assert.equal(bookingDraftReducer(INITIAL_DRAFT, { type: 'hydrate', state: restored }), restored)
    const started = apply({ type: 'selectService', service: { ...SERVICE, id: 'svc_s02', code: 'S02' }, catalogVersion: 'cat-1', source: 'real' })
    assert.equal(bookingDraftReducer(started, { type: 'hydrate', state: restored }), started)
  })
})
