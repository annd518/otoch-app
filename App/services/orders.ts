// Draft order, red flag and attachment calls (docs/l1-1-api.md §3-§5).
// Pure: takes an HttpClient, no React Native imports.
import { isRecord, markNotImplemented, type ApiResult } from './apiResult'
import type {
  Attachment,
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
  return {
    id: o.id,
    status: o.status,
    version: o.version,
    parentId: o.parentId,
    scheduledFor: text(o.scheduledFor) ? o.scheduledFor : null,
    timeSlot: text(o.timeSlot) ? o.timeSlot : null,
    redFlagStatus: redFlag,
    requiresReferral: requirements.referralAttachment === true,
  }
}

export function parseRedFlagQuestionnaire(data: unknown): RedFlagQuestionnaire | null {
  if (!isRecord(data) || !text(data.questionnaire) || !Array.isArray(data.questions) || data.questions.length === 0) {
    return null
  }
  const questions: RedFlagQuestion[] = []
  for (const q of data.questions) {
    // Only yes/no questions are supported; anything else must not be skipped silently.
    if (!isRecord(q) || !text(q.id) || !text(q.code) || !text(q.text) || q.type !== 'BOOLEAN') return null
    questions.push({ id: q.id, code: q.code, text: q.text, required: q.required !== false })
  }
  return { questionnaire: data.questionnaire, approved: data.approved === true, questions }
}

function parseAdvice(value: unknown): RedFlagAdvice | null {
  if (!isRecord(value) || !text(value.text) || !text(value.phone)) return null
  return { text: value.text, phone: value.phone }
}

export function parseRedFlagOutcome(data: unknown): RedFlagOutcome | null {
  if (!isRecord(data) || !isRecord(data.redFlag) || !text(data.orderStatus)) return null
  const { status } = data.redFlag
  if (status === 'CLEAR') return { status: 'CLEAR', orderStatus: data.orderStatus }
  if (status === 'FLAGGED') {
    const codes = Array.isArray(data.redFlag.triggeredCodes)
      ? data.redFlag.triggeredCodes.filter((c): c is string => typeof c === 'string')
      : []
    return { status: 'FLAGGED', orderStatus: data.orderStatus, triggeredCodes: codes, advice: parseAdvice(data.advice) }
  }
  return null
}

export function parseAttachment(data: unknown): Attachment | null {
  if (!isRecord(data) || !isRecord(data.attachment)) return null
  const a = data.attachment
  if (!text(a.id) || !text(a.kind) || !text(a.mimeType) || typeof a.sizeBytes !== 'number') return null
  return { id: a.id, kind: a.kind, mimeType: a.mimeType, sizeBytes: a.sizeBytes }
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
): Promise<ApiResult<RedFlagOutcome>> {
  const result = await client.request({
    method: 'PUT',
    path: orderPaths.redFlagAnswers(orderId),
    body: { answers },
    parse: parseRedFlagOutcome,
  })
  return markNotImplemented(result, RED_FLAG_NOT_IMPLEMENTED_MESSAGE)
}

export async function uploadReferral(
  client: HttpClient,
  orderId: string,
  file: UploadFile,
  onProgress?: (fraction: number) => void,
): Promise<ApiResult<Attachment>> {
  const result = await client.upload({
    path: orderPaths.attachments(orderId),
    file,
    fields: { kind: 'REFERRAL' },
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
