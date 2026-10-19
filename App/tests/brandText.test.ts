import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { brandLabel, brandSize } from '../utils/brand'

describe('ОТОЧ wordmark in texts', () => {
  it('screen readers hear ОТОЧ (Cyrillic) where the wordmark is drawn', () => {
    assert.equal(brandLabel('OTOCH-д нэвтрэх'), 'ОТОЧ-д нэвтрэх')
    assert.equal(brandLabel('OTOCH нь OTOCH'), 'ОТОЧ нь ОТОЧ')
    assert.equal(brandLabel('Сувилагч дуудах'), 'Сувилагч дуудах')
  })

  it('the inline wordmark keeps its 654:183 shape and follows the font size', () => {
    assert.deepEqual(brandSize(25), { width: 79, height: 22 })
    assert.deepEqual(brandSize(18), { width: 54, height: 15 })
    const { width, height } = brandSize(12)
    assert.ok(Math.abs(width / height - 654 / 183) < 0.4)
  })
})
