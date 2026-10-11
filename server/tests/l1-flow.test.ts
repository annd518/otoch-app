// 10.14: idempotency, early red flag block, quote, private upload, QPay (MOCK mode only).
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { api, createUser, errorCode, loginAs, prisma, startServer, TestServer } from './helpers'
import { CATALOG_FIXTURES } from '../prisma/fixtures/catalog'
import { RED_FLAG_FIXTURES } from '../prisma/fixtures/redFlags'
import { getStorage, memoryStorageKeys } from '../src/services/storage'
import { qpayMock } from '../src/services/qpay'

let srv: TestServer

const inDays = (d: number) => `${new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10)}T09:00:00+08:00`
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(256, 7)])
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(256, 9)])
const PDF = Buffer.from('%PDF-1.4\n% fake pdf body\n')
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(64)])

interface Family { token: string; parentId: string; userId: string; email: string }

async function family(tag: string): Promise<Family> {
    const user = await createUser('CHILD', tag)
    const token = await loginAs(srv.baseUrl, user.email)
    const p = await api(srv.baseUrl, 'POST', '/api/parents', {
        token, body: { name: 'Туршилтын Эх', age: 70, gender: 'Female', address: 'Туршилтын хаяг 1', emergencyContact: '99112233' },
    })
    assert.equal(p.status, 201)
    return { token, parentId: p.json.data.parent.id, userId: user.id, email: user.email }
}

const draftBody = (f: Family, over: Record<string, unknown> = {}) => ({
    parentId: f.parentId,
    items: [{ serviceCode: 'HOME_BASIC_CHECK', quantity: 1 }],
    scheduledFor: inDays(3),
    timeSlot: '09:00-11:00',
    address: { text: 'Улаанбаатар, Туршилтын дүүрэг 1' },
    ...over,
})

function postOrder(f: Family, body: unknown, key?: string, signal?: AbortSignal) {
    return fetch(`${srv.baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${f.token}`, ...(key && { 'Idempotency-Key': key }) },
        body: JSON.stringify(body),
        signal,
    }).then(async (r) => ({ status: r.status, json: await r.json(), replayed: r.headers.get('Idempotent-Replayed') }))
}

async function newOrder(f: Family, over: Record<string, unknown> = {}) {
    const r = await postOrder(f, draftBody(f, over))
    assert.equal(r.status, 201, JSON.stringify(r.json))
    return r.json.data.order
}

const getOrder = async (f: Family, id: string) => (await api(srv.baseUrl, 'GET', `/api/orders/${id}`, { token: f.token })).json.data.order

async function questions(f: Family, id: string) {
    const r = await api(srv.baseUrl, 'GET', `/api/orders/${id}/red-flag-questions`, { token: f.token })
    assert.equal(r.status, 200)
    return r.json.data
}

const putAnswers = (f: Family, id: string, body: unknown) => api(srv.baseUrl, 'PUT', `/api/orders/${id}/red-flag-answers`, { token: f.token, body })

async function clearRedFlag(f: Family, id: string) {
    const q = await questions(f, id)
    const r = await putAnswers(f, id, { questionnaires: q.questionnaires, answers: q.questions.map((x: any) => ({ questionId: x.id, value: false })) })
    assert.equal(r.status, 200, JSON.stringify(r.json))
}

async function quote(f: Family, id: string, orderVersion?: number) {
    const v = orderVersion ?? (await getOrder(f, id)).version
    return api(srv.baseUrl, 'POST', `/api/orders/${id}/quote`, { token: f.token, body: { orderVersion: v } })
}

function upload(f: Family, id: string, bytes: Buffer, opts: { name?: string; type?: string; key?: string; kind?: string } = {}) {
    const fd = new FormData()
    fd.append('kind', opts.kind ?? 'REFERRAL')
    fd.append('file', new Blob([new Uint8Array(bytes)], { type: opts.type ?? "image/jpeg" }), opts.name ?? 'zaalt.jpg')
    return fetch(`${srv.baseUrl}/api/orders/${id}/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${f.token}`, ...(opts.key && { 'Idempotency-Key': opts.key }) },
        body: fd,
    }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))
}

