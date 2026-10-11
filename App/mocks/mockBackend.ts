// FABRICATED development backend for endpoints the server has not implemented
// or has implemented only on a branch. Response shapes follow the implemented
// server on work/backend-l1-1 (d842241) and docs/l1-1-api.md §2-§5. Used only
// when utils/env.ts enables mocks, which is never the case in release builds.
//
// Scenario tokens (EXPO_PUBLIC_MOCK_SCENARIO, comma separated):
//   empty | error                 catalog empty / 500
//   order-network-error-once      first POST /api/orders fails with a network error
//   redflag-load-error            questionnaire request fails (503)
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
].map((q) => ({ ...q, questionnaire: DEV_FIXTURE_QUESTIONNAIRE, isFixture: true }))

const DRAFT_FIELDS = ['parentId', 'items', 'scheduledFor', 'timeSlot', 'address', 'notes', 'catalogVersion']
const MAX_ATTACHMENTS = 5

interface MockOrder {
  id: string
  status: 'DRAFT' | 'BLOCKED_RED_FLAG'
  version: number
  parentId: string
  serviceCodes: string[]
  scheduledFor: string | null
  timeSlot: string | null
  address: unknown
  notes: string | null
  redFlagStatus: 'NOT_ANSWERED' | 'CLEAR' | 'FLAGGED'
  requiresReferral: boolean
  attachments: string[]
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

function ignoredFields(body: Record<string, unknown>, allowed: string[]): string[] {
  return Object.keys(body).filter((k) => !allowed.includes(k)).sort()
}

function validateDraftBody(body: Record<string, unknown>, partial: boolean): Record<string, string> {
  const fields: Record<string, string> = {}
  if (!partial && (typeof body.parentId !== 'string' || body.parentId === '')) fields.parentId = 'Эцэг/эхийг сонгоно уу'
  if (!partial || body.items !== undefined) {
    const items = body.items
    if (!Array.isArray(items) || items.length < 1 || items.length > 5) fields.items = '1-5 үйлчилгээ'
    else items.forEach((item, idx) => {
      if (!isRecord(item) || typeof item.serviceCode !== 'string' || !/^[A-Z][A-Z0-9_]{1,59}$/.test(item.serviceCode)) {
        fields[`items.${idx}.serviceCode`] = 'Үйлчилгээний код буруу байна'
      }
    })
  }
  if (body.scheduledFor !== undefined && body.scheduledFor !== null) {
    if (typeof body.scheduledFor !== 'string' || !OFFSET_ISO.test(body.scheduledFor)) fields.scheduledFor = 'Offset-тэй ISO огноо'
  }
  if (body.timeSlot !== undefined && body.timeSlot !== null) {
    if (typeof body.timeSlot !== 'string' || !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(body.timeSlot)) fields.timeSlot = 'HH:MM-HH:MM'
  }
  if (body.address !== undefined && body.address !== null) {
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

  const view = (o: MockOrder, ignored: string[] = []) => ({
    order: {
      id: o.id,
      status: o.status,
      version: o.version,
      parentId: o.parentId,
      items: o.serviceCodes.map((serviceCode) => ({ serviceCode, name: `[MOCK] ${serviceCode}`, quantity: 1, isFixture: true })),
      scheduledFor: o.scheduledFor,
      timeSlot: o.timeSlot,
      address: o.address,
      notes: o.notes,
      redFlag: { status: o.redFlagStatus, required: true, questionnaires: [DEV_FIXTURE_QUESTIONNAIRE] },
      requirements: {
        redFlagAnswers: o.redFlagStatus !== 'CLEAR',
        referralAttachment: o.requiresReferral,
        referralUploadAvailable: true,
      },
      quote: null,
    },
    ignoredFields: ignored,
  })

  const fetch: FetchLike = async (url, init) => {
    await sleep(300)
    const path = pathOfUrl(url)
    const parsed: unknown = init.body ? JSON.parse(init.body) : {}
    const body = isRecord(parsed) ? parsed : {}

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
      const existing = key ? orders.get(byIdempotencyKey.get(key) ?? '') : undefined
      if (existing) return respond(200, { success: true, message: 'Ноорог (давтан хүсэлт, mock)', data: view(existing) })
      const fields = validateDraftBody(body, false)
      if (Object.keys(fields).length > 0) return fail(400, 'VALIDATION_ERROR', 'Оруулсан мэдээлэл буруу байна', fields)
      seq += 1
      const codes = (body.items as unknown[]).flatMap((i) => (isRecord(i) && typeof i.serviceCode === 'string' ? [i.serviceCode] : []))
      const order: MockOrder = {
        id: `ord_mock_${seq}`,
        status: 'DRAFT',
        version: 1,
        parentId: String(body.parentId),
        serviceCodes: codes,
        scheduledFor: typeof body.scheduledFor === 'string' ? new Date(body.scheduledFor).toISOString() : null,
        timeSlot: typeof body.timeSlot === 'string' ? body.timeSlot : null,
        address: body.address ?? null,
        notes: typeof body.notes === 'string' ? body.notes : null,
        redFlagStatus: 'NOT_ANSWERED',
        // fabricated rule for the mock catalog: the IV service needs a referral
        requiresReferral: codes.some((c) => c.includes('_IV')),
        attachments: [],
      }
      orders.set(order.id, order)
      if (key) byIdempotencyKey.set(key, order.id)
      return respond(201, { success: true, message: 'Ноорог үүслээ (mock)', data: view(order, ignoredFields(body, DRAFT_FIELDS)) })
    }

    const orderMatch = /^\/api\/orders\/([^/]+)(\/.*)?$/.exec(path)
    const order = orderMatch ? orders.get(decodeURIComponent(orderMatch[1])) : undefined
    const sub = orderMatch?.[2] ?? ''
    if (orderMatch && !order) return fail(404, 'ORDER_NOT_FOUND', 'Захиалга олдсонгүй')

    if (order && sub === '' && init.method === 'GET') {
      return respond(200, { success: true, message: 'Захиалга', data: view(order) })
    }

    if (order && sub === '' && init.method === 'PATCH') {
      if (order.status === 'BLOCKED_RED_FLAG') return fail(409, 'RED_FLAG_BLOCKED', 'Энэ захиалга аюулын шинжийн асуулгаар хаагдсан')
      if (body.version !== order.version) return fail(409, 'VERSION_CONFLICT', 'Захиалга өөр газар өөрчлөгдсөн байна')
      const fields = validateDraftBody(body, true)
      if (Object.keys(fields).length > 0) return fail(400, 'VALIDATION_ERROR', 'Оруулсан мэдээлэл буруу байна', fields)
      if (Array.isArray(body.items)) {
        order.serviceCodes = body.items.flatMap((i) => (isRecord(i) && typeof i.serviceCode === 'string' ? [i.serviceCode] : []))
        order.requiresReferral = order.serviceCodes.some((c) => c.includes('_IV'))
        order.redFlagStatus = 'NOT_ANSWERED' // a new service needs new answers
      }
      if (body.scheduledFor !== undefined) order.scheduledFor = typeof body.scheduledFor === 'string' ? new Date(body.scheduledFor).toISOString() : null
      if (body.timeSlot !== undefined) order.timeSlot = typeof body.timeSlot === 'string' ? body.timeSlot : null
      if (body.address !== undefined) order.address = body.address
      if (body.notes !== undefined) order.notes = typeof body.notes === 'string' ? body.notes : null
      order.version += 1
      return respond(200, { success: true, message: 'Ноорог шинэчлэгдлээ (mock)', data: view(order, ignoredFields(body, ['version', ...DRAFT_FIELDS])) })
    }

    if (order && sub === '/red-flag-questions' && init.method === 'GET') {
      if (tokens.has('redflag-load-error')) return fail(503, 'QUESTIONNAIRE_UNAVAILABLE', 'Асуулга түр ашиглах боломжгүй байна (mock)')
      return respond(200, {
        success: true,
        message: 'Асуулга (mock)',
        data: {
          orderId: order.id,
          orderStatus: order.status,
          redFlag: { status: order.redFlagStatus },
          questionnaires: [DEV_FIXTURE_QUESTIONNAIRE],
          containsFixtures: true,
          questions: DEV_FIXTURE_QUESTIONS,
        },
      })
    }

    if (order && sub === '/red-flag-answers' && init.method === 'PUT') {
      if (tokens.has('redflag-submit-error')) return fail(500, 'INTERNAL_ERROR', 'Хариулт хадгалахад алдаа гарлаа (mock)')
      if (order.status === 'BLOCKED_RED_FLAG' || order.redFlagStatus === 'FLAGGED') {
        return fail(409, 'RED_FLAG_BLOCKED', 'Энэ захиалга аюулын шинжийн асуулгаар хаагдсан')
      }
      if (Array.isArray(body.questionnaires) && body.questionnaires.join(',') !== DEV_FIXTURE_QUESTIONNAIRE) {
        return fail(409, 'QUESTIONNAIRE_OUTDATED', 'Асуулга шинэчлэгдсэн байна. Асуултуудыг дахин ачаална уу')
      }
      const answers = Array.isArray(body.answers) ? body.answers : []
      const answered = new Map<string, boolean>()
      const fields: Record<string, string> = {}
      answers.forEach((a, idx) => {
        if (!isRecord(a) || typeof a.questionId !== 'string' || typeof a.value !== 'boolean') fields[`answers.${idx}`] = 'Буруу хариулт'
        else if (!DEV_FIXTURE_QUESTIONS.some((q) => q.id === a.questionId)) fields[`answers.${idx}.questionId`] = 'Энэ захиалгын асуулт биш'
        else if (answered.has(a.questionId)) fields[`answers.${idx}.questionId`] = 'Давхардсан хариулт'
        else answered.set(a.questionId, a.value)
      })
      if (Object.keys(fields).length > 0) return fail(400, 'VALIDATION_ERROR', 'Оруулсан мэдээлэл буруу байна', fields)
      const missing = DEV_FIXTURE_QUESTIONS.filter((q) => !answered.has(q.id))
      if (missing.length > 0) {
        return fail(400, 'RED_FLAG_INCOMPLETE', 'Бүх асуултад хариулна уу', Object.fromEntries(missing.map((q) => [q.id, 'Хариулаагүй'])))
      }
      const flagged = [...answered.values()].some((v) => v)
      order.version += 1
      order.redFlagStatus = flagged ? 'FLAGGED' : 'CLEAR'
      if (flagged) order.status = 'BLOCKED_RED_FLAG'
      return respond(200, {
        success: true,
        message: flagged ? 'Захиалгыг үргэлжлүүлэх боломжгүй' : 'Хариулт хадгалагдлаа (mock)',
        data: {
          redFlag: { status: order.redFlagStatus, answeredAt: new Date(0).toISOString() },
          orderStatus: order.status,
          version: order.version,
          ...(flagged ? { advice: { text: '[DEV FIXTURE] Энэ захиалгыг үргэлжлүүлэх боломжгүй.', isFixture: true } } : {}),
        },
      })
    }

    const deleteMatch = /^\/attachments\/([^/]+)$/.exec(sub)
    if (order && deleteMatch && init.method === 'DELETE') {
      order.attachments = order.attachments.filter((id) => id !== decodeURIComponent(deleteMatch[1]))
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
    if (order.status === 'BLOCKED_RED_FLAG') return fail(409, 'RED_FLAG_BLOCKED', 'Энэ захиалга хаагдсан')
    if (request.file.type !== 'image/jpeg' && request.file.type !== 'image/png') {
      return fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'Зөвхөн JPEG эсвэл PNG')
    }
    if (order.attachments.length >= MAX_ATTACHMENTS) return fail(409, 'ATTACHMENT_LIMIT', 'Нэг захиалгад 5 хүртэл файл')
    await sleep(150)
    request.onProgress?.(1)
    seq += 1
    const attachment = { id: `att_mock_${seq}`, kind: 'REFERRAL', mimeType: request.file.type, sizeBytes: 0 }
    order.attachments.push(attachment.id)
    return respond(201, { success: true, message: 'Файл хадгалагдлаа (mock, серверт хадгалагдаагүй)', data: { attachment } })
  }

  return { fetch, upload }
}
