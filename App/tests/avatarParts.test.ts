import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_AVATAR,
  HAIR,
  SECTIONS,
  choicesFor,
  diceBearOptions,
  parseAvatar,
  randomAvatar,
  withPart,
} from '../utils/avatarParts'

describe('self-made avatar parts', () => {
  it('reads a saved avatar and treats anything else as no avatar', () => {
    assert.deepEqual(parseAvatar(DEFAULT_AVATAR.male), DEFAULT_AVATAR.male)
    assert.equal(parseAvatar(null), null)
    assert.equal(parseAvatar({ ...DEFAULT_AVATAR.male, v: 2 }), null)
    assert.equal(parseAvatar({ ...DEFAULT_AVATAR.male, gender: 'other' }), null)
  })

  it('an unknown part falls back to the default instead of breaking the drawing', () => {
    const a = parseAvatar({ ...DEFAULT_AVATAR.female, top: 'removedStyle', eyes: 'vomit' })
    assert.equal(a?.top, DEFAULT_AVATAR.female.top)
    assert.equal(a?.eyes, DEFAULT_AVATAR.female.eyes)
  })

  it('switching gender keeps fitting parts and drops a beard for female', () => {
    const bearded = { ...DEFAULT_AVATAR.male, top: 'shortCurly', facialHair: 'beardMedium', skinColor: '614335' }
    const f = withPart(bearded, 'gender', 'female')
    assert.equal(f.gender, 'female')
    assert.equal(f.facialHair, 'none')
    assert.equal(f.top, DEFAULT_AVATAR.female.top) // a male-only style is replaced
    assert.equal(f.skinColor, '614335') // the rest stays
    assert.deepEqual(choicesFor('facialHair', 'female').map((c) => c.value), ['none'])
  })

  it('a random avatar only uses offered parts for its gender', () => {
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 50; i++) {
      const a = randomAvatar(random)
      for (const s of SECTIONS)
        assert.ok(choicesFor(s.key, a.gender).some((c) => c.value === a[s.key]), `${s.key}=${a[s.key]}`)
    }
  })

  it('"none" parts are drawn with probability 0', () => {
    const o = diceBearOptions({ ...DEFAULT_AVATAR.male, top: 'none', facialHair: 'none', accessories: 'none' })
    assert.equal(o.topProbability, 0)
    assert.equal(o.facialHairProbability, 0)
    assert.equal(o.accessoriesProbability, 0)
    const b = diceBearOptions({ ...DEFAULT_AVATAR.male, facialHair: 'beardLight' })
    assert.equal(b.facialHairProbability, 100)
    assert.deepEqual(b.facialHair, ['beardLight'])
    assert.ok(HAIR.male.some((c) => c.value === 'none'))
  })
})
