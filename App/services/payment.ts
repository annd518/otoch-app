// QPay invoice and status (docs/l1-1-api.md §7, proposal, not implemented on
// the server). Pure logic: parsing, deeplink filtering and polling decisions.
import { isRecord, markNotImplemented, type ApiResult } from './apiResult'
import type { HttpClient } from './httpClient'

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED'
const STATUSES: readonly PaymentStatus[] = ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED']

export interface BankDeeplink {
  name: string
  logo: string | null
  link: string
}

export interface Invoice {
  id: string
  paidAt: string | null
  // true for the backend's QPAY_MODE=mock invoices: not QPay, not payable
  isMock: boolean
  mode: string | null
  status: PaymentStatus
  amountMnt: number
  // null when the provider result is unconfirmed (no payable QR exists)
  qrText: string | null
  qrImageBase64: string | null
  failureCode: string | null
  deeplinks: BankDeeplink[]
  expiresAt: string
}

export interface PaymentState {
  id: string
  status: PaymentStatus
  amountMnt: number
  paidAt: string | null
  orderStatus: string | null
  // e.g. AMOUNT_MISMATCH: the provider saw a payment but the server did not accept it
  failureCode: string | null
  isMock: boolean
}

export const PAYMENT_NOT_IMPLEMENTED_MESSAGE = 'QPay төлбөр одоогоор боломжгүй: серверт хараахан хэрэгжээгүй байна.'
export const POLL_INTERVAL_MS = 4000

const text = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const isStatus = (v: unknown): v is PaymentStatus => typeof v === 'string' && (STATUSES as readonly string[]).includes(v)

// Only bank app links from the backend are shown, and only custom app
// schemes: web, javascript, file, data and intent links are dropped.
const BLOCKED_SCHEMES = ['http', 'https', 'javascript', 'file', 'data', 'intent', 'content', 'about', 'tel', 'sms', 'mailto']

