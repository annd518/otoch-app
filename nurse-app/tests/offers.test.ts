import assert from 'node:assert/strict'
import test from 'node:test'

import { createHttpClient, type FetchLike } from '../services/httpClient'
import {
  acceptOffer,
  declineOffer,
  fetchOffers,
  formatCountdown,
  parseOffers,
  parseProfileEnvelope,
  setDistricts,
  remainingSeconds,
  setOnline,
} from '../services/offers'
import { resolveApiConfig } from '../utils/apiConfig'
import { formatMnt } from '../utils/money'
import { formatUbDate } from '../utils/orderView'

const config = resolveApiConfig({ isDev: true, platform: 'ios', explicitUrl: 'http://api.test' })

function recorder(status: number, body: unknown) {
  const seen: { url: string; method: string; body: unknown }[] = []
  const fetch: FetchLike = async (url, init) => {
    seen.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined })
    return { status, text: async () => JSON.stringify(body) }
  }
  return { seen, client: createHttpClient({ config, fetch, getToken: async () => null }) }
}

const offer = {
  id: 'f1',
  wave: 1,
  expiresAt: '2026-10-05T06:02:00.000Z',
  secondsLeft: 95,
  order: { id: 'o1', items: [{ serviceCode: 'S02', name: 'Тарилга', quantity: 1 }], scheduledFor: '2026-10-05T06:00:00.000Z', timeSlot: '14:00–15:00', area: 'Баянзүрх' },
  earnings: { nurseShareMnt: 17500, sharePercent: 70, isFixture: true },
}

test('parses offers: area, schedule, earnings; no address field is read', () => {
  const list = parseOffers({ offers: [offer] })
  assert.ok(list)
  assert.equal(list[0].area, 'Баянзүрх')
  assert.equal(list[0].earnings?.nurseShareMnt, 17500)
  assert.equal(list[0].items[0].name, 'Тарилга')
  assert.deepEqual(parseOffers({ offers: [] }), [])
  assert.equal(parseOffers({ offers: [{ id: 'x' }] }), null)
  assert.equal(parseOffers({}), null)
  assert.equal(parseOffers({ offers: [{ ...offer, earnings: null }] })?.[0].earnings, null)
})

test('countdown follows the server seconds and local elapsed time, never the wall clock', () => {
  const o = { secondsLeft: 95 }
  assert.equal(remainingSeconds(o, 1_000_000, 1_000_000), 95)
  assert.equal(remainingSeconds(o, 1_000_000, 1_030_500), 65)
  assert.equal(remainingSeconds(o, 1_000_000, 1_200_000), 0)
  assert.equal(formatCountdown(95), '1:35')
  assert.equal(formatCountdown(5), '0:05')
})

test('list, accept and decline use the nurse endpoints', async () => {
  const list = recorder(200, { success: true, data: { offers: [offer] } })
  const r = await fetchOffers(list.client)
  assert.equal(r.ok, true)
  assert.equal(list.seen[0].url, 'http://api.test/api/nurse/offers')

  const acc = recorder(200, { success: true, data: { order: { id: 'o1', status: 'ASSIGNED', version: 4, parentId: 'p1', patientName: 'Д.Цэцэг', address: { text: 'Хаяг' } } } })
  const a = await acceptOffer(acc.client, 'f 1')
  assert.equal(acc.seen[0].url, 'http://api.test/api/nurse/offers/f%201/accept')
  assert.equal(acc.seen[0].method, 'POST')
  assert.equal(a.ok && a.data.address?.text, 'Хаяг')

  const dec = recorder(200, { success: true, message: 'ok', data: null })
  const d = await declineOffer(dec.client, 'f1')
  assert.equal(d.ok, true)
  assert.equal(dec.seen[0].url, 'http://api.test/api/nurse/offers/f1/decline')
})

test('a taken or expired offer surfaces the server message and code', async () => {
  const t = recorder(409, { success: false, message: 'Энэ дуудлагыг өөр сувилагч авсан байна', error: { code: 'OFFER_EXPIRED' } })
  const r = await acceptOffer(t.client, 'f1')
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.code, 'OFFER_EXPIRED')
    assert.match(r.message, /өөр сувилагч/)
  }
})

test('profile: null row, verified row, blocker, and the online toggle request', () => {
  assert.deepEqual(parseProfileEnvelope({ profile: null }), { profile: null })
  assert.equal(parseProfileEnvelope({}), null)
  assert.equal(parseProfileEnvelope({ profile: { status: 'NOPE' } }), null)
  const p = parseProfileEnvelope({
    profile: { status: 'VERIFIED', isActive: false, licenseNo: '10387', licenseExpiresAt: '2028-05-31T15:59:59.000Z', skillTags: ['INJ', 3], blocker: null },
  })
  assert.equal(p?.profile?.status, 'VERIFIED')
  assert.deepEqual(p?.profile?.skillTags, ['INJ'])
  assert.equal(p?.profile?.blocker, null)
  assert.deepEqual(p?.profile?.districts, [])
})

test('setDistricts sends only the districts', async () => {
  const t = recorder(200, { success: true, data: { profile: { status: 'VERIFIED', isActive: true, skillTags: [], districts: ['Баянгол', 'Хан-Уул'] } } })
  const r = await setDistricts(t.client, ['Баянгол', 'Хан-Уул'])
  assert.equal(t.seen[0].method, 'PUT')
  assert.deepEqual(t.seen[0].body, { districts: ['Баянгол', 'Хан-Уул'] })
  assert.deepEqual(r.ok && r.data.profile?.districts, ['Баянгол', 'Хан-Уул'])
})

test('setOnline sends only isActive', async () => {
  const t = recorder(200, { success: true, data: { profile: { status: 'VERIFIED', isActive: true, skillTags: [] } } })
  const r = await setOnline(t.client, true)
  assert.equal(t.seen[0].method, 'PUT')
  assert.deepEqual(t.seen[0].body, { isActive: true })
  assert.equal(r.ok && r.data.profile?.isActive, true)
})

test('money and dates', () => {
  assert.equal(formatMnt(17500), '17,500₮')
  assert.equal(formatUbDate('2028-05-31T15:59:59.000Z'), '2028.05.31')
  assert.equal(formatUbDate('2028-05-31T16:00:00.000Z'), '2028.06.01')
  assert.equal(formatUbDate('x'), null)
})
