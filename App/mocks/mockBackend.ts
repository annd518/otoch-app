// FABRICATED development backend for endpoints the server has not implemented.
// Response shapes follow docs/l1-1-api.md §2-§5 (proposal). Used only when
// utils/env.ts enables mocks, which is never the case in release builds.
//
// Scenario tokens (EXPO_PUBLIC_MOCK_SCENARIO, comma separated):
//   empty | error                 catalog empty / 500
//   order-network-error-once      first POST /api/orders fails with a network error
//   redflag-load-error            questionnaire request fails (500)
//   redflag-submit-error          answers request fails (500)
//   upload-fail-once              first upload fails mid-way (network error)
import type { FetchLike, HttpResponseLike, UploadLike } from '../services/httpClient'
import { isRecord } from '../services/apiResult'
import { pathOfUrl } from '../services/endpoints'
import { mockCatalogResponse, parseCatalogMockScenario } from './catalogMock'

export const DEV_FIXTURE_QUESTIONNAIRE = 'DEV_FIXTURE_V0'

// NOT medically approved. Structural placeholders for UI development only.
export const DEV_FIXTURE_QUESTIONS = [
  { id: 'rfq_dev_1', code: 'CHEST_PAIN', text: '[DEV FIXTURE] Одоо цээжээр хүчтэй өвдөж байна уу?' },
  { id: 'rfq_dev_2', code: 'BREATHING', text: '[DEV FIXTURE] Амьсгал давчдаж, ярихад хэцүү байна уу?' },
  { id: 'rfq_dev_3', code: 'CONSCIOUSNESS', text: '[DEV FIXTURE] Ухаан балартах эсвэл ухаан алдах шинж байна уу?' },
  { id: 'rfq_dev_4', code: 'STROKE_SIGNS', text: '[DEV FIXTURE] Нүүр мурийх, гар хөл гэнэт сулрах, яриа ойлгомжгүй болох шинж байна уу?' },
  { id: 'rfq_dev_5', code: 'SEVERE_BLEEDING', text: '[DEV FIXTURE] Зогсохгүй хүчтэй цус алдалт байна уу?' },
].map((q) => ({ ...q, type: 'BOOLEAN', required: true }))

interface MockOrder {
  id: string
  status: string
  version: number
  parentId: string
  items: unknown
  scheduledFor: string
  timeSlot: string
  address: unknown
  redFlag: { status: string; triggeredCodes?: string[] }
  requiresReferral: boolean
  attachments: { id: string; mimeType: string }[]
}

export interface MockBackendOptions {
  scenario?: string
  sleep?: (ms: number) => Promise<void>
}

const respond = (status: number, body?: unknown): HttpResponseLike => ({
  status,
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
})

const fail = (status: number, code: string, message: string, fields?: Record<string, string>) =>
  respond(status, { success: false, message, error: fields ? { code, fields } : { code } })

const OFFSET_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

function validateDraftBody(body: unknown, partial: boolean): Record<string, string> {
  const fields: Record<string, string> = {}
  if (!isRecord(body)) return { _: 'Body буруу' }
  if (!partial && typeof body.parentId !== 'string') fields.parentId = 'Заавал'
  if (!partial || body.items !== undefined) {
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 5) fields.items = '1-5 үйлчилгээ'
  }
  if (!partial || body.scheduledFor !== undefined) {
    if (typeof body.scheduledFor !== 'string' || !OFFSET_ISO.test(body.scheduledFor)) fields.scheduledFor = 'Offset-тэй ISO огноо'
  }
  if (!partial || body.timeSlot !== undefined) {
    if (typeof body.timeSlot !== 'string' || !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(body.timeSlot)) fields.timeSlot = 'HH:MM-HH:MM'
  }
  if (!partial || body.address !== undefined) {
    const text = isRecord(body.address) ? body.address.text : undefined
    if (typeof text !== 'string' || text.trim().length < 5 || text.trim().length > 300) fields['address.text'] = '5-300 тэмдэгт'
  }
  return fields
}

