import assert from 'node:assert/strict'
import { it } from 'node:test'

import { cancelOrder, getCancelTerms, parseCancellation, parseCancelTerms } from '../services/orders'
import { VALID_TOKEN, makeClient } from './helpers'

it('cancel terms: allowed with amounts, refused with a reason, junk rejected', () => {
  assert.deepEqual(
    parseCancelTerms({ terms: { allowed: true, paidMnt: 30000, refundPercent: 70, refundMnt: 21000, feeMnt: 9000, rule: 'LATE' } }),
    { allowed: true, paidMnt: 30000, refundPercent: 70, refundMnt: 21000, feeMnt: 9000, rule: 'LATE' },
  )
  assert.deepEqual(parseCancelTerms({ terms: { allowed: false, reason: 'Үйлчилгээ эхэлсэн' } }), {
    allowed: false,
    reason: 'Үйлчилгээ эхэлсэн',
  })
  assert.equal(parseCancelTerms({ terms: { allowed: true, paidMnt: 1, rule: 'LATE' } }), null)
  assert.equal(parseCancelTerms({ terms: { allowed: true, paidMnt: 1, refundPercent: 1, refundMnt: 1, feeMnt: 0, rule: 'X' } }), null)
  assert.equal(parseCancelTerms(null), null)
})

it('a cancelled order carries who cancelled and the refund state', () => {
  assert.deepEqual(
    parseCancellation({ at: '2026-10-25T01:00:00Z', by: 'ADMIN', reason: 'Сувилагч өвдсөн', refund: { id: 'r', percent: 100, amountMnt: 30000, status: 'MANUAL_REQUIRED' } }),
    { at: '2026-10-25T01:00:00Z', by: 'ADMIN', reason: 'Сувилагч өвдсөн', refund: { percent: 100, amountMnt: 30000, status: 'MANUAL_REQUIRED' } },
  )
  assert.equal(parseCancellation({ at: 'x', by: 'CLIENT', refund: { percent: 1, amountMnt: 1, status: 'WEIRD' } })?.refund, null)
  assert.equal(parseCancellation(null), null)
})

it('terms are read first, then the cancel sends the percent the customer saw', async () => {
  const h = makeClient(
    [
      { status: 200, body: { success: true, message: 'ok', data: { terms: { allowed: false, reason: 'no' } } } },
      { status: 409, body: { success: false, message: 'Цуцлалтын нөхцөл өөрчлөгдлөө', error: { code: 'CANCEL_TERMS_CHANGED' } } },
    ],
    { token: VALID_TOKEN },
  )
  const t = await getCancelTerms(h.client, 'o1')
  assert.ok(h.calls[0].url.endsWith('/api/orders/o1/cancellation'))
  assert.equal(t.ok && t.data.allowed, false)
  const r = await cancelOrder(h.client, 'o1', 70)
  assert.equal(h.calls[1].init.method, 'POST')
  assert.ok(h.calls[1].url.endsWith('/api/orders/o1/cancel'))
  assert.deepEqual(JSON.parse(h.calls[1].init.body ?? '{}'), { refundPercent: 70 })
  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.code, 'CANCEL_TERMS_CHANGED')
})
