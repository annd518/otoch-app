import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { EMPTY_DETAILS, INITIAL_DRAFT, validateDetails, type BookingDraftState } from '../services/bookingDraft'
import { earliestStartOn, startAllowed } from '../utils/calendar'
import { expiryFromInput, expiryProblem, formatDateInput } from '../utils/medicationStep'

// 2026-10-16 15:12 in Ulaanbaatar (+08:00)
const now = new Date('2026-10-16T15:12:30+08:00')

describe('booking time: at least 2 hours from now, never in the past', () => {
  it('a start is allowed only from now + 2h', () => {
    assert.equal(startAllowed('2026-10-16', '17:12', now), false, '17:12:00 is 30 s short')
    assert.equal(startAllowed('2026-10-16', '17:13', now), true)
    assert.equal(startAllowed('2026-10-16', '16:00', now), false)
    assert.equal(startAllowed('2026-10-16', '09:00', now), false, 'earlier today')
    assert.equal(startAllowed('2026-10-15', '20:00', now), false, 'yesterday')
    assert.equal(startAllowed('2026-10-17', '00:00', now), true)
    assert.equal(startAllowed('2026-02-30', '10:00', now), false)
  })

  it('earliest start per day: today from 17:13, tomorrow any time', () => {
    assert.equal(earliestStartOn('2026-10-16', now), '17:13')
    assert.equal(earliestStartOn('2026-10-17', now), null)
    assert.equal(earliestStartOn('2026-10-15', now), '24:00')
  })

  it('late evening: nothing left today, tomorrow starts after midnight + 2h', () => {
    const late = new Date('2026-10-16T22:30:00+08:00')
    assert.equal(earliestStartOn('2026-10-16', late), '24:00')
    assert.equal(earliestStartOn('2026-10-17', late), '00:30')
  })

  it('the booking form refuses a slot under 2 hours away', () => {
    const state = (date: string, timeSlot: string): BookingDraftState => ({
      ...INITIAL_DRAFT,
      details: { ...EMPTY_DETAILS, parentId: 'p1', addressText: 'Улаанбаатар 1-р хороо', date, timeSlot },
    })
    assert.equal(validateDetails(state('2026-10-16', '16:00-17:00'), now).timeSlot, 'Одоогоос хамгийн багадаа 2 цагийн дараах цаг сонгоно уу')
    assert.equal(validateDetails(state('2026-10-16', '10:00-11:00'), now).timeSlot, 'Сонгосон цаг өнгөрсөн байна')
    assert.equal(validateDetails(state('2026-10-16', '18:00-19:00'), now).timeSlot, undefined)
  })
})

describe('medicine expiry date field', () => {
  it('accepts digits only and adds the dashes while typing', () => {
    assert.equal(formatDateInput('2'), '2')
    assert.equal(formatDateInput('20271'), '2027-1')
    assert.equal(formatDateInput('20270315'), '2027-03-15')
    assert.equal(formatDateInput('2027-03-15'), '2027-03-15')
    assert.equal(formatDateInput('2027/03/1599'), '2027-03-15')
  })

  it('stores a date only once it is complete and real (no "T" leaking into the field)', () => {
    assert.equal(expiryFromInput('2027-03'), '')
    assert.equal(expiryFromInput('2027-02-30'), '')
    assert.equal(expiryFromInput('2027-03-15'), '2027-03-15T23:59:59+08:00')
  })

  it('says when the medicine has expired or expires before the visit', () => {
    const visit = Date.parse('2026-10-20T09:00:00+08:00')
    assert.equal(expiryProblem('2027-0', visit, now), null, 'still typing')
    assert.equal(expiryProblem('2027-13-01', visit, now), 'Огноо буруу байна. Жишээ нь: 2027-03-15')
    assert.equal(expiryProblem('2026-10-01', visit, now), 'Эмийн хугацаа дууссан байна.')
    assert.equal(expiryProblem('2026-10-18', visit, now), 'Эмийн хугацаа үйлчилгээний өдрөөс өмнө дуусна.')
    assert.equal(expiryProblem('2026-10-16', NaN, now), null, 'today is still valid until midnight')
    assert.equal(expiryProblem('2027-03-15', visit, now), null)
  })
})
