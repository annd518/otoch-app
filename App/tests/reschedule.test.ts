import assert from 'node:assert/strict'
import { it } from 'node:test'

import { REBOOKABLE, RESCHEDULABLE, rescheduleOrder } from '../services/orders'
import { VALID_TOKEN, makeClient } from './helpers'

it('only paid orders move; finished or stopped ones are booked again', () => {
  assert.deepEqual(RESCHEDULABLE, ['PAID', 'ASSIGNED'])
  for (const s of ['COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW']) assert.ok(REBOOKABLE.includes(s))
  assert.ok(!REBOOKABLE.includes('PAID'))
  assert.ok(!RESCHEDULABLE.includes('EN_ROUTE'))
})

it('reschedule sends the version, the slot start and its window', async () => {
  const order = { id: 'o1', status: 'PAID', version: 4, parentId: 'p', scheduledFor: '2026-11-02T02:00:00.000Z', timeSlot: '10:00-11:00' }
  const h = makeClient(
    [
      { status: 200, body: { success: true, message: 'ok', data: { order } } },
      { status: 409, body: { success: false, message: 'Сонгосон цаг дүүрсэн байна', error: { code: 'AVAILABILITY_REQUIRED' } } },
    ],
    { token: VALID_TOKEN },
  )
  const input = { version: 3, scheduledFor: '2026-11-02T02:00:00.000Z', timeSlot: '10:00-11:00' }
  const r = await rescheduleOrder(h.client, 'o1', input)
  assert.ok(h.calls[0].url.endsWith('/api/orders/o1/reschedule'))
  assert.equal(h.calls[0].init.method, 'POST')
  assert.deepEqual(JSON.parse(h.calls[0].init.body ?? '{}'), input)
  assert.equal(r.ok && r.data.timeSlot, '10:00-11:00')
  const full = await rescheduleOrder(h.client, 'o1', input)
  assert.equal(!full.ok && full.code, 'AVAILABILITY_REQUIRED')
})