function createPayment(f: Family, id: string, quoteId: string, key?: string) {
    return fetch(`${srv.baseUrl}/api/orders/${id}/payments/qpay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${f.token}`, ...(key && { 'Idempotency-Key': key }) },
        body: JSON.stringify({ quoteId }),
    }).then(async (r) => ({ status: r.status, json: await r.json() }))
}

const callback = (paymentId: string, secret = process.env.QPAY_CALLBACK_SECRET!) =>
    fetch(`${srv.baseUrl}/api/payments/qpay/callback/${secret}?paymentId=${paymentId}`, { method: 'POST' }).then((r) => r.status)

/** Draft that is ready for pricing and has a fresh quote */
async function quotedOrder(f: Family, over: Record<string, unknown> = {}) {
    const order = await newOrder(f, over)
    await clearRedFlag(f, order.id)
    const q = await quote(f, order.id)
    assert.equal(q.status, 201, JSON.stringify(q.json))
    return { order, quote: q.json.data.quote }
}

before(async () => {
    for (const item of CATALOG_FIXTURES) {
        await prisma.serviceCatalogItem.upsert({ where: { code: item.code }, update: {}, create: { ...item, isFixture: true } })
    }
    for (const q of RED_FLAG_FIXTURES) {
        await prisma.redFlagQuestion.upsert({
            where: { questionnaire_code: { questionnaire: q.questionnaire, code: q.code } }, update: {}, create: { ...q, isFixture: true },
        })
    }
    srv = await startServer()
})
after(async () => { await srv.close(); await prisma.$disconnect() })

describe('POST /api/orders Idempotency-Key', () => {
    it('same key + same payload returns the same order (replay), one row in DB', async () => {
        const f = await family('idem-a')
        const body = draftBody(f)
        const first = await postOrder(f, body, 'key-same-0001')
        const second = await postOrder(f, body, 'key-same-0001')
        assert.equal(first.status, 201)
        assert.equal(second.status, 201)
        assert.equal(second.json.data.order.id, first.json.data.order.id)
        assert.equal(second.json.data.idempotentReplay, true)
        assert.equal(second.replayed, 'true')
        assert.equal(await prisma.order.count({ where: { childId: f.userId } }), 1)
    })

    it('same key + different payload -> 409 IDEMPOTENCY_KEY_REUSED, nothing created', async () => {
        const f = await family('idem-b')
        assert.equal((await postOrder(f, draftBody(f), 'key-diff-0001')).status, 201)
        const r = await postOrder(f, draftBody(f, { notes: 'өөр' }), 'key-diff-0001')
        assert.equal(r.status, 409)
        assert.equal(r.json.error.code, 'IDEMPOTENCY_KEY_REUSED')
        assert.equal(await prisma.order.count({ where: { childId: f.userId } }), 1)
    })

    it('8 concurrent requests with one key create exactly one order', async () => {
        const f = await family('idem-c')
        const body = draftBody(f)
        const results = await Promise.all(Array.from({ length: 8 }, () => postOrder(f, body, 'key-conc-0001')))
        for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.json))
        assert.equal(new Set(results.map((r) => r.json.data.order.id)).size, 1)
        assert.equal(await prisma.order.count({ where: { childId: f.userId } }), 1)
        assert.equal(await prisma.idempotencyKey.count({ where: { userId: f.userId } }), 1)
    })

    it('retry after a client-side network timeout does not create a duplicate', async () => {
        const f = await family('idem-d')
        const body = draftBody(f)
        const ctrl = new AbortController()
        const lost = postOrder(f, body, 'key-timeout-0001', ctrl.signal).catch(() => 'aborted')
        setTimeout(() => ctrl.abort(), 2)
        await lost
        await new Promise((r) => setTimeout(r, 300)) // let the server finish if it got the request
        const retry = await postOrder(f, body, 'key-timeout-0001')
        assert.equal(retry.status, 201)
        assert.equal(await prisma.order.count({ where: { childId: f.userId } }), 1)
        const again = await postOrder(f, body, 'key-timeout-0001')
        assert.equal(again.json.data.order.id, retry.json.data.order.id)
    })

    it('keys are scoped per user, validated, and reusable after expiry', async () => {
        const a = await family('idem-e1')
        const b = await family('idem-e2')
        const ra = await postOrder(a, draftBody(a), 'shared-key-0001')
        const rb = await postOrder(b, draftBody(b), 'shared-key-0001')
        assert.notEqual(ra.json.data.order.id, rb.json.data.order.id)

        const bad = await postOrder(a, draftBody(a), 'short')
        assert.equal(bad.status, 400)

        await prisma.idempotencyKey.updateMany({ where: { userId: a.userId, key: 'shared-key-0001' }, data: { expiresAt: new Date(Date.now() - 1000) } })
        const reused = await postOrder(a, draftBody(a, { notes: 'шинэ' }), 'shared-key-0001')
        assert.equal(reused.status, 201)
        assert.notEqual(reused.json.data.order.id, ra.json.data.order.id)
    })
})

