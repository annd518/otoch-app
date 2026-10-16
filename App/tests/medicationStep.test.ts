import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { BookingForm } from '../services/apiTypes'
import { INITIAL_DRAFT, hasReferralInput, medicationPhotoChosen, needsReferral, type BookingDraftState, type LocalAttachment } from '../services/bookingDraft'
import { parseOrder } from '../services/orders'
import { medicationMissing } from '../utils/medicationStep'

const scheduledAt = Date.parse('2026-10-20T09:00:00+08:00')
const later = '2026-12-31T23:59:59+08:00'
const rules = { required: true, firstDoseCheck: true, scheduledAt }
const empty = { name: '', dose: '', route: '', expiresAt: '', doseNumber: 1 }
const form = (over: Partial<BookingForm> = {}): BookingForm => ({
  consent: { service: true, sensitiveData: true, version: 'V2_2026_10', acceptedAt: '2026-10-16T00:00:00.000Z' },
  familyPresent: false,
  postoperative: false,
  medication: null,
  ...over,
})

describe('step 3: medicine by photo or typed (one must be chosen)', () => {
  it('a required medicine needs a choice first', () => {
    assert.deepEqual(medicationMissing(form(), rules), ['оруулах арга (зураг эсвэл гараар)'])
    assert.deepEqual(medicationMissing(form({ medication: empty }), rules), ['оруулах арга (зураг эсвэл гараар)'])
  })

  it('optional medicine not entered: nothing to choose', () => {
    assert.deepEqual(medicationMissing(form(), { ...rules, required: false }), [])
  })

  it('typed: name, dose, route, expiry and dose number', () => {
    assert.deepEqual(medicationMissing(form({ medicationSource: 'TEXT', medication: empty }), rules), [
      'эмийн нэр',
      'тун',
      'хэрэглэх арга',
      'хугацаа дуусах огноо',
      'хэд дэх тун (2+)',
    ])
    const full = { name: 'Эм', dose: '1', route: 'Арга', expiresAt: later, doseNumber: 2 }
    assert.deepEqual(medicationMissing(form({ medicationSource: 'TEXT', medication: full }), rules), [])
  })

  it('photo: no name/dose/route, but expiry and dose number are still asked', () => {
    assert.deepEqual(medicationMissing(form({ medicationSource: 'PHOTO', medication: empty }), rules), [
      'хугацаа дуусах огноо',
      'хэд дэх тун (2+)',
    ])
    assert.deepEqual(
      medicationMissing(form({ medicationSource: 'PHOTO', medication: { ...empty, expiresAt: '2026-10-19T23:59:59+08:00', doseNumber: 2 } }), rules),
      ['үйлчилгээний өдрөөс хойш дуусах хугацаа'],
    )
    assert.deepEqual(medicationMissing(form({ medicationSource: 'PHOTO', medication: { ...empty, expiresAt: later, doseNumber: 2 } }), rules), [])
  })

  it('photo chosen: the referral step is required and only a photo satisfies it', () => {
    const photo: LocalAttachment = {
      localId: 'l1', uri: 'file:///a.jpg', name: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 1,
      status: 'uploaded', progress: 1, serverId: 'att_1', error: null,
    }
    const state = (attachments: LocalAttachment[] = []): BookingDraftState => ({
      ...INITIAL_DRAFT,
      details: {
        ...INITIAL_DRAFT.details,
        bookingForm: form({ medicationSource: 'PHOTO', medication: empty, referralText: 'Туршилтын жор: эмийн нэр, тун' }),
      },
      attachments,
    })
    assert.equal(medicationPhotoChosen(state()), true)
    assert.equal(needsReferral(state()), true)
    assert.equal(hasReferralInput(state()), false, 'typed text is not enough')
    assert.equal(hasReferralInput(state([photo])), true)
  })

  it('the choice survives resuming the draft from the server', () => {
    const order = parseOrder({ order: { id: 'o1', status: 'DRAFT', version: 2, parentId: 'p1', bookingForm: form({ medicationSource: 'PHOTO', medication: empty }) } })
    assert.equal(order?.bookingForm?.medicationSource, 'PHOTO')
    const bad = parseOrder({ order: { id: 'o1', status: 'DRAFT', version: 2, parentId: 'p1', bookingForm: { ...form({ medication: empty }), medicationSource: 'FAX' } } })
    assert.equal(bad?.bookingForm?.medicationSource, undefined)
  })
})
