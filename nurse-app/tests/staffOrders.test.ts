import assert from 'node:assert/strict'
import test from 'node:test'

import { createHttpClient, type FetchLike } from '../services/httpClient'
import {
  fetchStaffOrders,
  parseStaffOrder,
  parseStaffOrderPage,
  postStaffOrderAction,
} from '../services/staffOrders'
import { resolveApiConfig } from '../utils/apiConfig'
import {
  availableActions,
  etaFromNow,
  formatSchedule,
  formatUbDateTime,
  serviceSummary,
  sortForNurse,
} from '../utils/orderView'

const base = {
  id: 'o1',
  status: 'ASSIGNED',
  version: 3,
  parentId: 'p1',
  patientName: 'Д.Цэцэг',
  scheduledFor: '2026-10-05T06:00:00.000Z',
  timeSlot: '14:00–15:00',
  eta: null,
  address: { text: 'Орчлон, 43-54', lat: 47.9, lng: 106.9 },
  notes: null,
  items: [{ serviceCode: 'S02', name: 'Тарилга', quantity: 1 }],
  bookingForm: {
    familyPresent: true,
    postoperative: false,
    medication: { name: 'Цефтриаксон', dose: '1 г', route: 'булчин', expiresAt: '2027-01-01', doseNumber: 2 },
  },
  attachments: [{ id: 'a1' }],
  timeline: [{ id: 't1', status: 'ASSIGNED', at: '2026-10-04T10:00:00.000Z' }],
}

test('parses a staff order with medication and attachments', () => {
  const o = parseStaffOrder(base)
  assert.ok(o)
  assert.equal(o.patientName, 'Д.Цэцэг')
  assert.equal(o.medication?.name, 'Цефтриаксон')
  assert.equal(o.attachmentCount, 1)
  assert.equal(o.address?.text, 'Орчлон, 43-54')
  assert.equal(o.familyPresent, true)
})

test('rejects an order without a valid version', () => {
  assert.equal(parseStaffOrder({ ...base, version: 0 }), null)
  assert.equal(parseStaffOrder({ ...base, version: 1.5 }), null)
  assert.equal(parseStaffOrder({ ...base, id: '' }), null)
})

test('an order without a booking form still parses', () => {
  const o = parseStaffOrder({ ...base, bookingForm: null, address: null, attachments: undefined })
  assert.ok(o)
  assert.equal(o.medication, null)
  assert.equal(o.address, null)
  assert.equal(o.attachmentCount, 0)
})

test('page parser fails the whole page when one order is malformed', () => {
  assert.equal(parseStaffOrderPage({ orders: [base, { id: 'x' }], nextCursor: null }), null)
  const page = parseStaffOrderPage({ orders: [base], nextCursor: 'c9' })
  assert.equal(page?.nextCursor, 'c9')
})

test('Ulaanbaatar time is UTC+8', () => {
  assert.equal(formatUbDateTime('2026-10-05T06:00:00.000Z'), '10.05 14:00')
  assert.equal(formatUbDateTime('2026-12-31T17:30:00.000Z'), '01.01 01:30')
  assert.equal(formatUbDateTime('nope'), null)
  const o = parseStaffOrder(base)!
  assert.equal(formatSchedule(o), '10.05 14:00 · 14:00–15:00')
  assert.equal(formatSchedule({ scheduledFor: null, timeSlot: null }), 'Цаг товлогдоогүй')
})

test('service summary shows quantity only above one', () => {
  assert.equal(serviceSummary({ items: [{ serviceCode: 'S02', name: 'Тарилга', quantity: 2 }] }), 'Тарилга ×2')
})

test('sorting: in progress, upcoming by time, history newest first', () => {
  const mk = (id: string, status: string, scheduledFor: string) => parseStaffOrder({ ...base, id, status, scheduledFor })!
  const sorted = sortForNurse([
    mk('done-old', 'COMPLETED', '2026-10-01T00:00:00Z'),
    mk('later', 'ASSIGNED', '2026-10-06T00:00:00Z'),
    mk('now', 'IN_PROGRESS', '2026-10-05T00:00:00Z'),
    mk('done-new', 'COMPLETED', '2026-10-03T00:00:00Z'),
    mk('soon', 'ASSIGNED', '2026-10-05T10:00:00Z'),
  ])
  assert.deepEqual(sorted.map((o) => o.id), ['now', 'soon', 'later', 'done-new', 'done-old'])
})

test('available actions follow the server guards', () => {
  assert.deepEqual(availableActions('ASSIGNED'), { setEta: true, start: true, complete: false })
  assert.deepEqual(availableActions('IN_PROGRESS'), { setEta: true, start: false, complete: true })
  assert.deepEqual(availableActions('COMPLETED'), { setEta: false, start: false, complete: false })
  assert.deepEqual(availableActions('PAID'), { setEta: false, start: false, complete: false })
})

test('eta is minutes from now in the future', () => {
  assert.equal(etaFromNow(15, Date.parse('2026-10-05T00:00:00Z')), '2026-10-05T00:15:00.000Z')
})

const config = resolveApiConfig({ isDev: true, platform: 'ios', explicitUrl: 'http://api.test' })

test('actions send the order version; 409 surfaces its code', async () => {
  const seen: { url: string; body?: string }[] = []
  const fetch: FetchLike = async (url, init) => {
    seen.push({ url, body: init.body })
    return {
      status: 409,
      text: async () => JSON.stringify({ success: false, message: 'Мэдээлэл шинэчлэгдсэн', error: { code: 'VERSION_CONFLICT' } }),
    }
  }
  const client = createHttpClient({ config, fetch, getToken: async () => null })
  const res = await postStaffOrderAction(client, 'o 1', 'start', 3)
  assert.equal(seen[0].url, 'http://api.test/api/staff/orders/o%201/start')
  assert.deepEqual(JSON.parse(seen[0].body!), { version: 3 })
  assert.equal(res.ok, false)
  if (!res.ok) assert.equal(res.code, 'VERSION_CONFLICT')
})

test('list request carries the cursor', async () => {
  const urls: string[] = []
  const fetch: FetchLike = async (url) => {
    urls.push(url)
    return { status: 200, text: async () => JSON.stringify({ success: true, data: { orders: [], nextCursor: null } }) }
  }
  const client = createHttpClient({ config, fetch, getToken: async () => null })
  await fetchStaffOrders(client)
  await fetchStaffOrders(client, 'c 9')
  assert.deepEqual(urls, ['http://api.test/api/staff/orders', 'http://api.test/api/staff/orders?cursor=c%209'])
})