describe('red flag: early "yes" is stored and blocks', () => {
    it('a single positive answer (others missing) blocks the order on the server', async () => {
        const f = await family('rf-a')
        const order = await newOrder(f)
        const q = await questions(f, order.id)
        assert.equal(q.approved, false)
        assert.ok(q.questions.every((x: any) => x.approved === false && x.isFixture === true))

        const r = await putAnswers(f, order.id, { answers: [{ questionId: q.questions[1].id, value: true }] })
        assert.equal(r.status, 200, JSON.stringify(r.json))
        assert.equal(r.json.data.orderStatus, 'BLOCKED_RED_FLAG')
        assert.equal(r.json.data.redFlag.status, 'FLAGGED')
        const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { redFlagAnswers: true } })
        assert.equal(row.status, 'BLOCKED_RED_FLAG')
        assert.deepEqual(row.redFlagAnswers.map((a) => a.value), [true])
    })

    it('blocks even when the payload also has junk ids or an outdated questionnaire list', async () => {
        const f = await family('rf-b')
        const order = await newOrder(f)
        const q = await questions(f, order.id)
        const r = await putAnswers(f, order.id, {
            questionnaires: ['GENERAL_V0'],
            answers: [{ questionId: 'junk', value: false }, { questionId: q.questions[0].id, value: true }],
        })
        assert.equal(r.status, 200)
        assert.equal(r.json.data.orderStatus, 'BLOCKED_RED_FLAG')
    })

    it('partial all-negative answers are rejected and nothing is saved', async () => {
        const f = await family('rf-c')
        const order = await newOrder(f)
        const q = await questions(f, order.id)
        const r = await putAnswers(f, order.id, { answers: [{ questionId: q.questions[0].id, value: false }] })
        assert.equal(r.status, 400)
        assert.equal(errorCode(r), 'RED_FLAG_INCOMPLETE')
        assert.equal(await prisma.redFlagAnswer.count({ where: { orderId: order.id } }), 0)
        assert.equal((await getOrder(f, order.id)).redFlag.status, 'NOT_ANSWERED')
    })

    it('all valid negative answers -> CLEAR', async () => {
        const f = await family('rf-d')
        const order = await newOrder(f)
        await clearRedFlag(f, order.id)
        assert.equal((await getOrder(f, order.id)).redFlag.status, 'CLEAR')
    })

    it('after re-login / another device the block holds for answers, PATCH, quote and payment', async () => {
        const f = await family('rf-e')
        const order = await newOrder(f)
        const q = await questions(f, order.id)
        await putAnswers(f, order.id, { answers: [{ questionId: q.questions[2].id, value: true }] })

        const relogin: Family = { ...f, token: await loginAs(srv.baseUrl, f.email) }
        assert.equal((await getOrder(relogin, order.id)).status, 'BLOCKED_RED_FLAG')

        const reanswer = await putAnswers(relogin, order.id, { questionnaires: q.questionnaires, answers: q.questions.map((x: any) => ({ questionId: x.id, value: false })) })
        assert.equal(reanswer.status, 409)
        assert.equal(errorCode(reanswer), 'RED_FLAG_BLOCKED')

        const patch = await api(srv.baseUrl, 'PATCH', `/api/orders/${order.id}`, { token: relogin.token, body: { version: 2, notes: 'x' } })
        assert.equal(patch.status, 409)

        const qt = await quote(relogin, order.id)
        assert.equal(qt.status, 422)
        assert.equal(errorCode(qt), 'RED_FLAG_BLOCKED')

        const pay = await createPayment(relogin, order.id, 'any-quote-id', 'pay-blocked-0001')
        assert.equal(pay.status, 422)
        assert.equal(pay.json.error.code, 'RED_FLAG_BLOCKED')
    })
})

