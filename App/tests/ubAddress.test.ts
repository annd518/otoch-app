import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { UB_DISTRICTS, composeAddress, khorooCount, parseAddress } from '../utils/ubAddress'

describe('Ulaanbaatar address: district -> khoroo -> details', () => {
  it('nine districts, 204 khoroo in total', () => {
    assert.equal(UB_DISTRICTS.length, 9)
    assert.equal(UB_DISTRICTS.reduce((s, d) => s + d.khoroo, 0), 204)
    assert.equal(khorooCount('Сонгинохайрхан'), 43)
    assert.equal(khorooCount('Багахангай'), 2)
    assert.equal(khorooCount('Мөрөн'), 0)
  })

  it('composes the one address text the order stores', () => {
    assert.equal(
      composeAddress({ district: 'Хан-Уул', khoroo: 11, detail: '3-р байр, 45 тоот, орцны код 1234' }),
      'Хан-Уул дүүрэг, 11-р хороо, 3-р байр, 45 тоот, орцны код 1234',
    )
    assert.equal(composeAddress({ district: 'Хан-Уул', detail: '' }), 'Хан-Уул дүүрэг')
    assert.equal(composeAddress({ district: 'Хан-Уул', khoroo: 2, detail: '' }), 'Хан-Уул дүүрэг, 2-р хороо')
    assert.equal(composeAddress({ khoroo: 2, detail: 'x' }), 'x', 'no khoroo without a district')
  })

  it('reads it back while typing, including trailing separators', () => {
    for (const parts of [
      { district: 'Баянгол' as const, khoroo: 34, detail: '1-р байр' },
      { district: 'Баянгол' as const, khoroo: 1, detail: '' },
      { district: 'Баянгол' as const, detail: '' },
      { district: 'Сүхбаатар' as const, khoroo: 20, detail: '12-р байр, ' },
    ])
      assert.deepEqual(parseAddress(composeAddress(parts)), parts)
  })

  it('an older free-text address becomes the details; impossible khoroo is not taken', () => {
    assert.deepEqual(parseAddress('Улаанбаатар, 1-р хороо'), { detail: 'Улаанбаатар, 1-р хороо' })
    assert.deepEqual(parseAddress('Багахангай дүүрэг, 5-р хороо, байр'), { district: 'Багахангай', detail: '5-р хороо, байр' })
    assert.deepEqual(parseAddress('Баянголын эмнэлэг'), { detail: 'Баянголын эмнэлэг' })
    assert.deepEqual(parseAddress(''), { detail: '' })
  })
})
