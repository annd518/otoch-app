import assert from 'node:assert/strict'
import { it } from 'node:test'

import { devMockPay } from '../services/payment'
import { VALID_TOKEN, makeClient } from './helpers'

it('dev mock pay posts to the mock-only route; a 404 (not mock mode) is an error', async () => {
  const ok = makeClient([{ status: 200, body: { success: true, message: 'ok', data: { mockPaid: true } } }], { token: VALID_TOKEN })
  const r = await devMockPay(ok.client, 'o 1', 'p1')
  assert.equal(r.ok, true)
  assert.equal(ok.calls[0].init.method, 'POST')
  assert.ok(ok.calls[0].url.endsWith('/api/dev/qpay-mock/orders/o%201/payments/p1/pay'))

  const off = makeClient([{ status: 404, body: { success: false, message: 'Хүссэн зам олдсонгүй', error: { code: 'NOT_FOUND' } } }], { token: VALID_TOKEN })
  const r2 = await devMockPay(off.client, 'o1', 'p1')
  assert.equal(r2.ok, false)
})
