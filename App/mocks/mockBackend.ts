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
//   upload-lost-response-once     first upload is stored but the response is lost
//   no-idempotency                ignore Idempotency-Key like the current server (16ce810)
//   gap13-partial-block           accept a partial answer set with a "yes" (proposal GAP-13);
//                                 without it partial answers get 400 RED_FLAG_INCOMPLETE like the server
//   quote-501                     quote answers 501 NOT_IMPLEMENTED like the current server
//   quote-expired                 quotes are already expired
//   payment-expire | payment-fail payment ends EXPIRED / FAILED instead of PAID
import type { FetchLike, HttpResponseLike, UploadLike } from '../services/httpClient'
import { isRecord } from '../services/apiResult'
import { pathOfUrl } from '../services/endpoints'
import { mockCatalogResponse, parseCatalogMockScenario } from './catalogMock'

// Mirrors the backend fixture rows (server/prisma/fixtures/redFlags.ts):
// non-clinical placeholders, isFixture = true. The count comes from here, the
// UI renders whatever the server sends.
export const DEV_FIXTURE_QUESTIONNAIRE = 'GENERAL_V1'

export const DEV_FIXTURE_QUESTIONS = [1, 2, 3].map((n) => ({
  id: `rfq_mock_${n}`,
  questionnaire: DEV_FIXTURE_QUESTIONNAIRE,
  code: `TEST_Q${n}`,
  text: `Туршилтын асуулт ${n} (эмнэлзүйн бичвэр батлагдаагүй)`,
  isFixture: true,
}))