describe('POST /api/orders/:id/quote', () => {
    it('prices from the catalog in integer MNT, marks fixtures, and is not a payment', async () => {
        const f = await family('q-a')
        const { order, quote: qt } = await quotedOrder(f, { items: [{ serviceCode: 'HOME_BASIC_CHECK', quantity: 2 }] })
        const unit = CATALOG_FIXTURES.find((c) => c.code === 'HOME_BASIC_CHECK')!.priceMnt
        assert.equal(qt.currency, 'MNT')
        assert.equal(qt.lines.length, 1)
        assert.equal(qt.lines[0].unitPriceMnt, unit)
        assert.equal(qt.lines[0].amountMnt, unit * 2)
        assert.equal(qt.subtotalMnt, unit * 2)
        assert.equal(qt.totalMnt, unit * 2)
        assert.ok(Number.isInteger(qt.totalMnt))
        assert.equal(qt.isFixture, true)
        assert.deepEqual(qt.excludes, ['TRAVEL_FEE', 'DISCOUNT', 'VAT'])
        assert.equal(qt.travelFeeMnt, 0)
        assert.equal(qt.discountMnt, 0)
        assert.equal(qt.isPayment, false)
        const current = await getOrder(f, order.id)
        assert.equal(current.status, 'DRAFT', 'a quote must not change the order status')
        assert.equal(current.quote.id, qt.id)
    })

    it('stale orderVersion -> 409; an edited draft no longer exposes or accepts the old quote', async () => {
        const f = await family('q-b')
        const { order, quote: qt } = await quotedOrder(f)
        const stale = await quote(f, order.id, qt.orderVersion - 1)
        assert.equal(stale.status, 409)
        assert.equal(errorCode(stale), 'VERSION_CONFLICT')

        const patch = await api(srv.baseUrl, 'PATCH', `/api/orders/${order.id}`, { token: f.token, body: { version: qt.orderVersion, notes: 'өөрчилсөн' } })
        assert.equal(patch.status, 200)
        assert.equal(patch.json.data.order.quote, null)
        const pay = await createPayment(f, order.id, qt.id, 'pay-stale-0001')
        assert.equal(pay.status, 409)
        assert.equal(pay.json.error.code, 'QUOTE_MISMATCH')
    })

    it('omitted orderVersion (mobile sends {}) prices the current version; bad type -> 400', async () => {
        const f = await family('q-c')
        const order = await newOrder(f)
        await clearRedFlag(f, order.id)
        const current = await getOrder(f, order.id)
        const r = await api(srv.baseUrl, 'POST', `/api/orders/${order.id}/quote`, { token: f.token, body: {} })
        assert.equal(r.status, 201, JSON.stringify(r.json))
        assert.equal(r.json.data.quote.orderVersion, current.version)
        const bad = await api(srv.baseUrl, 'POST', `/api/orders/${order.id}/quote`, { token: f.token, body: { orderVersion: 'x' } })
        assert.equal(bad.status, 400)
    })
})

