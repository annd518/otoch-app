import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEV_FIXTURE_QUESTIONS } from '../mocks/mockBackend'
import type { CatalogService } from '../services/apiTypes'
import { INITIAL_DRAFT, bookingDraftReducer, buildDraftInput } from '../services/bookingDraft'
import { createDraftOrder, getOrder, listOrders, requestQuote, submitRedFlagAnswers } from '../services/orders'
import { UNKNOWN_PENDING_MESSAGE, createInvoice, getInvoice, invoiceOutcome, recoverPayment, type PaymentRecord } from '../services/payment'
import { parseQuote } from '../services/validators'
import { makeClient, makeMockClient } from './helpers'

const SERVICE: CatalogService = {
  id: 'svc_mock_basic',
  code: 'MOCK_HOME_BASIC',
  name: 'x',
  description: '',
  category: '',
  priceMnt: 45000,
  durationMin: 45,
  requiresReferral: false,
  redFlagQuestionnaire: 'GENERAL_V1',
  isActive: true,
  isFixture: true,
}

async function quotedOrder(scenario = '') {
  const h = makeMockClient(scenario)
  const state = bookingDraftReducer(
    bookingDraftReducer(INITIAL_DRAFT, { type: 'selectService', service: SERVICE, catalogVersion: null, source: 'mock' }),
    { type: 'updateDetails', patch: { parentId: 'p', addressText: 'Улаанбаатар 1-р хороо', date: '2026-10-20', timeSlot: '09:00-11:00' } },
  )
  const input = buildDraftInput(state)
  if (!input) throw new Error('input')
  const created = await createDraftOrder(h.client, input, `k-${Math.random()}`)
  if (!created.ok) throw new Error('create')
  const id = created.data.id
  await submitRedFlagAnswers(h.client, id, DEV_FIXTURE_QUESTIONS.map((q) => ({ questionId: q.id, value: false })), ['GENERAL_V1'])
  const order = await getOrder(h.client, id)
  if (!order.ok) throw new Error('order')
  const quote = await requestQuote(h.client, id, order.data.version)
  if (!quote.ok) throw new Error('quote')
  return { ...h, id, quoteId: quote.data.id }
}