const MOCK_PRICES: Record<string, number> = { MOCK_HOME_BASIC: 45000, MOCK_HOME_IV: 60000, HOME_BASIC_CHECK: 45000, HOME_IV_THERAPY: 60000 }
// 1x1 transparent PNG; a stand-in for the QR image
const MOCK_QR_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

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
  createFingerprint: string
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
  let loseUploadResponseOnce = tokens.has('upload-lost-response-once')
  const uploadsByKey = new Map<string, unknown>()
  const quotes = new Map<string, { orderId: string; totalMnt: number; expiresAt: string }>()
  const invoices = new Map<string, { id: string; orderId: string; amountMnt: number; expiresAt: string; polls: number }>()
  const invoiceByKey = new Map<string, string>()

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
      const key = tokens.has('no-idempotency') ? undefined : init.headers['Idempotency-Key']
      const existing = key ? orders.get(byIdempotencyKey.get(key) ?? '') : undefined
      if (existing) {
        if (existing.createFingerprint !== JSON.stringify(body)) {
          return fail(422, 'IDEMPOTENCY_KEY_REUSED', 'Ижил түлхүүрээр өөр захиалга илгээсэн байна')
        }
        return respond(200, { success: true, message: 'Ноорог (давтан хүсэлт, mock)', data: view(existing) })
      }
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
        createFingerprint: JSON.stringify(body),
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
      const partialBlock = tokens.has('gap13-partial-block') && [...answered.values()].some((v) => v)
      if (missing.length > 0 && !partialBlock) {
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

    if (order && sub === '/quote' && init.method === 'POST') {
      if (order.status === 'BLOCKED_RED_FLAG') return fail(422, 'RED_FLAG_BLOCKED', 'Энэ захиалга хаагдсан')
      if (order.redFlagStatus !== 'CLEAR') return fail(422, 'RED_FLAG_REQUIRED', 'Эхлээд аюулын шинжийн асуулгад хариулна уу')
      if (!order.scheduledFor || !order.address) return fail(422, 'ORDER_INCOMPLETE', 'Захиалгын мэдээлэл дутуу байна')
      if (order.requiresReferral && order.attachments.length === 0) {
        return fail(422, 'REFERRAL_REQUIRED', 'Энэ үйлчилгээнд эмчийн заалтын зураг шаардлагатай')
      }
      if (tokens.has('quote-501')) return fail(501, 'NOT_IMPLEMENTED', 'Серверийн үнийн санал (quote) хараахан хэрэгжээгүй байна')
      seq += 1
      const service = order.serviceCodes.reduce((sum, c) => sum + (MOCK_PRICES[c] ?? 30000), 0)
      const travel = 5000
      const expiresAt = new Date(tokens.has('quote-expired') ? Date.now() - 1000 : Date.now() + 15 * 60_000).toISOString()
      const quote = {
        id: `quo_mock_${seq}`,
        currency: 'MNT',
        lines: [
          ...order.serviceCodes.map((c) => ({ code: c, name: `[MOCK] ${c}`, quantity: 1, unitPriceMnt: MOCK_PRICES[c] ?? 30000, amountMnt: MOCK_PRICES[c] ?? 30000 })),
          { code: 'TRAVEL_FEE', name: '[MOCK] Унааны зардал', amountMnt: travel },
        ],
        subtotalMnt: service,
        travelFeeMnt: travel,
        discountMnt: 0,
        totalMnt: service + travel,
        pricingVersion: 'mock-1',
        expiresAt,
        isFixture: true,
      }
      quotes.set(quote.id, { orderId: order.id, totalMnt: quote.totalMnt, expiresAt })
      return respond(200, { success: true, message: 'Үнийн санал (mock)', data: { quote } })
    }

    if (order && sub === '/payments/qpay' && init.method === 'POST') {
      const key = init.headers['Idempotency-Key']
      if (!key) return fail(400, 'VALIDATION_ERROR', 'Idempotency-Key шаардлагатай')
      const known = invoiceByKey.get(key)
      const quote = quotes.get(String(body.quoteId))
      if (!quote || quote.orderId !== order.id || Date.parse(quote.expiresAt) <= Date.now()) {
        return fail(409, 'QUOTE_EXPIRED', 'Үнийн саналын хугацаа дууссан. Дахин авна уу')
      }
      let invoice = known ? invoices.get(known) : undefined
      if (!invoice) {
        seq += 1
        invoice = { id: `pay_mock_${seq}`, orderId: order.id, amountMnt: quote.totalMnt, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), polls: 0 }
        invoices.set(invoice.id, invoice)
        invoiceByKey.set(key, invoice.id)
      }
      return respond(known ? 200 : 201, {
        success: true,
        message: 'Нэхэмжлэх үүслээ (mock, бодит QPay биш)',
        data: {
          payment: {
            id: invoice.id,
            provider: 'QPAY',
            status: 'PENDING',
            amountMnt: invoice.amountMnt,
            qrText: 'MOCK_QR_TEXT_NOT_REAL',
            qrImageBase64: MOCK_QR_PNG,
            deeplinks: [
              { name: '[MOCK] Bank app', logo: null, link: 'mockbank://q?qPay_QRcode=MOCK' },
              { name: 'Web link (must be filtered)', logo: null, link: 'https://example.invalid/pay' },
            ],
            expiresAt: invoice.expiresAt,
          },
        },
      })
    }

    const payMatch = /^\/payments\/([^/]+)$/.exec(sub)
    if (order && payMatch && init.method === 'GET') {
      const invoice = invoices.get(decodeURIComponent(payMatch[1]))
      if (!invoice || invoice.orderId !== order.id) return fail(404, 'PAYMENT_NOT_FOUND', 'Төлбөр олдсонгүй')
      invoice.polls += 1
      let status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED' = 'PENDING'
      if (invoice.polls >= 3) status = tokens.has('payment-expire') ? 'EXPIRED' : tokens.has('payment-fail') ? 'FAILED' : 'PAID'
      return respond(200, {
        success: true,
        message: 'Төлбөрийн төлөв (mock)',
        data: {
          payment: { id: invoice.id, status, amountMnt: invoice.amountMnt, paidAt: status === 'PAID' ? new Date().toISOString() : null },
          orderStatus: status === 'PAID' ? 'PAID' : 'AWAITING_PAYMENT',
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
    const key = request.headers['Idempotency-Key']
    const repeated = key ? uploadsByKey.get(key) : undefined
    if (repeated) return respond(200, { success: true, message: 'Файл (давтан хүсэлт, mock)', data: { attachment: repeated } })
    if (order.attachments.length >= MAX_ATTACHMENTS) return fail(409, 'ATTACHMENT_LIMIT', 'Нэг захиалгад 5 хүртэл файл')
    await sleep(150)
    request.onProgress?.(1)
    seq += 1
    const attachment = { id: `att_mock_${seq}`, kind: 'REFERRAL', mimeType: request.file.type, sizeBytes: 0 }
    order.attachments.push(attachment.id)
    if (key) uploadsByKey.set(key, attachment)
    if (loseUploadResponseOnce) {
      loseUploadResponseOnce = false
      throw new TypeError('Network request failed after the server stored the file (mock)')
    }
    return respond(201, { success: true, message: 'Файл хадгалагдлаа (mock, серверт хадгалагдаагүй)', data: { attachment } })
  }

  return { fetch, upload }
}