export function safeDeeplinks(value: unknown): BankDeeplink[] {
  if (!Array.isArray(value)) return []
  const out: BankDeeplink[] = []
  for (const item of value) {
    if (!isRecord(item) || !text(item.name) || !text(item.link)) continue
    const match = /^([a-z][a-z0-9+.-]*):\/\//i.exec(item.link)
    if (!match || BLOCKED_SCHEMES.includes(match[1].toLowerCase())) continue
    out.push({ name: item.name, logo: text(item.logo) && /^https:\/\//.test(item.logo) ? item.logo : null, link: item.link })
  }
  return out
}

export function parseInvoice(data: unknown): Invoice | null {
  if (!isRecord(data) || !isRecord(data.payment)) return null
  const p = data.payment
  if (!text(p.id) || !isStatus(p.status) || typeof p.amountMnt !== 'number' || !Number.isInteger(p.amountMnt)) return null
  // qrText is optional: an unconfirmed invoice (PROVIDER_UNCONFIRMED) has none.
  if (!text(p.expiresAt) || Number.isNaN(Date.parse(p.expiresAt))) return null
  return {
    id: p.id,
    isMock: p.isMock === true || p.mode === 'mock' || (text(p.qrText) && p.qrText.startsWith('MOCK_')),
    mode: text(p.mode) ? p.mode : null,
    status: p.status,
    amountMnt: p.amountMnt,
    qrText: text(p.qrText) ? p.qrText : null,
    failureCode: text(p.failureCode) ? p.failureCode : null,
    qrImageBase64: text(p.qrImageBase64) && /^[A-Za-z0-9+/=]+$/.test(p.qrImageBase64) ? p.qrImageBase64 : null,
    deeplinks: safeDeeplinks(p.deeplinks),
    expiresAt: p.expiresAt,
    paidAt: text(p.paidAt) ? p.paidAt : null,
  }
}

export function parsePaymentState(data: unknown): PaymentState | null {
  if (!isRecord(data) || !isRecord(data.payment)) return null
  const p = data.payment
  if (!text(p.id) || !isStatus(p.status) || typeof p.amountMnt !== 'number') return null
  // PAID without a paidAt timestamp is not accepted as paid.
  if (p.status === 'PAID' && !text(p.paidAt)) return null
  return {
    id: p.id,
    status: p.status,
    amountMnt: p.amountMnt,
    paidAt: text(p.paidAt) ? p.paidAt : null,
    orderStatus: text(data.orderStatus) ? data.orderStatus : null,
    failureCode: text(p.failureCode) ? p.failureCode : null,
    isMock: p.isMock === true || p.mode === 'mock',
  }
}

export async function createInvoice(
  client: HttpClient,
  orderId: string,
  quoteId: string,
  idempotencyKey: string,
): Promise<ApiResult<Invoice>> {
  const result = await client.request({
    method: 'POST',
    path: `/api/orders/${encodeURIComponent(orderId)}/payments/qpay`,
    body: { quoteId },
    headers: { 'Idempotency-Key': idempotencyKey },
    parse: parseInvoice,
  })
  if (!result.ok && (result.status === 501 || result.code === 'PAYMENT_UNAVAILABLE')) {
    return { ok: false, kind: 'not_implemented', status: result.status, message: PAYMENT_NOT_IMPLEMENTED_MESSAGE }
  }
  return markNotImplemented(result, PAYMENT_NOT_IMPLEMENTED_MESSAGE)
}

// 409 PAYMENT_IN_PROGRESS carries the pending payment id: the screen resumes
// polling it instead of creating a second invoice.
export function inProgressPaymentId(result: ApiResult<unknown>): string | null {
  if (result.ok || result.code !== 'PAYMENT_IN_PROGRESS') return null
  return result.fields?.paymentId ?? null
}

export async function getPaymentState(client: HttpClient, orderId: string, paymentId: string): Promise<ApiResult<PaymentState>> {
  const result = await client.request({
    method: 'GET',
    path: `/api/orders/${encodeURIComponent(orderId)}/payments/${encodeURIComponent(paymentId)}`,
    parse: parsePaymentState,
  })
  return markNotImplemented(result, PAYMENT_NOT_IMPLEMENTED_MESSAGE)
}

export type PollDecision = 'poll' | 'paid' | 'stop_failed' | 'expired'

// What the payment screen does after a status read.
export function pollDecision(status: PaymentStatus, expiresAt: string, nowMs: number): PollDecision {
  if (status === 'PAID') return 'paid'
  if (status === 'FAILED' || status === 'CANCELLED') return 'stop_failed'
  if (status === 'EXPIRED' || Date.parse(expiresAt) <= nowMs) return 'expired'
  return 'poll'
}

// ---- Recovery (docs/l1-1-api.md §7.1.1, backend 8f6309f) -----------------------
// What the device remembers about an invoice attempt (no amounts, no QR):
// enough to replay the same create (same key + same quote) or read the status.
export interface PaymentRecord {
  orderId: string
  quoteId: string
  key: string
  paymentId: string | null
}

export type RecoveryHint = 'RESUME' | 'DONE' | 'WAIT' | 'NEW_QUOTE' | 'CONTACT_SUPPORT'

export interface RecoveryFields {
  paymentId: string | null
  paymentStatus: string | null
  recovery: RecoveryHint | null
  expiresAt: string | null
}

const HINTS: readonly RecoveryHint[] = ['RESUME', 'DONE', 'WAIT', 'NEW_QUOTE', 'CONTACT_SUPPORT']

// Reads error.fields of a payment 409/502 (all values are strings).
export function recoveryFields(result: ApiResult<unknown>): RecoveryFields | null {
  if (result.ok || !result.fields) return null
  const f = result.fields
  const recovery = (HINTS as readonly string[]).includes(f.recovery ?? '') ? (f.recovery as RecoveryHint) : null
  if (!f.paymentId && !recovery) return null
  return { paymentId: f.paymentId ?? null, paymentStatus: f.paymentStatus ?? null, recovery, expiresAt: f.expiresAt ?? null }
}

export type RecoveryResult =
  | { kind: 'pending'; invoice: Invoice }
  | { kind: 'paid'; invoice: Invoice; paidAt: string }
  // provider result unknown: no QR, wait until expiresAt, never a new invoice
  | { kind: 'unconfirmed'; paymentId: string; expiresAt: string | null; invoice: Invoice | null }
  | { kind: 'expired'; invoice: Invoice | null }
  | { kind: 'failed'; invoice: Invoice }
  // invoice not created: a new quote and a new key are needed
  | { kind: 'new_quote'; message: string }
  // money may have moved outside our records: no retry, no new invoice
  | { kind: 'reconciliation'; message: string }
  | { kind: 'unavailable'; message: string }
  | { kind: 'error'; message: string }
  // legacy server (before 8f6309f): order waits for a payment this device cannot identify
  | { kind: 'unknown_pending'; message: string }

export const UNKNOWN_PENDING_MESSAGE =
  'Энэ захиалгад төлбөр хүлээгдэж байгаа ч энэ төхөөрөмж тэр нэхэмжлэхийг сэргээж чадахгүй байна. Шинэ нэхэмжлэх үүсгэхгүй.'
export const RECONCILIATION_MESSAGE =
  'Энэ төлбөрийг гараар шалгах шаардлагатай. Дахин төлбөр бүү хийнэ үү. Шийдэгдтэл шинэ нэхэмжлэх үүсгэхгүй.'
export const NEW_QUOTE_MESSAGE = 'Нэхэмжлэх үүсээгүй. Шинэ үнийн санал авч дахин оролдоно уу.'

// Classifies a server payment. PAID needs paidAt; a PENDING payment without a
// QR (or flagged PROVIDER_UNCONFIRMED) is "unconfirmed", never payable.
export function invoiceOutcome(invoice: Invoice, nowMs: number): RecoveryResult {
  if (invoice.failureCode === 'NEEDS_RECONCILIATION' || invoice.failureCode === 'PAID_AFTER_EXPIRY') {
    return { kind: 'reconciliation', message: RECONCILIATION_MESSAGE }
  }
  if (invoice.status === 'PAID') {
    return invoice.paidAt
      ? { kind: 'paid', invoice, paidAt: invoice.paidAt }
      : { kind: 'unconfirmed', paymentId: invoice.id, expiresAt: invoice.expiresAt, invoice }
  }
  if (invoice.status === 'FAILED' || invoice.status === 'CANCELLED') return { kind: 'failed', invoice }
  if (invoice.status === 'EXPIRED' || Date.parse(invoice.expiresAt) <= nowMs) return { kind: 'expired', invoice }
  if (!invoice.qrText || invoice.failureCode === 'PROVIDER_UNCONFIRMED') {
    return { kind: 'unconfirmed', paymentId: invoice.id, expiresAt: invoice.expiresAt, invoice }
  }
  return { kind: 'pending', invoice }
}

// GET payment returns the full payment (QR when one exists).
export async function getInvoice(client: HttpClient, orderId: string, paymentId: string): Promise<ApiResult<Invoice>> {
  const result = await client.request({
    method: 'GET',
    path: `/api/orders/${encodeURIComponent(orderId)}/payments/${encodeURIComponent(paymentId)}`,
    parse: parseInvoice,
  })
  return markNotImplemented(result, PAYMENT_NOT_IMPLEMENTED_MESSAGE)
}

/**
 * Development only: marks a MOCK invoice paid (the server answers 404 unless
 * QPAY_MODE=mock and not production). Never reaches QPay.
 */
export function devMockPay(client: HttpClient, orderId: string, paymentId: string): Promise<ApiResult<true>> {
  return client.request({
    method: 'POST',
    path: `/api/dev/qpay-mock/orders/${encodeURIComponent(orderId)}/payments/${encodeURIComponent(paymentId)}/pay`,
    body: {},
    parse: () => true as const,
  })
}

function fromFailure(result: { kind: string; message: string }): RecoveryResult {
  if (result.kind === 'not_implemented') return { kind: 'unavailable', message: result.message }
  return { kind: 'error', message: result.message }
}

async function readById(
  client: HttpClient,
  orderId: string,
  paymentId: string,
  nowMs: number,
  fallback?: RecoveryResult,
): Promise<{ result: RecoveryResult; paymentId: string | null }> {
  const read = await getInvoice(client, orderId, paymentId)
  if (read.ok) return { result: invoiceOutcome(read.data, nowMs), paymentId: read.data.id }
  return { result: fallback ?? fromFailure(read), paymentId }
}

// Never creates a second invoice for an order: it reads the remembered payment,
// replays the remembered create (same key + same quote), or follows the
// server's recovery hint (error.fields.recovery).
export async function recoverPayment(
  client: HttpClient,
  record: PaymentRecord,
  nowMs: number,
): Promise<{ result: RecoveryResult; paymentId: string | null }> {
  if (record.paymentId) return readById(client, record.orderId, record.paymentId, nowMs)

  const created = await createInvoice(client, record.orderId, record.quoteId, record.key)
  if (created.ok) return { result: invoiceOutcome(created.data, nowMs), paymentId: created.data.id }

  const hint = recoveryFields(created)
  if (hint?.recovery === 'CONTACT_SUPPORT' || created.code === 'PAYMENT_RECONCILIATION_REQUIRED') {
    return { result: { kind: 'reconciliation', message: RECONCILIATION_MESSAGE }, paymentId: hint?.paymentId ?? null }
  }
  if (hint?.recovery === 'NEW_QUOTE') return { result: { kind: 'new_quote', message: NEW_QUOTE_MESSAGE }, paymentId: null }
  if (hint?.paymentId && hint.recovery === 'WAIT') {
    // No QR exists yet: read the status if possible, otherwise just wait.
    return readById(client, record.orderId, hint.paymentId, nowMs, {
      kind: 'unconfirmed',
      paymentId: hint.paymentId,
      expiresAt: hint.expiresAt,
      invoice: null,
    })
  }
  if (hint?.paymentId) {
    // RESUME (PAYMENT_IN_PROGRESS) or DONE (PAYMENT_ALREADY_PAID): read the server's
    // payment; "paid" is shown only if that read says PAID with paidAt.
    return readById(client, record.orderId, hint.paymentId, nowMs)
  }
  // Compatibility with servers before 8f6309f, which answered ORDER_NOT_EDITABLE.
  if (created.code === 'ORDER_NOT_EDITABLE') return { result: { kind: 'unknown_pending', message: UNKNOWN_PENDING_MESSAGE }, paymentId: null }
  if (created.code === 'QUOTE_MISMATCH' || created.code === 'QUOTE_EXPIRED') return { result: { kind: 'expired', invoice: null }, paymentId: null }
  return { result: fromFailure(created), paymentId: null }
}
