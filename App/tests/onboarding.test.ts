import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { EMERGENCY_NOTICE, ONBOARDING_SLIDES, pageAt } from '../design/onboarding'

describe('onboarding', () => {
  it('keeps the three existing texts and the 103 notice', () => {
    assert.deepEqual(
      ONBOARDING_SLIDES.map((s) => s.title),
      ['Сувилахуйн тусламжийг гэртээ', 'Аюулгүй байдлаа эхэлж шалгана', 'Захиалгын явцаа хянаарай'],
    )
    assert.match(EMERGENCY_NOTICE, /103/)
  })

  it('page from the swipe position, clamped to the slides', () => {
    assert.equal(pageAt(0, 390, 3), 0)
    assert.equal(pageAt(390, 390, 3), 1)
    assert.equal(pageAt(560, 390, 3), 1)
    assert.equal(pageAt(600, 390, 3), 2)
    assert.equal(pageAt(5000, 390, 3), 2)
    assert.equal(pageAt(-40, 390, 3), 0)
    assert.equal(pageAt(100, 0, 3), 0)
  })
})