export function createMockBackend(options: MockBackendOptions = {}) {
  const tokens = new Set((options.scenario ?? '').split(',').map((t) => t.trim()).filter(Boolean))
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const orders = new Map<string, MockOrder>()
  const byIdempotencyKey = new Map<string, string>()
  let seq = 0
  let failOrderOnce = tokens.has('order-network-error-once')
  let failUploadOnce = tokens.has('upload-fail-once')

  const orderView = (o: MockOrder) => ({
    id: o.id,
    status: o.status,
    version: o.version,
    parentId: o.parentId,
    items: o.items,
    scheduledFor: o.scheduledFor,
    timeSlot: o.timeSlot,
    address: o.address,
    redFlag: o.redFlag,
    attachments: o.attachments,
    quote: null,
    requirements: { redFlagAnswers: true, referralAttachment: o.requiresReferral },
  })

  const fetch: FetchLike = async (url, init) => {
    await sleep(300)
    const path = pathOfUrl(url)
    const body: unknown = init.body ? JSON.parse(init.body) : undefined

    if (path === '/api/catalog/services' && init.method === 'GET') {
      const scenario = parseCatalogMockScenario(tokens.has('empty') ? 'empty' : tokens.has('error') ? 'error' : 'ok')
      const r = mockCatalogResponse(scenario)
      return respond(r.status, r.body)
    }

    if (path === '/api/orders' && init.method === 'POST') {
      if (failOrderOnce) {
        failOrderOnce = false
        throw new TypeError('Network request failed (mock)')
      }
      const key = init.headers['Idempotency-Key']
      const existing = key ? byIdempotencyKey.get(key) : undefined
      if (existing) {
        const order = orders.get(existing)
        if (order) return respond(200, { success: true, message: 'Ноорог (давтан хүсэлт)', data: { order: orderView(order) } })
      }
      const fields = validateDraftBody(body, false)
      if (Object.keys(fields).length > 0 || !isRecord(body)) return fail(400, 'VALIDATION_ERROR', 'Оруулсан мэдээлэл буруу байна', fields)
      seq += 1
      const items = Array.isArray(body.items) ? body.items : []
      const first = isRecord(items[0]) ? items[0] : {}
      const order: MockOrder = {
        id: `ord_mock_${seq}`,
        status: 'DRAFT',
        version: 1,
        parentId: String(body.parentId),
        items,
        scheduledFor: String(body.scheduledFor),
        timeSlot: String(body.timeSlot),
        address: body.address,
        redFlag: { status: 'NOT_ANSWERED' },
        requiresReferral: typeof first.serviceCode === 'string' && first.serviceCode.includes('IV'),
        attachments: [],
      }
      orders.set(order.id, order)
      if (key) byIdempotencyKey.set(key, order.id)
      return respond(201, { success: true, message: 'Ноорог үүслээ (mock)', data: { order: orderView(order) } })
    }

    const orderMatch = /^\/api\/orders\/([^/]+)(\/.*)?$/.exec(path)
    const order = orderMatch ? orders.get(decodeURIComponent(orderMatch[1])) : undefined
    const sub = orderMatch?.[2] ?? ''
    if (orderMatch && !order) return fail(404, 'ORDER_NOT_FOUND', 'Захиалга олдсонгүй')

    if (order && sub === '' && init.method === 'GET') {
      return respond(200, { success: true, message: 'Захиалга', data: { order: orderView(order) } })
    }
    if (order && sub === '' && init.method === 'PATCH') {
      if (order.status !== 'DRAFT') return fail(409, 'ORDER_NOT_EDITABLE', 'Захиалгыг засах боломжгүй')
      if (!isRecord(body) || body.version !== order.version) return fail(409, 'VERSION_CONFLICT', 'Захиалга өөр газар өөрчлөгдсөн байна')
      const fields = validateDraftBody(body, true)
      if (Object.keys(fields).length > 0) return fail(400, 'VALIDATION_ERROR', 'Оруулсан мэдээлэл буруу байна', fields)
      if (Array.isArray(body.items)) order.items = body.items
      if (typeof body.scheduledFor === 'string') order.scheduledFor = body.scheduledFor
      if (typeof body.timeSlot === 'string') order.timeSlot = body.timeSlot
      if (body.address !== undefined) order.address = body.address
      order.version += 1
      return respond(200, { success: true, message: 'Ноорог шинэчлэгдлээ (mock)', data: { order: orderView(order) } })
    }

    if (order && sub === '/red-flag-questions' && init.method === 'GET') {
      if (tokens.has('redflag-load-error')) return fail(500, 'INTERNAL_ERROR', 'Асуулга ачаалахад алдаа гарлаа (mock)')
      return respond(200, {
        success: true,
        message: 'Асуулга (mock)',
        data: { questionnaire: DEV_FIXTURE_QUESTIONNAIRE, approved: false, questions: DEV_FIXTURE_QUESTIONS },
      })
    }
    if (order && sub === '/red-flag-answers' && init.method === 'PUT') {
      if (tokens.has('redflag-submit-error')) return fail(500, 'INTERNAL_ERROR', 'Хариулт хадгалахад алдаа гарлаа (mock)')
      if (order.status !== 'DRAFT') return fail(409, 'ORDER_NOT_EDITABLE', 'Захиалгыг засах боломжгүй')
      const answers = isRecord(body) && Array.isArray(body.answers) ? body.answers : []
      const answered = new Map<string, boolean>()
      for (const a of answers) if (isRecord(a) && typeof a.questionId === 'string' && typeof a.value === 'boolean') answered.set(a.questionId, a.value)
      const missing = DEV_FIXTURE_QUESTIONS.filter((q) => !answered.has(q.id))
      if (missing.length > 0) return fail(400, 'VALIDATION_ERROR', 'Бүх асуултад хариулна уу')
      const triggered = DEV_FIXTURE_QUESTIONS.filter((q) => answered.get(q.id) === true).map((q) => q.code)
      if (triggered.length > 0) {
        order.status = 'BLOCKED_RED_FLAG'
        order.redFlag = { status: 'FLAGGED', triggeredCodes: triggered }
        return respond(200, {
          success: true,
          message: 'Яаралтай тусламж шаардлагатай байж болзошгүй',
          data: {
            redFlag: order.redFlag,
            orderStatus: order.status,
            advice: { text: 'Яаралтай тусламжийн 103 дугаарт залгана уу.', phone: '103' },
          },
        })
      }
      order.redFlag = { status: 'CLEAR' }
      return respond(200, { success: true, message: 'Хариулт хадгалагдлаа (mock)', data: { redFlag: { status: 'CLEAR' }, orderStatus: order.status } })
    }

    const deleteMatch = /^\/attachments\/([^/]+)$/.exec(sub)
    if (order && deleteMatch && init.method === 'DELETE') {
      order.attachments = order.attachments.filter((a) => a.id !== decodeURIComponent(deleteMatch[1]))
      return respond(204)
    }

    return fail(404, 'NOT_FOUND', 'Mock зам олдсонгүй')
  }

  const upload: UploadLike = async (request) => {
    const path = pathOfUrl(request.url)
    const match = /^\/api\/orders\/([^/]+)\/attachments$/.exec(path)
    const order = match ? orders.get(decodeURIComponent(match[1])) : undefined
    if (!order) return fail(404, 'ORDER_NOT_FOUND', 'Захиалга олдсонгүй')
    for (const step of [0.2, 0.45, 0.7]) {
      await sleep(150)
      request.onProgress?.(step)
    }
    if (failUploadOnce) {
      failUploadOnce = false
      throw new TypeError('Network request failed (mock upload)')
    }
    if (order.status !== 'DRAFT') return fail(409, 'ORDER_NOT_EDITABLE', 'Захиалгыг засах боломжгүй')
    if (request.file.type !== 'image/jpeg' && request.file.type !== 'image/png') {
      return fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'Зөвхөн JPEG эсвэл PNG')
    }
    if (order.attachments.length >= 5) return fail(400, 'VALIDATION_ERROR', 'Нэг захиалгад 5 хүртэл файл')
    await sleep(150)
    request.onProgress?.(1)
    seq += 1
    const attachment = { id: `att_mock_${seq}`, kind: 'REFERRAL', mimeType: request.file.type, sizeBytes: 0 }
    order.attachments.push({ id: attachment.id, mimeType: attachment.mimeType })
    return respond(201, { success: true, message: 'Файл хадгалагдлаа (mock, серверт хадгалагдаагүй)', data: { attachment } })
  }

  return { fetch, upload }
}
