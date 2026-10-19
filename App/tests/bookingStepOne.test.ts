import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { missingForStepOne } from '../utils/bookingStepOne'

const complete = { addressText: 'Улаанбаатар, 1-р хороо', zoneId: 'Z', lat: 47.9, lng: 106.9, date: '2026-10-14', timeSlot: '09:00-11:00' }

describe('booking step 1 says what is missing', () => {
  it('nothing missing when every field is set', () => {
    assert.deepEqual(missingForStepOne(complete), [])
  })

  it('lists each missing item in screen order', () => {
    assert.deepEqual(missingForStepOne({ addressText: '  ab ' }), [
      'дэлгэрэнгүй хаяг (5+ тэмдэгт)',
      'газрын зураг дээрх цэг',
      'огноо',
      'цаг',
    ])
  })

  it('the zone follows the map point: a point outside every zone is named', () => {
    assert.deepEqual(missingForStepOne({ ...complete, zoneId: undefined }), ['үйлчилгээний бүс доторх цэг'])
  })

  it('a map point needs both coordinates (0 is a valid number)', () => {
    assert.deepEqual(missingForStepOne({ ...complete, lng: undefined }), ['газрын зураг дээрх цэг'])
    assert.deepEqual(missingForStepOne({ ...complete, lat: 0, lng: 0 }), [])
  })

  it('blocks in the same cases as the previous disabled condition', () => {
    for (const d of [
      complete,
      { ...complete, timeSlot: '' },
      { ...complete, zoneId: undefined },
      { ...complete, lat: undefined },
      { ...complete, addressText: 'abcd' },
    ]) {
      const oldDisabled = !d.timeSlot || !d.zoneId || d.lat === undefined || d.lng === undefined || d.addressText.trim().length < 5
      assert.equal(missingForStepOne(d).length > 0, oldDisabled)
    }
  })
})
