// Draft order, red flag and attachment calls (docs/l1-1-api.md §3-§5).
// Pure: takes an HttpClient, no React Native imports.
import { isRecord, markNotImplemented, type ApiResult } from './apiResult'
import { parseQuote } from './validators'
import type {
  Attachment,
  Quote,
  DraftOrderInput,
  DraftOrderPatch,
  Order,
  RedFlagAdvice,
  RedFlagOutcome,
  RedFlagQuestion,
  RedFlagQuestionnaire,
} from './apiTypes'
import type { HttpClient, UploadFile } from './httpClient'

export const ORDERS_NOT_IMPLEMENTED_MESSAGE = 'Захиалгын (draft) API серверт хараахан нэмэгдээгүй байна.'
export const RED_FLAG_NOT_IMPLEMENTED_MESSAGE = 'Red flag асуулгын API серверт хараахан нэмэгдээгүй байна.'
export const ATTACHMENTS_NOT_IMPLEMENTED_MESSAGE = 'Зураг хадгалах API серверт хараахан нэмэгдээгүй байна.'

export const orderPaths = {
  create: '/api/orders',
  byId: (id: string) => `/api/orders/${encodeURIComponent(id)}`,
  redFlagQuestions: (id: string) => `/api/orders/${encodeURIComponent(id)}/red-flag-questions`,
  redFlagAnswers: (id: string) => `/api/orders/${encodeURIComponent(id)}/red-flag-answers`,
  attachments: (id: string) => `/api/orders/${encodeURIComponent(id)}/attachments`,
  attachment: (id: string, attachmentId: string) =>
    `/api/orders/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
}

const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

export function parseOrder(data: unknown): Order | null {
  if (!isRecord(data) || !isRecord(data.order)) return null
  const o = data.order
  if (!text(o.id) || !text(o.status) || typeof o.version !== 'number' || !Number.isInteger(o.version) || !text(o.parentId)) {
    return null
  }
  const redFlag = isRecord(o.redFlag) && text(o.redFlag.status) ? o.redFlag.status : 'NOT_ANSWERED'
  const requirements = isRecord(o.requirements) ? o.requirements : {}
  const items = Array.isArray(o.items) ? o.items : []
  const ignored = Array.isArray(data.ignoredFields) ? data.ignoredFields.filter((f): f is string => typeof f === 'string') : []
  return {
    id: o.id,
    status: o.status,
    version: o.version,
    parentId: o.parentId,
    serviceCodes: items.flatMap((i) => (isRecord(i) && text(i.serviceCode) ? [i.serviceCode] : [])),
    scheduledFor: text(o.scheduledFor) ? o.scheduledFor : null,
    timeSlot: text(o.timeSlot) ? o.timeSlot : null,
    redFlagStatus: redFlag,
    requiresReferral: requirements.referralAttachment === true,
    referralUploadAvailable:
      typeof requirements.referralUploadAvailable === 'boolean' ? requirements.referralUploadAvailable : null,
    ignoredFields: ignored,
  }
}

// Accepts the implemented shape (work/backend-l1-1: `questionnaires` array,
// per-question `isFixture`, no `type`) and the original proposal
// (`questionnaire` string, `type: "BOOLEAN"`).
export function parseRedFlagQuestionnaire(data: unknown): RedFlagQuestionnaire | null {
  if (!isRecord(data) || !Array.isArray(data.questions)) return null
  let questionnaires: string[]
  if (Array.isArray(data.questionnaires)) {
    if (!data.questionnaires.every(text)) return null
    questionnaires = data.questionnaires.filter(text)
  } else if (text(data.questionnaire)) {
    questionnaires = [data.questionnaire]
  } else {
    return null
  }
  const questions: RedFlagQuestion[] = []
  for (const q of data.questions) {
    // Only yes/no questions are supported; anything else must not be skipped silently.
    if (!isRecord(q) || !text(q.id) || !text(q.code) || !text(q.text)) return null
    if (q.type !== undefined && q.type !== 'BOOLEAN') return null
    questions.push({ id: q.id, code: q.code, text: q.text, required: q.required !== false, isFixture: q.isFixture === true })
  }
  // Questions without a questionnaire, or a questionnaire without questions, is inconsistent.
  if ((questions.length === 0) !== (questionnaires.length === 0)) return null
  const redFlag = isRecord(data.redFlag) && text(data.redFlag.status) ? data.redFlag.status : null
  return {
    questionnaires,
    approved: data.approved === true,
    containsFixtures: data.containsFixtures === true || questions.some((q) => q.isFixture),
    orderStatus: text(data.orderStatus) ? data.orderStatus : null,
    redFlagStatus: redFlag,
    questions,
  }
}

function parseAdvice(value: unknown): RedFlagAdvice | null {
  if (!isRecord(value) || !text(value.text)) return null
  return { text: value.text, phone: text(value.phone) ? value.phone : null, isFixture: value.isFixture === true }
}

export function parseRedFlagOutcome(data: unknown): RedFlagOutcome | null {
  if (!isRecord(data) || !isRecord(data.redFlag) || !text(data.orderStatus)) return null
  const { status } = data.redFlag
  const version = typeof data.version === 'number' && Number.isInteger(data.version) ? data.version : null
  if (status === 'CLEAR') return { status: 'CLEAR', orderStatus: data.orderStatus, version }
  if (status === 'FLAGGED') {
    const codes = Array.isArray(data.redFlag.triggeredCodes)
      ? data.redFlag.triggeredCodes.filter((c): c is string => typeof c === 'string')
      : []
    return { status: 'FLAGGED', orderStatus: data.orderStatus, version, triggeredCodes: codes, advice: parseAdvice(data.advice) }
  }
  return null
}

export function parseAttachment(data: unknown): Attachment | null {
  if (!isRecord(data) || !isRecord(data.attachment)) return null
  const a = data.attachment
  if (!text(a.id) || !text(a.kind) || !text(a.mimeType) || typeof a.sizeBytes !== 'number') return null
  return { id: a.id, kind: a.kind, mimeType: a.mimeType, sizeBytes: a.sizeBytes, storage: text(data.storage) ? data.storage : null }
}

export async function createDraftOrder(
  client: HttpClient,
  input: DraftOrderInput,
  idempotencyKey: string,
): Promise<ApiResult<Order>> {
  const result = await client.request({
    method: 'POST',
    path: orderPaths.create,
    body: input,
    headers: { 'Idempotency-Key': idempotencyKey },
    parse: parseOrder,
  })
  return markNotImplemented(result, ORDERS_NOT_IMPLEMENTED_MESSAGE)
}

export async function updateDraftOrder(
  client: HttpClient,
  orderId: string,
  patch: DraftOrderPatch,
): Promise<ApiResult<Order>> {
  const result = await client.request({ method: 'PATCH', path: orderPaths.byId(orderId), body: patch, parse: parseOrder })
  return markNotImplemented(result, ORDERS_NOT_IMPLEMENTED_MESSAGE)
}

export async function getRedFlagQuestions(client: HttpClient, orderId: string): Promise<ApiResult<RedFlagQuestionnaire>> {
  const result = await client.request({
    method: 'GET',
    path: orderPaths.redFlagQuestions(orderId),
    parse: parseRedFlagQuestionnaire,
  })
  return markNotImplemented(result, RED_FLAG_NOT_IMPLEMENTED_MESSAGE)
}

export async function submitRedFlagAnswers(
  client: HttpClient,
  orderId: string,
  answers: { questionId: string; value: boolean }[],
  // Codes of the questionnaire the user saw; the server answers 409
  // QUESTIONNAIRE_OUTDATED if they changed meanwhile.
  questionnaires?: string[],
): Promise<ApiResult<RedFlagOutcome>> {
  const result = await client.request({
    method: 'PUT',
    path: orderPaths.redFlagAnswers(orderId),
    body: questionnaires ? { questionnaires, answers } : { answers },
    parse: parseRedFlagOutcome,
  })
  return markNotImplemented(result, RED_FLAG_NOT_IMPLEMENTED_MESSAGE)
}

export async function uploadReferral(
  client: HttpClient,
  orderId: string,
  file: UploadFile,
  onProgress?: (fraction: number) => void,
  // Stable per selected image so a retry after an unknown outcome can be
  // de-duplicated by the server (proposal GAP-17; ignored by servers without it).
  idempotencyKey?: string,
): Promise<ApiResult<Attachment>> {
  const result = await client.upload({
    path: orderPaths.attachments(orderId),
    file,
    fields: { kind: 'REFERRAL' },
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    parse: parseAttachment,
    onProgress,
  })
  return markNotImplemented(result, ATTACHMENTS_NOT_IMPLEMENTED_MESSAGE)
}

export async function deleteAttachment(client: HttpClient, orderId: string, attachmentId: string): Promise<ApiResult<true>> {
  const result = await client.request({
    method: 'DELETE',
    path: orderPaths.attachment(orderId, attachmentId),
    parse: () => true as const,
  })
  return markNotImplemented(result, ATTACHMENTS_NOT_IMPLEMENTED_MESSAGE)
}

// ---- Early red flag block (mobile plan GAP-13, proposal) --------------------
// There is no dedicated endpoint. The app sends the answers given so far
// (including the "yes") to PUT red-flag-answers. The implemented server
// (16ce810) rejects partial answers with 400 RED_FLAG_INCOMPLETE; the block
// then stays "not recorded on the server" and is retried. It is never CLEAR.
export type BlockReport =
  | { kind: 'recorded'; version: number | null }
  | { kind: 'not_supported'; message: string }
  | { kind: 'retry'; message: string }

export async function reportRedFlagBlock(
  client: HttpClient,
  orderId: string,
  answers: { questionId: string; value: boolean }[],
  questionnaires: string[],
): Promise<BlockReport> {
  const result = await submitRedFlagAnswers(client, orderId, answers, questionnaires)
  if (result.ok) {
    if (result.data.status === 'FLAGGED') return { kind: 'recorded', version: result.data.version }
    // A server answering CLEAR to a "yes" would be a contract violation: keep retrying.
    return { kind: 'retry', message: 'Сервер блокийг бүртгээгүй байна.' }
  }
  if (result.code === 'RED_FLAG_BLOCKED') return { kind: 'recorded', version: null }
  if (result.code === 'RED_FLAG_INCOMPLETE') {
    return { kind: 'not_supported', message: 'Сервер дутуу хариулттай блокийг хараахан хүлээж авдаггүй (GAP-13).' }
  }
  return { kind: 'retry', message: result.message }
}

export function parseOrderList(data: unknown): Order[] | null {
  if (!isRecord(data) || !Array.isArray(data.orders)) return null
  const out: Order[] = []
  for (const item of data.orders) {
    const order = parseOrder({ order: item })
    if (!order) return null
    out.push(order)
  }
  return out
}

// GET /api/orders?status=… (own orders, newest first)
export async function listOrders(client: HttpClient, status: string): Promise<ApiResult<Order[]>> {
  const result = await client.request({
    method: 'GET',
    path: `/api/orders?status=${encodeURIComponent(status)}`,
    parse: parseOrderList,
  })
  return markNotImplemented(result, ORDERS_NOT_IMPLEMENTED_MESSAGE)
}

export async function getOrder(client: HttpClient, orderId: string): Promise<ApiResult<Order>> {
  const result = await client.request({ method: 'GET', path: orderPaths.byId(orderId), parse: parseOrder })
  return markNotImplemented(result, ORDERS_NOT_IMPLEMENTED_MESSAGE)
}

// ---- Quote (docs/l1-1-api.md §6) ---------------------------------------------
export const QUOTE_NOT_IMPLEMENTED_MESSAGE = 'Серверийн үнийн санал (quote) хараахан хэрэгжээгүй байна.'

// orderVersion is required by the implemented server (76b7e9e): a quote is
// only made for the exact order version the user is looking at.
export async function requestQuote(client: HttpClient, orderId: string, orderVersion: number): Promise<ApiResult<Quote>> {
  const result = await client.request({
    method: 'POST',
    path: `${orderPaths.byId(orderId)}/quote`,
    body: { orderVersion },
    parse: parseQuote,
  })
  // 501 NOT_IMPLEMENTED (current server) is never a success.
  if (!result.ok && result.status === 501) return { ok: false, kind: 'not_implemented', status: 501, message: QUOTE_NOT_IMPLEMENTED_MESSAGE }
  return markNotImplemented(result, QUOTE_NOT_IMPLEMENTED_MESSAGE)
}

// A quote is usable only for the order version it was made for.
export function isQuoteStale(quote: Quote, currentOrderVersion: number | null, nowMs: number): boolean {
  if (isQuoteExpired(quote, nowMs)) return true
  return quote.orderVersion !== null && currentOrderVersion !== null && quote.orderVersion !== currentOrderVersion
}

export function isQuoteExpired(quote: Quote, nowMs: number): boolean {
  const expires = Date.parse(quote.expiresAt)
  return Number.isNaN(expires) || expires <= nowMs
}
