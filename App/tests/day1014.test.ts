import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEV_FIXTURE_QUESTIONS } from '../mocks/mockBackend'
import type { CatalogService } from '../services/apiTypes'
import { INITIAL_DRAFT, bookingDraftReducer, buildDraftInput, planDraftSave, type BookingDraftState } from '../services/bookingDraft'
import {
  QUOTE_NOT_IMPLEMENTED_MESSAGE,
  createDraftOrder,
  isQuoteExpired,
  reportRedFlagBlock,
  requestQuote,
  submitRedFlagAnswers,
  uploadReferral,
} from '../services/orders'
import {
  PAYMENT_NOT_IMPLEMENTED_MESSAGE,
  createInvoice,
  getPaymentState,
  parseInvoice,
  parsePaymentState,
  inProgressPaymentId,
  pollDecision,
  safeDeeplinks,
} from '../services/payment'
import { makeClient, makeMockClient } from './helpers'
import { getOrder } from '../services/orders'

// The implemented server needs the current order version for a quote.
async function quoteFor(client: ReturnType<typeof makeMockClient>['client'], orderId: string) {
  const order = await getOrder(client, orderId)
  if (!order.ok) throw new Error('order')
  return requestQuote(client, orderId, order.data.version)
}

const service = (code: string, requiresReferral = false): CatalogService => ({
  id: `id_${code}`,
  code,
  name: code,
  description: '',
  category: '',
  priceMnt: 45000,
  durationMin: 45,
  requiresReferral,
  redFlagQuestionnaire: 'GENERAL_V1',
  isActive: true,
  isFixture: true,
})

function filled(code = 'MOCK_HOME_BASIC', referral = false): BookingDraftState {
  return bookingDraftReducer(
    bookingDraftReducer(INITIAL_DRAFT, { type: 'selectService', service: service(code, referral), catalogVersion: null, source: 'mock' }),
    {
      type: 'updateDetails',
      patch: { parentId: 'p1', parentName: 'P', addressText: 'Улаанбаатар 1-р хороо', date: '2026-10-20', timeSlot: '09:00-11:00' },
    },
  )
}

const allAnswers = (value: (i: number) => boolean) => DEV_FIXTURE_QUESTIONS.map((q, i) => ({ questionId: q.id, value: value(i) }))

async function clearedDraft(client: ReturnType<typeof makeMockClient>['client'], code = 'MOCK_HOME_BASIC') {
  const input = buildDraftInput(filled(code, code.includes('_IV')))
  assert.ok(input)
  const created = await createDraftOrder(client, input, `k-${code}-${Math.random()}`)
  assert.ok(created.ok)
  if (!created.ok) throw new Error('create')
  const cleared = await submitRedFlagAnswers(client, created.data.id, allAnswers(() => false), ['GENERAL_V1'])
  assert.equal(cleared.ok && cleared.data.status, 'CLEAR')
  return created.data.id
}

describe('Idempotency-Key lifecycle for draft create', () => {
  it('same payload -> same key for every retry, including after a timeout', () => {
    let n = 0
    const newKey = () => `key-${++n}`
    const first = planDraftSave(filled(), newKey)
    assert.ok(first.kind === 'create')
    if (first.kind !== 'create') return
    const started = bookingDraftReducer(filled(), { type: 'createStarted', key: first.key, fingerprint: first.fingerprint })
    const retry = planDraftSave(started, newKey)
    assert.equal(retry.kind === 'create' && retry.key, 'key-1')
  })

  it('changed payload -> new logical create with a new key; reset -> new key', () => {
    let n = 0
    const newKey = () => `key-${++n}`
    const first = planDraftSave(filled(), newKey)
    if (first.kind !== 'create') return assert.fail('create')
    let state = bookingDraftReducer(filled(), { type: 'createStarted', key: first.key, fingerprint: first.fingerprint })
    state = bookingDraftReducer(state, { type: 'updateDetails', patch: { timeSlot: '13:00-15:00' } })
    const changed = planDraftSave(state, newKey)
    assert.equal(changed.kind === 'create' && changed.key, 'key-2')
    assert.equal(bookingDraftReducer(state, { type: 'reset' }).pendingCreate, null)
  })

  it('server honouring the key: lost response + retry creates one draft; reused key with another payload is refused', async () => {
    const { client } = makeMockClient()
    const input = buildDraftInput(filled())
    assert.ok(input)
    const a = await createDraftOrder(client, input, 'same-key')
    const b = await createDraftOrder(client, input, 'same-key')
    assert.ok(a.ok && b.ok && a.data.id === b.data.id)
    const other = await createDraftOrder(client, { ...input, timeSlot: '13:00-15:00' }, 'same-key')
    assert.ok(!other.ok && other.status === 409 && other.code === 'IDEMPOTENCY_KEY_REUSED')
  })

  it('a server that ignores the key (current backend) creates duplicates: client tap protection is not a substitute', async () => {
    const { client } = makeMockClient('no-idempotency')
    const input = buildDraftInput(filled())
    assert.ok(input)
    const a = await createDraftOrder(client, input, 'same-key')
    const b = await createDraftOrder(client, input, 'same-key')
    assert.ok(a.ok && b.ok && a.data.id !== b.data.id)
  })
})

