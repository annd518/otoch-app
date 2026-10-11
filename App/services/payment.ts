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
  // true for the backend's QPAY_MODE=mock invoices: not QPay, not payable
  isMock: boolean
  mode: string | null
  status: PaymentStatus
  amountMnt: number
  qrText: string
  qrImageBase64: string | null
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
  if (!text(p.qrText) || !text(p.expiresAt) || Number.isNaN(Date.parse(p.expiresAt))) return null
  return {
    id: p.id,
    isMock: p.isMock === true || p.mode === 'mock' || p.qrText.startsWith('MOCK_'),
    mode: text(p.mode) ? p.mode : null,
    status: p.status,
    amountMnt: p.amountMnt,
    qrText: p.qrText,
    qrImageBase64: text(p.qrImageBase64) && /^[A-Za-z0-9+/=]+$/.test(p.qrImageBase64) ? p.qrImageBase64 : null,
    deeplinks: safeDeeplinks(p.deeplinks),
    expiresAt: p.expiresAt,
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
