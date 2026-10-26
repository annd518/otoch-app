import assert from 'node:assert/strict'
import test from 'node:test'

import { createHttpClient, type FetchLike } from '../services/httpClient'
import { getEarnings, getReceiptLink, parseEarnings, periodLabel, saveBank, weekdayShort } from '../services/earnings'
import { resolveApiConfig } from '../utils/apiConfig'

const config = resolveApiConfig({ isDev: true, platform: 'ios', explicitUrl: 'http://api.test' })

function recorder(status: number, body: unknown) {
  const seen: { url: string; method: string; body: unknown }[] = []
  const fetch: FetchLike = async (url, init) => {
    seen.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined })
    return { status, text: async () => JSON.stringify(body) }
  }
  return { seen, client: createHttpClient({ config, fetch, getToken: async () => null }) }
}

const week = {
  range: 'week',
  offset: 0,
  from: '2026-10-25T16:00:00.000Z',
  to: '2026-11-01T16:00:00.000Z',
  totals: { netMnt: 42000, grossMnt: 60000, visits: 2 },
  days: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map((date, i) => ({
    date,
    netMnt: i === 1 ? 42000 : 0,
    visits: i === 1 ? 2 : 0,
  })),
  entries: [{ orderId: 'o1', services: ['Тарилга'], earnedAt: '2026-10-27T05:00:00.000Z', grossMnt: 35000, netMnt: 24500, paidAt: null }],
  unpaid: { netMnt: 42000, visits: 2 },
  payouts: [],
  rating: { average: 4.8, count: 5 },
  sharePercent: 70,
  bank: null,
}

test('parses the earnings week: totals, days, visits, no bank yet', () => {
  const e = parseEarnings(week)
  assert.ok(e)
  assert.equal(e.totals.netMnt, 42000)
  assert.equal(e.days.length, 7)
  assert.equal(e.entries[0].paidAt, null)
  assert.equal(e.bank, null)
  assert.deepEqual(e.rating, { average: 4.8, count: 5 })
  assert.equal(parseEarnings({ ...week, totals: null }), null)
  assert.equal(parseEarnings({ ...week, range: 'year' }), null)
})

test('period label and weekday letters', () => {
  const e = parseEarnings(week)!
  assert.equal(periodLabel(e), '10-р сарын 26 – 11-р сарын 1')
  assert.equal(periodLabel({ range: 'week', days: [{ date: '2026-10-19', netMnt: 0, visits: 0 }, { date: '2026-10-25', netMnt: 0, visits: 0 }] }), '10-р сарын 19–25')
  assert.equal(periodLabel({ range: 'month', days: [{ date: '2026-09-01', netMnt: 0, visits: 0 }] }), '2026 оны 9-р сар')
  assert.equal(weekdayShort('2026-10-26'), 'Да')
  assert.equal(weekdayShort('2026-11-01'), 'Ня')
})

test('earnings and bank calls', async () => {
  const t = recorder(200, { success: true, message: 'ok', data: week })
  const r = await getEarnings(t.client, 'month', 2)
  assert.ok(r.ok)
  assert.equal(t.seen[0].url, 'http://api.test/api/nurse/earnings?range=month&offset=2')
  const b = recorder(200, { success: true, message: 'ok', data: { bank: { bankName: 'Хаан банк', accountNo: '5000123456', accountName: 'Б.Номин' } } })
  const saved = await saveBank(b.client, { bankName: 'Хаан банк', accountNo: '5000 123456', accountName: 'Б.Номин' })
  assert.equal(b.seen[0].method, 'PUT')
  assert.equal(b.seen[0].url, 'http://api.test/api/nurse/bank')
  assert.equal(saved.ok && saved.data.accountNo, '5000123456')
})

test('a payout receipt link is a server path under /api/receipts only', async () => {
  const ok = recorder(200, { success: true, message: 'ok', data: { path: '/api/receipts/payout/abc.def', expiresAt: '2026-10-28T03:10:00Z' } })
  const r = await getReceiptLink(ok.client, 'p 1')
  assert.equal(ok.seen[0].url, 'http://api.test/api/nurse/payouts/p%201/receipt-link')
  assert.equal(r.ok && r.data, '/api/receipts/payout/abc.def')
  const odd = recorder(200, { success: true, message: 'ok', data: { path: 'https://elsewhere.example/x' } })
  assert.equal((await getReceiptLink(odd.client, 'p1')).ok, false)
})