describe('early "yes" block reporting', () => {
  async function draft(scenario = '') {
    const harness = makeMockClient(scenario)
    const input = buildDraftInput(filled())
    assert.ok(input)
    const created = await createDraftOrder(harness.client, input, `k-${Math.random()}`)
    if (!created.ok) throw new Error('create')
    return { ...harness, id: created.data.id }
  }
  const partial = [{ questionId: DEV_FIXTURE_QUESTIONS[0].id, value: true }]

  it('an older server that rejects partial answers -> not_supported, never CLEAR', async () => {
    const { client, id } = await draft('no-partial-block')
    const r = await reportRedFlagBlock(client, id, partial, ['GENERAL_V1'])
    assert.equal(r.kind, 'not_supported')
  })

  it('backend 76b7e9e records a single "yes" as a block (GAP-13 fixed)', async () => {
    const { client, id } = await draft()
    const r = await reportRedFlagBlock(client, id, partial, ['GENERAL_V1'])
    assert.equal(r.kind, 'recorded')
    const again = await reportRedFlagBlock(client, id, partial, ['GENERAL_V1'])
    assert.equal(again.kind, 'recorded') // already blocked -> RED_FLAG_BLOCKED counts as recorded
  })

  it('a "yes" blocks even with an outdated questionnaire code; a server error -> retry, never CLEAR', async () => {
    const { client, id } = await draft()
    assert.equal((await reportRedFlagBlock(client, id, partial, ['GENERAL_V0'])).kind, 'recorded')
    const failing = await draft('redflag-submit-error')
    assert.equal((await reportRedFlagBlock(failing.client, failing.id, partial, ['GENERAL_V1'])).kind, 'retry')
  })

  it('a server answering CLEAR to a "yes" is not accepted as recorded', async () => {
    const { client } = makeClient(
      [{ status: 200, body: { success: true, data: { redFlag: { status: 'CLEAR' }, orderStatus: 'DRAFT', version: 2 } } }],
      { token: 't' },
    )
    assert.equal((await reportRedFlagBlock(client, 'o', partial, ['GENERAL_V1'])).kind, 'retry')
  })

  it('locally the draft stays blocked whatever the report says', () => {
    let state = bookingDraftReducer(filled(), {
      type: 'redFlagBlocked',
      advice: null,
      server: 'pending',
      report: { questionnaires: ['GENERAL_V1'], answers: partial },
    })
    state = bookingDraftReducer(state, { type: 'blockReported', server: 'not_supported' })
    assert.equal(state.redFlag.status === 'blocked' && state.redFlag.server, 'not_supported')
    state = bookingDraftReducer(state, { type: 'redFlagCleared' })
    assert.equal(state.redFlag.status, 'blocked')
    state = bookingDraftReducer(state, { type: 'blockReported', server: 'recorded', version: 4 })
    assert.ok(state.redFlag.status === 'blocked' && state.redFlag.server === 'recorded' && state.redFlag.report === null)
  })
})