describe('private referral upload', () => {
    it('stores a real JPEG/PNG privately and serves it only to the owner', async () => {
        const f = await family('up-a')
        const other = await family('up-a2')
        const order = await newOrder(f, { items: [{ serviceCode: 'HOME_IV_THERAPY' }] })
        assert.equal(order.requirements.referralAttachment, true)

        const jpg = await upload(f, order.id, JPEG, { name: 'scan.png', type: 'image/png' }) // name/type lie; bytes win
        assert.equal(jpg.status, 201, JSON.stringify(jpg.json))
        assert.equal(jpg.json.data.attachment.mimeType, 'image/jpeg')
        assert.equal(jpg.json.data.storage, 'memory')
        const png = await upload(f, order.id, PNG, { name: 'x.png', type: 'image/png' })
        assert.equal(png.json.data.attachment.mimeType, 'image/png')

        const row = await prisma.attachment.findUniqueOrThrow({ where: { id: jpg.json.data.attachment.id } })
        assert.match(row.storageKey, /^orders\/[^/]+\/[0-9a-f-]{36}\.jpg$/)
        assert.equal(row.storageKey.includes('scan'), false)

        const content = await fetch(`${srv.baseUrl}/api/orders/${order.id}/attachments/${row.id}/content`, { headers: { Authorization: `Bearer ${f.token}` } })
        assert.equal(content.status, 200)
        assert.equal(content.headers.get('content-type'), 'image/jpeg')
        assert.match(content.headers.get('cache-control') ?? '', /no-store/)
        assert.ok(Buffer.from(await content.arrayBuffer()).equals(JPEG))

        const foreign = await fetch(`${srv.baseUrl}/api/orders/${order.id}/attachments/${row.id}/content`, { headers: { Authorization: `Bearer ${other.token}` } })
        assert.equal(foreign.status, 404)
        const anon = await fetch(`${srv.baseUrl}/api/orders/${order.id}/attachments/${row.id}/content`)
        assert.equal(anon.status, 401)
        const publicPath = await fetch(`${srv.baseUrl}/uploads/images/${row.storageKey.split('/').pop()}`)
        assert.notEqual(publicPath.status, 200)

        assert.equal((await getOrder(f, order.id)).requirements.referralAttachment, false)
    })

    it('rejects PDF, HEIC and disguised files by content (415)', async () => {
        const f = await family('up-b')
        const order = await newOrder(f)
        for (const [bytes, name, type] of [[PDF, 'zaalt.jpg', 'image/jpeg'], [HEIC, 'a.heic', 'image/heic'], [Buffer.from('hello'), 'a.png', 'image/png']] as const) {
            const r = await upload(f, order.id, bytes, { name, type })
            assert.equal(r.status, 415, name)
            assert.equal(r.json.error.code, 'UNSUPPORTED_MEDIA_TYPE')
        }
        assert.equal(await prisma.attachment.count({ where: { orderId: order.id } }), 0)
    })

    it('rejects files over 10 MB with 413 FILE_TOO_LARGE', async () => {
        const f = await family('up-c')
        const order = await newOrder(f)
        const big = Buffer.concat([JPEG, Buffer.alloc(10 * 1024 * 1024)])
        const r = await upload(f, order.id, big)
        assert.equal(r.status, 413)
        assert.equal(r.json.error.code, 'FILE_TOO_LARGE')
    })

    it('enforces 5 files per order, also under concurrent uploads', async () => {
        const f = await family('up-d')
        const order = await newOrder(f)
        for (let i = 0; i < 3; i++) assert.equal((await upload(f, order.id, JPEG)).status, 201)
        const burst = await Promise.all([upload(f, order.id, JPEG), upload(f, order.id, PNG), upload(f, order.id, JPEG)])
        assert.equal(burst.filter((r) => r.status === 201).length, 2)
        assert.equal(burst.filter((r) => r.status === 409 && r.json.error.code === 'ATTACHMENT_LIMIT').length, 1)
        assert.equal(await prisma.attachment.count({ where: { orderId: order.id, status: 'ACTIVE' } }), 5)
    })

    it('upload retry with the same key returns the same attachment; delete removes the blob', async () => {
        const f = await family('up-e')
        const order = await newOrder(f)
        const a = await upload(f, order.id, JPEG, { key: 'upload-key-0001' })
        const b = await upload(f, order.id, JPEG, { key: 'upload-key-0001' })
        assert.equal(b.status, 201)
        assert.equal(b.json.data.attachment.id, a.json.data.attachment.id)
        const conflict = await upload(f, order.id, PNG, { key: 'upload-key-0001' })
        assert.equal(conflict.status, 409)
        assert.equal(await prisma.attachment.count({ where: { orderId: order.id } }), 1)

        const row = await prisma.attachment.findUniqueOrThrow({ where: { id: a.json.data.attachment.id } })
        const del = await api(srv.baseUrl, 'DELETE', `/api/orders/${order.id}/attachments/${row.id}`, { token: f.token })
        assert.equal(del.status, 204)
        assert.equal(await getStorage()!.get(row.storageKey), null)
        const after = await fetch(`${srv.baseUrl}/api/orders/${order.id}/attachments/${row.id}/content`, { headers: { Authorization: `Bearer ${f.token}` } })
        assert.equal(after.status, 404)
        assert.equal((await prisma.attachment.findUniqueOrThrow({ where: { id: row.id } })).status, 'DELETED')
    })

    it('concurrent upload retries with one key leave one attachment and no orphan blob', async () => {
        const f = await family('up-h')
        const order = await newOrder(f)
        const results = await Promise.all(Array.from({ length: 5 }, () => upload(f, order.id, JPEG, { key: 'upload-race-0001' })))
        for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.json))
        assert.equal(new Set(results.map((r) => r.json.data.attachment.id)).size, 1)
        assert.equal(await prisma.attachment.count({ where: { orderId: order.id } }), 1)
        const blobs = memoryStorageKeys().filter((k) => k.startsWith(`orders/${order.id}/`))
        assert.equal(blobs.length, 1, `orphan blobs: ${blobs.length}`)
    })

    it('a referral service can be quoted once an image is attached', async () => {
        const f = await family('up-f')
        const order = await newOrder(f, { items: [{ serviceCode: 'HOME_IV_THERAPY' }] })
        await clearRedFlag(f, order.id)
        assert.equal(errorCode(await quote(f, order.id)), 'REFERRAL_REQUIRED')
        assert.equal((await upload(f, order.id, JPEG)).status, 201)
        assert.equal((await quote(f, order.id)).status, 201)
    })

    it('blocked orders accept no uploads', async () => {
        const f = await family('up-g')
        const order = await newOrder(f)
        const q = await questions(f, order.id)
        await putAnswers(f, order.id, { answers: [{ questionId: q.questions[0].id, value: true }] })
        const r = await upload(f, order.id, JPEG)
        assert.equal(r.status, 409)
        assert.equal(r.json.error.code, 'RED_FLAG_BLOCKED')
    })
})