describe('payment recovery', () => {
  it('timeout before the response: replaying the stored key + quote returns the same invoice', async () => {
    const { client, id, quoteId } = await quotedOrder()
    const record: PaymentRecord = { orderId: id, quoteId, key: 'pay-key-1', paymentId: null }
    const first = await createInvoice(client, id, quoteId, record.key) // response "lost"
    const recovered = await recoverPayment(client, record, Date.now())
    assert.equal(recovered.result.kind, 'pending')
    assert.equal(recovered.paymentId, first.ok ? first.data.id : 'x')
  })

  it('after a restart the stored paymentId restores the full invoice (QR, deeplinks) and status', async () => {
    const { client, id, quoteId } = await quotedOrder()
    const inv = await createInvoice(client, id, quoteId, 'pay-key-2')
    if (!inv.ok) return assert.fail('invoice')
    const recovered = await recoverPayment(client, { orderId: id, quoteId, key: 'pay-key-2', paymentId: inv.data.id }, Date.now())
    assert.ok(recovered.result.kind === 'pending' && recovered.result.invoice.isMock && recovered.result.invoice.deeplinks.length === 1)
  })

  it('PAID only when the server returns PAID with paidAt', async () => {
    const { client, id, quoteId } = await quotedOrder()
    const inv = await createInvoice(client, id, quoteId, 'pay-key-3')
    if (!inv.ok) return assert.fail('invoice')
    const record = { orderId: id, quoteId, key: 'pay-key-3', paymentId: inv.data.id }
    assert.equal((await recoverPayment(client, record, Date.now())).result.kind, 'pending')
    assert.equal((await recoverPayment(client, record, Date.now())).result.kind, 'pending')
    const third = await recoverPayment(client, record, Date.now())
    assert.ok(third.result.kind === 'paid' && third.result.paidAt)
  })

  it('expired and failed are distinct final states', async () => {
    for (const [scenario, kind] of [['payment-expire', 'expired'], ['payment-fail', 'failed']] as const) {
      const { client, id, quoteId } = await quotedOrder(scenario)
      const inv = await createInvoice(client, id, quoteId, `k-${scenario}`)
      if (!inv.ok) return assert.fail('invoice')
      const record = { orderId: id, quoteId, key: `k-${scenario}`, paymentId: inv.data.id }
      let last = ''
      for (let i = 0; i < 3; i += 1) last = (await recoverPayment(client, record, Date.now())).result.kind
      assert.equal(last, kind)
    }
  })

  it('legacy server: another key while pending (ORDER_NOT_EDITABLE, no paymentId) -> unknown_pending, never a new invoice or success', async () => {
    const { client, id, quoteId } = await quotedOrder('legacy-order-not-editable')
    await createInvoice(client, id, quoteId, 'device-a')
    const other = await recoverPayment(client, { orderId: id, quoteId, key: 'device-b', paymentId: null }, Date.now())
    assert.deepEqual(other.result, { kind: 'unknown_pending', message: UNKNOWN_PENDING_MESSAGE })
    assert.equal(other.paymentId, null)
  })

  it('documented contract (PAYMENT_IN_PROGRESS with paymentId) -> resumes that invoice', async () => {
    const { client, id, quoteId } = await quotedOrder('payment-in-progress-contract')
    const a = await createInvoice(client, id, quoteId, 'device-a')
    const resumed = await recoverPayment(client, { orderId: id, quoteId, key: 'device-b', paymentId: null }, Date.now())
    assert.equal(resumed.result.kind, 'pending')
    assert.equal(resumed.paymentId, a.ok ? a.data.id : 'x')
  })

  it('a payment id unknown to the server is an error, not success', async () => {
    const { client, id } = await quotedOrder()
    const r = await getInvoice(client, id, 'pay_does_not_exist')
    assert.equal(r.ok ? '' : r.code, 'PAYMENT_NOT_FOUND')
  })

  it('pending orders are listed for recovery after a restart', async () => {
    const { client, id, quoteId } = await quotedOrder()
    await createInvoice(client, id, quoteId, 'pay-list')
    const list = await listOrders(client, 'AWAITING_PAYMENT')
    assert.ok(list.ok && list.data.some((o) => o.id === id))
  })

  it('a real server without the payment endpoint -> unavailable', async () => {
    const { client } = makeClient([{ status: 404 }], { token: 't' })
    const r = await recoverPayment(client, { orderId: 'o', quoteId: 'q', key: 'k', paymentId: null }, Date.now())
    assert.equal(r.result.kind, 'unavailable')
  })
})

describe('quote fees that are excluded', () => {
  it('travelFeeMnt/discountMnt = 0 with excludes are "not calculated" (null), not a real 0 ₮', () => {
    const q = parseQuote({
      quote: {
        id: 'q',
        currency: 'MNT',
        lines: [{ type: 'SERVICE', serviceCode: 'HOME_BASIC_CHECK', name: 'x', quantity: 1, unitPriceMnt: 45000, amountMnt: 45000 }],
        subtotalMnt: 45000,
        travelFeeMnt: 0,
        discountMnt: 0,
        totalMnt: 45000,
        excludes: ['TRAVEL_FEE', 'DISCOUNT', 'VAT'],
        pricingVersion: 'LIST_PRICE_ONLY_V1',
        expiresAt: '2026-10-14T03:15:00.000Z',
        isFixture: true,
        isPayment: false,
        orderVersion: 4,
      },
    })
    assert.equal(q?.travelFeeMnt, null)
    assert.equal(q?.discountMnt, null)
    assert.deepEqual(q?.excludes, ['TRAVEL_FEE', 'DISCOUNT', 'VAT'])
  })
})