describe('quote', () => {
  it('501 from the current server is "not implemented", never a price', async () => {
    const { client } = makeClient(
      [{ status: 501, body: { success: false, message: 'x', error: { code: 'NOT_IMPLEMENTED' } } }],
      { token: 't' },
    )
    const r = await requestQuote(client, 'o', 1)
    assert.equal(r.ok ? '' : r.kind, 'not_implemented')
    assert.equal(r.ok ? '' : r.message, QUOTE_NOT_IMPLEMENTED_MESSAGE)
  })

  it('server guards: red flag first, referral before price', async () => {
    const { client } = makeMockClient()
    const input = buildDraftInput(filled())
    assert.ok(input)
    const created = await createDraftOrder(client, input, 'q1')
    if (!created.ok) return assert.fail('create')
    assert.equal((await quoteFor(client, created.data.id)).ok ? '' : 'x', 'x')
    const ivId = await clearedDraft(client, 'MOCK_HOME_IV')
    const noReferral = await quoteFor(client, ivId)
    assert.equal(noReferral.ok ? '' : noReferral.code, 'REFERRAL_REQUIRED')
    await uploadReferral(client, ivId, { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' })
    assert.equal((await quoteFor(client, ivId)).ok, true)
  })

  it('a quote has lines, totalMnt and a fixture flag; it goes stale on expiry and on draft edits', async () => {
    const { client } = makeMockClient()
    const id = await clearedDraft(client)
    const r = await quoteFor(client, id)
    assert.ok(r.ok)
    if (!r.ok) return
    assert.equal(r.data.totalMnt, r.data.lines.reduce((s, l) => s + l.amountMnt, 0))
    assert.equal(r.data.isFixture, true)
    assert.equal(isQuoteExpired(r.data, Date.now()), false)
    const withQuote = bookingDraftReducer(filled(), { type: 'setQuote', quote: r.data })
    assert.equal(bookingDraftReducer(withQuote, { type: 'updateDetails', patch: { notes: 'x' } }).quote, null)
    const exp = makeMockClient('quote-expired')
    const eid = await clearedDraft(exp.client)
    const eq = await quoteFor(exp.client, eid)
    assert.ok(eq.ok && isQuoteExpired(eq.data, Date.now()))
  })
})

describe('upload retries', () => {
  it('lost response + retry with the same key -> one attachment', async () => {
    const { client } = makeMockClient('upload-lost-response-once')
    const id = await clearedDraft(client, 'MOCK_HOME_IV')
    const file = { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' }
    const first = await uploadReferral(client, id, file, undefined, 'local-1')
    assert.equal(first.ok ? '' : first.kind, 'network')
    const retry = await uploadReferral(client, id, file, undefined, 'local-1')
    assert.ok(retry.ok)
    // 4 more distinct uploads fit: the retry did not consume a slot
    for (let i = 2; i <= 5; i += 1) assert.equal((await uploadReferral(client, id, file, undefined, `local-${i}`)).ok, true)
    const sixth = await uploadReferral(client, id, file, undefined, 'local-6')
    assert.equal(sixth.ok ? '' : sixth.code, 'ATTACHMENT_LIMIT')
  })

  it('without a key a lost response + retry creates a duplicate (why the key is sent)', async () => {
    const { client } = makeMockClient('upload-lost-response-once')
    const id = await clearedDraft(client, 'MOCK_HOME_IV')
    const file = { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' }
    await uploadReferral(client, id, file)
    const ids = []
    for (let i = 0; i < 4; i += 1) {
      const r = await uploadReferral(client, id, file)
      if (r.ok) ids.push(r.data.id)
    }
    assert.equal(ids.length, 4)
    assert.equal((await uploadReferral(client, id, file)).ok, false) // 1 lost + 4 = 5 stored
  })
})

describe('QPay payment', () => {
  it('only backend bank app deeplinks are shown; web and script links are dropped', () => {
    const links = safeDeeplinks([
      { name: 'Khan', link: 'khanbank://q?qPay_QRcode=X', logo: 'https://x/logo.png' },
      { name: 'Web', link: 'https://evil.example' },
      { name: 'JS', link: 'javascript://alert(1)' },
      { name: 'No scheme', link: 'qpay' },
    ])
    assert.deepEqual(links.map((l) => l.name), ['Khan'])
  })

  it('PAID without paidAt is not accepted', () => {
    assert.equal(parsePaymentState({ payment: { id: 'p', status: 'PAID', amountMnt: 1 } }), null)
  })

  it('poll decisions: pending, paid, failed, expired (status or time)', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const past = new Date(Date.now() - 1).toISOString()
    assert.equal(pollDecision('PENDING', future, Date.now()), 'poll')
    assert.equal(pollDecision('PENDING', past, Date.now()), 'expired')
    assert.equal(pollDecision('PAID', past, Date.now()), 'paid')
    assert.equal(pollDecision('FAILED', future, Date.now()), 'stop_failed')
    assert.equal(pollDecision('EXPIRED', future, Date.now()), 'expired')
  })

  it('mock: invoice is idempotent per key, pending then PAID only after server polls', async () => {
    const { client } = makeMockClient()
    const id = await clearedDraft(client)
    const q = await quoteFor(client, id)
    if (!q.ok) return assert.fail('quote')
    const inv = await createInvoice(client, id, q.data.id, 'pay-key')
    const again = await createInvoice(client, id, q.data.id, 'pay-key')
    assert.ok(inv.ok && again.ok && inv.data.id === again.data.id)
    if (!inv.ok) return
    assert.equal(inv.data.deeplinks.length, 1)
    const s1 = await getPaymentState(client, id, inv.data.id)
    assert.equal(s1.ok && s1.data.status, 'PENDING')
    await getPaymentState(client, id, inv.data.id)
    const s3 = await getPaymentState(client, id, inv.data.id)
    assert.ok(s3.ok && s3.data.status === 'PAID' && s3.data.paidAt)
  })

  it('mock: expiry and failure outcomes', async () => {
    for (const [scenario, expected] of [['payment-expire', 'EXPIRED'], ['payment-fail', 'FAILED']] as const) {
      const { client } = makeMockClient(scenario)
      const id = await clearedDraft(client)
      const q = await quoteFor(client, id)
      if (!q.ok) return assert.fail('quote')
      const inv = await createInvoice(client, id, q.data.id, `k-${scenario}`)
      if (!inv.ok) return assert.fail('invoice')
      let last = ''
      for (let i = 0; i < 3; i += 1) {
        const s = await getPaymentState(client, id, inv.data.id)
        if (s.ok) last = s.data.status
      }
      assert.equal(last, expected)
    }
  })

  it('an expired quote cannot be paid', async () => {
    const exp = makeMockClient('quote-expired')
    const id = await clearedDraft(exp.client)
    const q = await quoteFor(exp.client, id)
    if (!q.ok) return assert.fail('quote')
    const inv = await createInvoice(exp.client, id, q.data.id, 'k')
    assert.equal(inv.ok ? '' : inv.code, 'QUOTE_EXPIRED')
  })

  it('real server without the endpoint: 404 or 501 -> unavailable, never paid', async () => {
    for (const reply of [{ status: 404 }, { status: 501, body: { success: false, message: 'x', error: { code: 'NOT_IMPLEMENTED' } } }]) {
      const { client } = makeClient([reply], { token: 't' })
      const r = await createInvoice(client, 'o', 'q', 'k')
      assert.equal(r.ok ? '' : r.message, PAYMENT_NOT_IMPLEMENTED_MESSAGE)
    }
  })

  it('invoice parser rejects malformed data', () => {
    assert.equal(parseInvoice({ payment: { id: 'p', status: 'PENDING', amountMnt: 1, qrText: '', expiresAt: 'x' } }), null)
  })
})

describe('backend 76b7e9e contract details', () => {
  async function cleared(scenario = '') {
    const h = makeMockClient(scenario)
    const input = buildDraftInput(filled())
    if (!input) throw new Error('input')
    const created = await createDraftOrder(h.client, input, `k-${Math.random()}`)
    if (!created.ok) throw new Error('create')
    await submitRedFlagAnswers(h.client, created.data.id, allAnswers(() => false), ['GENERAL_V1'])
    return { ...h, id: created.data.id }
  }

  it('quote carries orderVersion, excludes and is not a payment; a stale orderVersion is refused', async () => {
    const { client, id } = await cleared()
    const q = await quoteFor(client, id)
    assert.ok(q.ok)
    if (!q.ok) return
    assert.deepEqual(q.data.excludes, ['TRAVEL_FEE', 'DISCOUNT', 'VAT'])
    assert.equal(q.data.travelFeeMnt, null)
    assert.equal(typeof q.data.orderVersion, 'number')
    const stale = await requestQuote(client, id, 1)
    assert.equal(stale.ok ? '' : stale.code, 'VERSION_CONFLICT')
  })

  it('a quote with isPayment true is rejected by the parser', () => {
    const { client } = makeClient(
      [{ status: 201, body: { success: true, data: { quote: { id: 'q', currency: 'MNT', lines: [], subtotalMnt: 0, totalMnt: 0, pricingVersion: 'x', expiresAt: 'x', isPayment: true } } } }],
      { token: 't' },
    )
    return requestQuote(client, 'o', 1).then((r) => assert.equal(r.ok ? '' : r.kind, 'contract'))
  })

  it('an upload bumps the order version so the earlier quote becomes stale (QUOTE_MISMATCH)', async () => {
    const { client, id } = await cleared()
    const q = await quoteFor(client, id)
    if (!q.ok) return assert.fail('quote')
    const up = await uploadReferral(client, id, { uri: 'f', name: 'a.jpg', type: 'image/jpeg' }, undefined, 'u-1')
    assert.ok(up.ok)
    const inv = await createInvoice(client, id, q.data.id, 'pk')
    assert.equal(inv.ok ? '' : inv.code, 'QUOTE_MISMATCH')
  })

  it('payment: key required, mock flagged as isMock, second key while pending -> PAYMENT_IN_PROGRESS with paymentId', async () => {
    const { client, id } = await cleared()
    const q = await quoteFor(client, id)
    if (!q.ok) return assert.fail('quote')
    const inv = await createInvoice(client, id, q.data.id, 'key-a')
    assert.ok(inv.ok && inv.data.isMock)
    const second = await createInvoice(client, id, q.data.id, 'key-b')
    assert.equal(inProgressPaymentId(second), inv.ok ? inv.data.id : '')
  })
})
