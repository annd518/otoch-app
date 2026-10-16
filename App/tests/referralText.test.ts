import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { BookingForm } from '../services/apiTypes'
import {
  INITIAL_DRAFT,
  MIN_REFERRAL_TEXT,
  hasReferralInput,
  planDraftSave,
  referralTextOk,
  type BookingDraftState,
  type LocalAttachment,
} from '../services/bookingDraft'
import { parseOrder } from '../services/orders'

const form = (referralText?: string | null): BookingForm => ({
  consent: { service: true, sensitiveData: true, version: 'V2_2026_10', acceptedAt: '2026-10-16T00:00:00.000Z' },
  familyPresent: false,
  postoperative: false,
  medication: null,
  ...(referralText !== undefined && { referralText }),
})

const photo: LocalAttachment = {
  localId: 'l1', uri: 'file:///a.jpg', name: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 1,
  status: 'uploaded', progress: 1, serverId: 'att_1', error: null,
}

const withReferral = (referralText?: string | null, attachments: LocalAttachment[] = []): BookingDraftState => ({
  ...INITIAL_DRAFT,
  details: { ...INITIAL_DRAFT.details, bookingForm: form(referralText) },
  attachments,
})

describe('prescription: photo or typed text', () => {
  it('typed text counts from 10 characters, ignoring surrounding spaces (same rule as the server)', () => {
    assert.equal(MIN_REFERRAL_TEXT, 10)
    assert.equal(referralTextOk('123456789'), false)
    assert.equal(referralTextOk('   123456789   '), false)
    assert.equal(referralTextOk('1234567890'), true)
    assert.equal(referralTextOk(null), false)
    assert.equal(referralTextOk(undefined), false)
  })

  it('either an uploaded photo or the text satisfies the requirement; neither does not', () => {
    assert.equal(hasReferralInput(withReferral()), false)
    assert.equal(hasReferralInput(withReferral('богино')), false)
    assert.equal(hasReferralInput(withReferral('Туршилтын жор: эмийн нэр, тун')), true)
    assert.equal(hasReferralInput(withReferral(null, [photo])), true)
    assert.equal(hasReferralInput(withReferral(null, [{ ...photo, status: 'failed' }])), false)
  })

  it('the draft PATCH carries the text inside bookingForm', () => {
    const state: BookingDraftState = {
      ...withReferral('Туршилтын жор: эмийн нэр, тун'),
      service: {
        id: 'id_S01', code: 'S01', name: 'S01', priceMnt: 1, durationMin: 60, requiresReferral: true,
        catalogVersion: 'v1', isFixture: false, source: 'real',
      },
      details: {
        ...withReferral('Туршилтын жор: эмийн нэр, тун').details,
        parentId: 'p1', parentName: 'P', addressText: 'Улаанбаатар 1-р хороо', date: '2026-10-20', timeSlot: '09:00-11:00',
      },
      server: {
        orderId: 'o1', version: 3, status: 'DRAFT', parentId: 'p1', serviceCode: 'S01', catalogVersion: 'v1',
        ignoredFields: [], referralUploadAvailable: true, source: 'real',
      },
      dirty: true,
    }
    const plan = planDraftSave(state, () => 'k')
    assert.equal(plan.kind, 'update')
    if (plan.kind !== 'update') return
    assert.equal(plan.patch.bookingForm?.referralText, 'Туршилтын жор: эмийн нэр, тун')
  })

  it('a saved draft keeps the typed text when it is resumed from the server', () => {
    const order = parseOrder({ order: { id: 'o1', status: 'DRAFT', version: 2, parentId: 'p1', bookingForm: form('Туршилтын жор: эмийн нэр, тун') } })
    assert.ok(order)
    assert.equal(order?.bookingForm?.referralText, 'Туршилтын жор: эмийн нэр, тун')
    const without = parseOrder({ order: { id: 'o1', status: 'DRAFT', version: 2, parentId: 'p1', bookingForm: form() } })
    assert.equal(without?.bookingForm?.referralText, undefined)
  })
})
