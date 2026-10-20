import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { missingForStepOne } from '../utils/bookingStepOne'

const complete = {
  addressText: 'Баянзүрх дүүрэг, 5-р хороо, 12-р байр, 45 тоот',
  zoneId: 'Z',
  lat: 47.9,
  lng: 106.9,
  date: '2026-10-14',
  timeSlot: '09:00-11:00',
}

describe('booking step 1 says what is missing', () => {
  it('nothing missing when every field is set', () => {
    assert.deepEqual(missingForStepOne(complete), [])
  })

  it('lists each missing item in screen order', () => {
    assert.deepEqual(missingForStepOne({ addressText: '' }), [
      'дүүрэг',
      'хороо',
      'дэлгэрэнгүй хаяг (байр, тоот)',
      'газрын зураг дээрх цэг',
      'огноо',
      'цаг',
    ])
  })

  it('district, then khoroo, then the details', () => {
    assert.deepEqual(missingForStepOne({ ...complete, addressText: 'Баянзүрх дүүрэг' }), ['хороо', 'дэлгэрэнгүй хаяг (байр, тоот)'])
    assert.deepEqual(missingForStepOne({ ...complete, addressText: 'Баянзүрх дүүрэг, 5-р хороо' }), ['дэлгэрэнгүй хаяг (байр, тоот)'])
    assert.deepEqual(missingForStepOne({ ...complete, addressText: 'Баянзүрх дүүрэг, 5-р хороо, ab' }), ['дэлгэрэнгүй хаяг (байр, тоот)'])
    // an address typed before the district list: district and khoroo still to choose
    assert.deepEqual(missingForStepOne({ ...complete, addressText: 'Улаанбаатар, 1-р хороо' }), ['дүүрэг', 'хороо'])
  })

  it('the zone follows the map point: a point outside every zone is named', () => {
    assert.deepEqual(missingForStepOne({ ...complete, zoneId: undefined }), ['үйлчилгээний бүс доторх цэг'])
  })

  it('a map point needs both coordinates (0 is a valid number)', () => {
    assert.deepEqual(missingForStepOne({ ...complete, lng: undefined }), ['газрын зураг дээрх цэг'])
    assert.deepEqual(missingForStepOne({ ...complete, lat: 0, lng: 0 }), [])
  })
})