describe('QPay payment (MOCK mode — not QPay sandbox)', () => {
    it('invoice -> provider check -> PAID exactly once despite duplicate callbacks', async () => {
        const f = await family('pay-a')
        const { order, quote: qt } = await quotedOrder(f)
        const created = await createPayment(f, order.id, qt.id, 'pay-key-0001')
        assert.equal(created.status, 201, JSON.stringify(created.json))
        const p = created.json.data.payment
        assert.equal(p.mode, 'mock')
        assert.equal(p.isMock, true)
        assert.equal(p.status, 'PENDING')
        assert.equal(p.amountMnt, qt.totalMnt)
        assert.equal(created.json.data.orderStatus, 'AWAITING_PAYMENT')

        // draft is locked while awaiting payment
        const patch = await api(srv.baseUrl, 'PATCH', `/api/orders/${order.id}`, { token: f.token, body: { version: qt.orderVersion + 1, notes: 'x' } })
        assert.equal(patch.status, 409)

        // callback alone (not paid at provider) changes nothing
        assert.equal(await callback(p.id), 200)
        assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status, 'PENDING')

        const row = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })
        qpayMock.markPaid(row.providerInvoiceId!)
        const statuses = await Promise.all([callback(p.id), callback(p.id), callback(p.id)])
        assert.deepEqual(statuses, [200, 200, 200])

        const paid = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })
        assert.equal(paid.status, 'PAID')
        assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'PAID')
        assert.equal(await prisma.orderEvent.count({ where: { orderId: order.id, type: 'PAYMENT_PAID' } }), 1)

        const get = await api(srv.baseUrl, 'GET', `/api/orders/${order.id}/payments/${p.id}`, { token: f.token })
        assert.equal(get.json.data.payment.status, 'PAID')
        assert.equal(get.json.data.orderStatus, 'PAID')
    })

    it('wrong callback secret -> 404 and no state change', async () => {
        const f = await family('pay-b')
        const { order, quote: qt } = await quotedOrder(f)
        const p = (await createPayment(f, order.id, qt.id, 'pay-key-0002')).json.data.payment
        const row = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })
        qpayMock.markPaid(row.providerInvoiceId!)
        assert.equal(await callback(p.id, 'wrong-secret'), 404)
        assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status, 'PENDING')
    })

    it('idempotent create; second key while pending -> 409; key required', async () => {
        const f = await family('pay-c')
        const { order, quote: qt } = await quotedOrder(f)
        const a = await createPayment(f, order.id, qt.id, 'pay-key-0003')
        const b = await createPayment(f, order.id, qt.id, 'pay-key-0003')
        assert.equal(b.status, 201)
        assert.equal(b.json.data.payment.id, a.json.data.payment.id)
        const other = await createPayment(f, order.id, qt.id, 'pay-key-0004')
        assert.equal(other.status, 409)
        const noKey = await createPayment(f, order.id, qt.id)
        assert.equal(noKey.status, 400)
        assert.equal(noKey.json.error.code, 'IDEMPOTENCY_KEY_REQUIRED')
        assert.equal(await prisma.payment.count({ where: { orderId: order.id } }), 1)
    })

    it('paid amount different from the quote is never marked PAID', async () => {
        const f = await family('pay-d')
        const { order, quote: qt } = await quotedOrder(f)
        const p = (await createPayment(f, order.id, qt.id, 'pay-key-0005')).json.data.payment
        const row = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })
        qpayMock.markPaid(row.providerInvoiceId!, qt.totalMnt - 1)
        await callback(p.id)
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })
        assert.equal(after.status, 'PENDING')
        assert.equal(after.failureCode, 'AMOUNT_MISMATCH')
        assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'AWAITING_PAYMENT')
    })

    it('expired payment returns the order to DRAFT; expired quote cannot be paid', async () => {
        const f = await family('pay-e')
        const { order, quote: qt } = await quotedOrder(f)
        const p = (await createPayment(f, order.id, qt.id, 'pay-key-0006')).json.data.payment
        await prisma.payment.update({ where: { id: p.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
        const get = await api(srv.baseUrl, 'GET', `/api/orders/${order.id}/payments/${p.id}`, { token: f.token })
        assert.equal(get.json.data.payment.status, 'EXPIRED')
        assert.equal(get.json.data.orderStatus, 'DRAFT')

        const g = await family('pay-e2')
        const second = await quotedOrder(g)
        await prisma.quote.update({ where: { id: second.quote.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
        const r = await createPayment(g, second.order.id, second.quote.id, 'pay-key-0007')
        assert.equal(r.status, 409)
        assert.equal(r.json.error.code, 'QUOTE_EXPIRED')
    })

    it("another user cannot read or create payments on someone else's order", async () => {
        const f = await family('pay-f')
        const other = await family('pay-f2')
        const { order, quote: qt } = await quotedOrder(f)
        const p = (await createPayment(f, order.id, qt.id, 'pay-key-0008')).json.data.payment
        const read = await api(srv.baseUrl, 'GET', `/api/orders/${order.id}/payments/${p.id}`, { token: other.token })
        assert.equal(read.status, 404)
        const create = await createPayment(other, order.id, qt.id, 'pay-key-0009')
        assert.equal(create.status, 404)
    })
})

describe('catalog change invalidates pricing (runs last: it changes the catalog version)', () => {
    it('quote -> 409 CATALOG_OUTDATED after a catalog update', async () => {
        const f = await family('cat-a')
        const order = await newOrder(f)
        await clearRedFlag(f, order.id)
        await prisma.serviceCatalogItem.update({ where: { code: 'HOME_WOUND_CARE' }, data: { sortOrder: 51 } })
        const r = await quote(f, order.id)
        assert.equal(r.status, 409)
        assert.equal(errorCode(r), 'CATALOG_OUTDATED')
    })
})