describe('8f6309f recovery hints (H1-H5)', () => {
  it('RESUME: another device (new key) resumes the same invoice, no second invoice', async () => {
    const { client, id, quoteId } = await quotedOrder()
    const a = await createInvoice(client, id, quoteId, 'device-a')
    const b = await recoverPayment(client, { orderId: id, quoteId, key: 'device-b', paymentId: null }, Date.now())
    assert.equal(b.result.kind, 'pending')
    assert.equal(b.paymentId, a.ok ? a.data.id : 'x')
  })

  it('DONE (PAYMENT_ALREADY_PAID): reads the payment and shows paid only with PAID + paidAt (H1)', async () => {
    const { client, id, quoteId } = await quotedOrder()
    const a = await createInvoice(client, id, quoteId, 'device-a')
    if (!a.ok) return assert.fail('invoice')
    for (let i = 0; i < 3; i += 1) await getInvoice(client, id, a.data.id) // mock pays on the 3rd read
    const b = await recoverPayment(client, { orderId: id, quoteId, key: 'device-b', paymentId: null }, Date.now())
    assert.ok(b.result.kind === 'paid' && b.result.paidAt && b.result.invoice.isMock)
  })

  it('WAIT (PAYMENT_UNCONFIRMED): no QR, unconfirmed until expiresAt; replay never creates another invoice (H2)', async () => {
    const { client, id, quoteId, fetchCount } = await quotedOrder('payment-unconfirmed')
    const first = await recoverPayment(client, { orderId: id, quoteId, key: 'k-wait', paymentId: null }, Date.now())
    assert.equal(first.result.kind, 'unconfirmed')
    if (first.result.kind !== 'unconfirmed') return
    assert.ok(first.paymentId)
    assert.equal(first.result.invoice?.qrText ?? null, null)
    const again = await recoverPayment(client, { orderId: id, quoteId, key: 'k-wait', paymentId: first.paymentId }, Date.now())
    assert.equal(again.result.kind, 'unconfirmed')
    const other = await recoverPayment(client, { orderId: id, quoteId, key: 'k-other', paymentId: null }, Date.now())
    assert.equal(other.paymentId, first.paymentId)
    assert.ok(fetchCount() > 0)
  })

  it('NEW_QUOTE (PAYMENT_PROVIDER_ERROR): no retry with the same key; a new quote is required (H5)', async () => {
    const { client, id, quoteId } = await quotedOrder('payment-provider-error')
    const r = await recoverPayment(client, { orderId: id, quoteId, key: 'k-rej', paymentId: null }, Date.now())
    assert.equal(r.result.kind, 'new_quote')
    const same = await recoverPayment(client, { orderId: id, quoteId, key: 'k-rej', paymentId: null }, Date.now())
    assert.equal(same.result.kind, 'new_quote')
    const old = await createInvoice(client, id, quoteId, 'k-new')
    assert.equal(old.ok ? '' : old.code, 'QUOTE_MISMATCH') // the old quote is no longer valid
  })

  it('CONTACT_SUPPORT (PAYMENT_RECONCILIATION_REQUIRED): no retry, no invoice (H3)', async () => {
    const { client, id, quoteId } = await quotedOrder('payment-reconciliation')
    const first = await recoverPayment(client, { orderId: id, quoteId, key: 'k-1', paymentId: null }, Date.now())
    assert.equal(first.result.kind, 'reconciliation')
    const other = await recoverPayment(client, { orderId: id, quoteId, key: 'k-2', paymentId: null }, Date.now())
    assert.equal(other.result.kind, 'reconciliation')
  })

  it('a PENDING payment without a QR is never shown as payable', () => {
    const out = invoiceOutcome(
      { id: 'p', paidAt: null, isMock: false, mode: 'sandbox', status: 'PENDING', amountMnt: 1, qrText: null, qrImageBase64: null, failureCode: 'PROVIDER_UNCONFIRMED', deeplinks: [], expiresAt: new Date(Date.now() + 60_000).toISOString() },
      Date.now(),
    )
    assert.equal(out.kind, 'unconfirmed')
  })
})
