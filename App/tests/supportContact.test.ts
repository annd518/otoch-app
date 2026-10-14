import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { hasSupportContact, parseSupportContact, parseSupportPhone, parseSupportUrl } from '../utils/supportContact'

describe('support contact comes only from configuration', () => {
  it('nothing configured means nothing shown (no invented contact)', () => {
    const c = parseSupportContact(undefined, '')
    assert.deepEqual(c, { phone: null, url: null })
    assert.equal(hasSupportContact(c), false)
  })

  it('accepts a dialable number and normalises it for tel:', () => {
    assert.equal(parseSupportPhone(' 7700-1234 '), '77001234')
    assert.equal(parseSupportPhone('+976 7700 1234'), '+97677001234')
  })

  it('refuses the emergency number, short codes and junk', () => {
    for (const bad of ['103', '105', '12345', 'call me', '7700;1234', '++97677001234', '1234567890123456'])
      assert.equal(parseSupportPhone(bad), null, bad)
  })

  it('accepts only https pages', () => {
    assert.equal(parseSupportUrl('https://help.example.mn/otoch'), 'https://help.example.mn/otoch')
    for (const bad of ['http://help.example.mn', 'javascript:alert(1)', 'https://', 'https://localhost', 'tel:77001234'])
      assert.equal(parseSupportUrl(bad), null, bad)
  })
})
