import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { api, createUser, errorCode, loginAs, prisma, startServer, TestServer } from './helpers'
import { CATALOG_FIXTURES } from '../prisma/fixtures/catalog'
import { RED_FLAG_FIXTURES } from '../prisma/fixtures/redFlags'

let srv: TestServer
let tokenA: string
let tokenB: string
let tokenNurse: string
let parentA: string
let parentB: string

const inDays = (d: number) => {
    // Ulaanbaatar local time with explicit +08:00 offset, at 09:00
    const t = new Date(Date.now() + d * 86_400_000)
    return `${t.toISOString().slice(0, 10)}T09:00:00+08:00`
}

const CYRILLIC_ADDRESS = 'Улаанбаатар, Туршилтын дүүрэг, 1-р хороо, 10-р байр'
const CYRILLIC_NOTES = 'Ирэхээсээ өмнө залгана уу — ёө үү өө'

async function createParent(token: string, name: string) {
    const res = await api(srv.baseUrl, 'POST', '/api/parents', {
        token, body: { name, age: 75, gender: 'Female', address: 'Туршилтын хаяг 1', emergencyContact: '99112233' },
    })
    assert.equal(res.status, 201, JSON.stringify(res.json))
    return res.json.data.parent.id as string
}

const draftBody = (overrides: Record<string, unknown> = {}) => ({
    parentId: parentA,
    items: [{ serviceCode: 'HOME_BASIC_CHECK', quantity: 1 }],
    scheduledFor: inDays(3),
    timeSlot: '09:00-11:00',
    address: { text: CYRILLIC_ADDRESS, lat: 47.92, lng: 106.92 },
    notes: CYRILLIC_NOTES,
    ...overrides,
})

const createDraft = (token: string, body: unknown) => api(srv.baseUrl, 'POST', '/api/orders', { token, body })

async function newDraft(overrides: Record<string, unknown> = {}) {
    const res = await createDraft(tokenA, draftBody(overrides))
    assert.equal(res.status, 201, JSON.stringify(res.json))
    return res.json.data.order
}

async function getQuestions(orderId: string, token = tokenA) {
    return api(srv.baseUrl, 'GET', `/api/orders/${orderId}/red-flag-questions`, { token })
}

async function answerAll(orderId: string, yesCode: string | null, token = tokenA) {
    const q = await getQuestions(orderId, token)
    assert.equal(q.status, 200, JSON.stringify(q.json))
    const answers = q.json.data.questions.map((x: any) => ({ questionId: x.id, value: x.code === yesCode }))
    return api(srv.baseUrl, 'PUT', `/api/orders/${orderId}/red-flag-answers`, {
        token, body: { questionnaires: q.json.data.questionnaires, answers },
    })
}

const quote = (orderId: string, token = tokenA) => api(srv.baseUrl, 'POST', `/api/orders/${orderId}/quote`, { token })

before(async () => {
    srv = await startServer()
    for (const item of CATALOG_FIXTURES) {
        await prisma.serviceCatalogItem.upsert({ where: { code: item.code }, update: {}, create: { ...item, isFixture: true } })
    }
    await prisma.serviceCatalogItem.upsert({
        where: { code: 'TEST_ORDER_INACTIVE' }, update: {},
        create: { code: 'TEST_ORDER_INACTIVE', name: 'Идэвхгүй', category: 'HOME_VISIT', priceMnt: 1000, durationMin: 10, isActive: false, isFixture: true },
    })
    for (const q of RED_FLAG_FIXTURES) {
        await prisma.redFlagQuestion.upsert({
            where: { questionnaire_code: { questionnaire: q.questionnaire, code: q.code } }, update: {}, create: { ...q, isFixture: true },
        })
    }
    const [a, b, n] = [await createUser('CHILD', 'order-a'), await createUser('CHILD', 'order-b'), await createUser('NURSE', 'order-n')]
    tokenA = await loginAs(srv.baseUrl, a.email)
    tokenB = await loginAs(srv.baseUrl, b.email)
    tokenNurse = await loginAs(srv.baseUrl, n.email)
    parentA = await createParent(tokenA, 'Туршилтын Эх А')
    parentB = await createParent(tokenB, 'Туршилтын Эх Б')
})
after(async () => { await srv.close(); await prisma.$disconnect() })

describe('POST /api/orders (draft)', () => {
    it('creates a DRAFT, stores Cyrillic text as UTF8, and reports ignored fields', async () => {
        const res = await createDraft(tokenA, draftBody({ bloodGroup: 'A+', allergies: 'Пенициллин', phone: '99112233', status: 'PAID' }))
        assert.equal(res.status, 201, JSON.stringify(res.json))
        const { order, ignoredFields } = res.json.data
        assert.equal(order.status, 'DRAFT')
        assert.equal(order.version, 1)
        assert.equal(order.address.text, CYRILLIC_ADDRESS)
        assert.equal(order.notes, CYRILLIC_NOTES)
        assert.deepEqual(order.items.map((i: any) => i.serviceCode), ['HOME_BASIC_CHECK'])
        assert.equal(order.redFlag.status, 'NOT_ANSWERED')
        assert.equal(order.redFlag.required, true)
        assert.equal(order.quote, null, 'no fake quote')
        assert.deepEqual(ignoredFields, ['allergies', 'bloodGroup', 'phone', 'status'])
        for (const f of ['bloodGroup', 'allergies', 'phone']) assert.equal(f in order, false, `${f} must not look saved`)

        // Read back from the DB: Cyrillic survived the round trip
        const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
        assert.equal(row.addressText, CYRILLIC_ADDRESS)
        assert.equal(row.notes, CYRILLIC_NOTES)
        assert.equal(row.status, 'DRAFT')
    })

    it('validates input with 400 + field messages', async () => {
        const cases: [Record<string, unknown>, string][] = [
            [{ items: [] }, 'items'],
            [{ items: [{ serviceCode: 'NOPE_CODE' }] }, 'items.0.serviceCode'],
            [{ items: [{ serviceCode: 'TEST_ORDER_INACTIVE' }] }, 'items.0.serviceCode'],
            [{ items: [{ serviceCode: 'HOME_BASIC_CHECK' }, { serviceCode: 'HOME_BASIC_CHECK' }] }, 'items'],
            [{ items: [{ serviceCode: 'HOME_BASIC_CHECK', quantity: 9 }] }, 'items.0.quantity'],
            [{ scheduledFor: '2020-01-01T09:00:00+08:00' }, 'scheduledFor'],
            [{ scheduledFor: inDays(200) }, 'scheduledFor'],
            [{ scheduledFor: '20.10.2026' }, 'scheduledFor'],
            [{ timeSlot: '11:00-09:00' }, 'timeSlot'],
            [{ address: { text: 'abc' } }, 'address.text'],
        ]
        for (const [override, field] of cases) {
            const res = await createDraft(tokenA, draftBody(override))
            assert.equal(res.status, 400, `${JSON.stringify(override)} -> ${res.status}`)
            assert.equal(errorCode(res), 'VALIDATION_ERROR')
            assert.ok(res.json.error.fields[field], `expected field error ${field}, got ${JSON.stringify(res.json.error.fields)}`)
        }
    })

    it("rejects another user's parent and unknown parents with the same 404", async () => {
        for (const parentId of [parentB, 'does-not-exist']) {
            const res = await createDraft(tokenA, draftBody({ parentId }))
            assert.equal(res.status, 404)
            assert.equal(errorCode(res), 'PARENT_NOT_FOUND')
        }
    })

    it('accepts the current catalogVersion and rejects an outdated one with 409', async () => {
        const cat = await api(srv.baseUrl, 'GET', '/api/catalog/services', { token: tokenA })
        const ok = await createDraft(tokenA, draftBody({ catalogVersion: cat.json.data.catalogVersion }))
        assert.equal(ok.status, 201)
        assert.equal(ok.json.data.order.catalogVersion, cat.json.data.catalogVersion)
        const stale = await createDraft(tokenA, draftBody({ catalogVersion: '2000-01-01T00:00:00.000Z' }))
        assert.equal(stale.status, 409)
        assert.equal(errorCode(stale), 'CATALOG_OUTDATED')
    })

    it('is CHILD-only: no token 401, nurse 403', async () => {
        assert.equal((await createDraft('', draftBody())).status, 401)
        const nurse = await createDraft(tokenNurse, draftBody())
        assert.equal(nurse.status, 403)
        assert.equal(errorCode(nurse), 'FORBIDDEN')
    })
})

describe('order ownership', () => {
    it("another user cannot read, edit, answer or quote someone else's order (404 each)", async () => {
        const order = await newDraft()
        const attempts = [
            api(srv.baseUrl, 'GET', `/api/orders/${order.id}`, { token: tokenB }),
            api(srv.baseUrl, 'PATCH', `/api/orders/${order.id}`, { token: tokenB, body: { version: 1, notes: 'халдлага' } }),
            getQuestions(order.id, tokenB),
            api(srv.baseUrl, 'PUT', `/api/orders/${order.id}/red-flag-answers`, { token: tokenB, body: { answers: [{ questionId: 'x', value: false }] } }),
            quote(order.id, tokenB),
        ]
        for (const res of await Promise.all(attempts)) {
            assert.equal(res.status, 404)
            assert.equal(errorCode(res), 'ORDER_NOT_FOUND')
        }
        const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
        assert.equal(row.notes, CYRILLIC_NOTES)
        assert.equal(row.version, 1)
    })

    it("list only returns the caller's own orders", async () => {
        const mine = await newDraft()
        const res = await api(srv.baseUrl, 'GET', '/api/orders', { token: tokenB })
        assert.equal(res.status, 200)
        assert.equal(res.json.data.orders.some((o: any) => o.id === mine.id), false)
    })
})

describe('PATCH /api/orders/:id', () => {
    it('updates with the right version, rejects a stale version with 409', async () => {
        const order = await newDraft()
        const ok = await api(srv.baseUrl, 'PATCH', `/api/orders/${order.id}`, { token: tokenA, body: { version: 1, timeSlot: '13:00-15:00', notes: null } })
        assert.equal(ok.status, 200, JSON.stringify(ok.json))
        assert.equal(ok.json.data.order.version, 2)
        assert.equal(ok.json.data.order.timeSlot, '13:00-15:00')
        assert.equal(ok.json.data.order.notes, null)

        const stale = await api(srv.baseUrl, 'PATCH', `/api/orders/${order.id}`, { token: tokenA, body: { version: 1, timeSlot: '09:00-11:00' } })
        assert.equal(stale.status, 409)
        assert.equal(errorCode(stale), 'VERSION_CONFLICT')
    })

    it('cannot set status or red flag fields directly (ignored, unchanged)', async () => {
        const order = await newDraft()
        const res = await api(srv.baseUrl, 'PATCH', `/api/orders/${order.id}`, {
            token: tokenA, body: { version: 1, status: 'PAID', redFlagStatus: 'CLEAR', childId: 'someone-else' },
        })
        assert.equal(res.status, 200)
        assert.deepEqual(res.json.data.ignoredFields, ['childId', 'redFlagStatus', 'status'])
        assert.equal(res.json.data.order.status, 'DRAFT')
        assert.equal(res.json.data.order.redFlag.status, 'NOT_ANSWERED')
    })
})

describe('red flag', () => {
    it('returns the versioned fixture questionnaire for the order', async () => {
        const order = await newDraft()
        const res = await getQuestions(order.id)
        assert.equal(res.status, 200)
        assert.deepEqual(res.json.data.questionnaires, ['GENERAL_V1'])
        assert.equal(res.json.data.containsFixtures, true)
        assert.deepEqual(res.json.data.questions.map((q: any) => q.code), RED_FLAG_FIXTURES.map((q) => q.code))
        assert.ok(res.json.data.questions.every((q: any) => q.isFixture === true))
    })

    it('rejects missing answers (400 RED_FLAG_INCOMPLETE) and non-boolean values', async () => {
        const order = await newDraft()
        const q = (await getQuestions(order.id)).json.data.questions
        const partial = await api(srv.baseUrl, 'PUT', `/api/orders/${order.id}/red-flag-answers`, {
            token: tokenA, body: { answers: [{ questionId: q[0].id, value: false }] },
        })
        assert.equal(partial.status, 400)
        assert.equal(errorCode(partial), 'RED_FLAG_INCOMPLETE')
        assert.equal(Object.keys(partial.json.error.fields).length, q.length - 1)

        const stringy = await api(srv.baseUrl, 'PUT', `/api/orders/${order.id}/red-flag-answers`, {
            token: tokenA, body: { answers: q.map((x: any) => ({ questionId: x.id, value: 'false' })) },
        })
        assert.equal(stringy.status, 400)
        assert.equal(errorCode(stringy), 'VALIDATION_ERROR')

        const foreign = await api(srv.baseUrl, 'PUT', `/api/orders/${order.id}/red-flag-answers`, {
            token: tokenA, body: { answers: [...q.map((x: any) => ({ questionId: x.id, value: false })), { questionId: 'not-a-question', value: false }] },
        })
        assert.equal(foreign.status, 400)

        const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
        assert.equal(row.redFlagStatus, 'NOT_ANSWERED')
    })

    it('rejects answers for an outdated questionnaire (409)', async () => {
        const order = await newDraft()
        const q = (await getQuestions(order.id)).json.data.questions
        const res = await api(srv.baseUrl, 'PUT', `/api/orders/${order.id}/red-flag-answers`, {
            token: tokenA, body: { questionnaires: ['GENERAL_V0'], answers: q.map((x: any) => ({ questionId: x.id, value: false })) },
        })
        assert.equal(res.status, 409)
        assert.equal(errorCode(res), 'QUESTIONNAIRE_OUTDATED')
    })

    it('all "no" -> CLEAR; quote guard passes red flag and reports NOT_IMPLEMENTED (no fake success)', async () => {
        const order = await newDraft()
        const res = await answerAll(order.id, null)
        assert.equal(res.status, 200, JSON.stringify(res.json))
        assert.equal(res.json.data.redFlag.status, 'CLEAR')
        assert.equal(res.json.data.orderStatus, 'DRAFT')
        assert.equal('advice' in res.json.data, false)

        const q = await quote(order.id)
        assert.equal(q.status, 501)
        assert.equal(errorCode(q), 'NOT_IMPLEMENTED')
    })

    it('one "yes" -> BLOCKED_RED_FLAG with placeholder advice', async () => {
        const order = await newDraft()
        const res = await answerAll(order.id, 'TEST_Q2')
        assert.equal(res.status, 200)
        assert.equal(res.json.data.redFlag.status, 'FLAGGED')
        assert.equal(res.json.data.orderStatus, 'BLOCKED_RED_FLAG')
        assert.equal(res.json.data.advice.isFixture, true)
    })

    it('a blocked order cannot be unblocked or bypassed through the API', async () => {
        const order = await newDraft()
        await answerAll(order.id, 'TEST_Q1')

        // change answers to all "no"
        const reanswer = await answerAll(order.id, null)
        assert.equal(reanswer.status, 409)
        assert.equal(errorCode(reanswer), 'RED_FLAG_BLOCKED')

        // edit the order / swap services to reset the questionnaire
        const current = (await api(srv.baseUrl, 'GET', `/api/orders/${order.id}`, { token: tokenA })).json.data.order
        const patch = await api(srv.baseUrl, 'PATCH', `/api/orders/${order.id}`, {
            token: tokenA, body: { version: current.version, items: [{ serviceCode: 'HOME_FULL_CHECK' }], status: 'DRAFT' },
        })
        assert.equal(patch.status, 409)
        assert.equal(errorCode(patch), 'RED_FLAG_BLOCKED')

        // jump straight to the pricing step
        const q = await quote(order.id)
        assert.equal(q.status, 422)
        assert.equal(errorCode(q), 'RED_FLAG_BLOCKED')

        const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } })
        assert.equal(row.status, 'BLOCKED_RED_FLAG')
        assert.equal(row.redFlagStatus, 'FLAGGED')
        assert.deepEqual(row.items.map((i) => i.serviceCode), ['HOME_BASIC_CHECK'])
    })

    it('quote before answering is refused (422 RED_FLAG_REQUIRED)', async () => {
        const order = await newDraft()
        const q = await quote(order.id)
        assert.equal(q.status, 422)
        assert.equal(errorCode(q), 'RED_FLAG_REQUIRED')
    })

    it('changing services after CLEAR resets the answers and requires them again', async () => {
        const order = await newDraft()
        await answerAll(order.id, null)
        const current = (await api(srv.baseUrl, 'GET', `/api/orders/${order.id}`, { token: tokenA })).json.data.order
        assert.equal(current.redFlag.status, 'CLEAR')

        const patch = await api(srv.baseUrl, 'PATCH', `/api/orders/${order.id}`, {
            token: tokenA, body: { version: current.version, items: [{ serviceCode: 'HOME_FULL_CHECK' }] },
        })
        assert.equal(patch.status, 200, JSON.stringify(patch.json))
        assert.equal(patch.json.data.order.redFlag.status, 'NOT_ANSWERED')
        assert.equal(await prisma.redFlagAnswer.count({ where: { orderId: order.id } }), 0)
        assert.equal(errorCode(await quote(order.id)), 'RED_FLAG_REQUIRED')
    })

    it('referral services are refused at pricing while upload is unavailable (422 REFERRAL_REQUIRED)', async () => {
        const order = await newDraft({ items: [{ serviceCode: 'HOME_IV_THERAPY' }] })
        assert.equal(order.requirements.referralAttachment, true)
        assert.equal(order.requirements.referralUploadAvailable, false)
        await answerAll(order.id, null)
        const q = await quote(order.id)
        assert.equal(q.status, 422)
        assert.equal(errorCode(q), 'REFERRAL_REQUIRED')
    })

    it('incomplete drafts are refused at pricing (422 ORDER_INCOMPLETE)', async () => {
        const order = await newDraft({ scheduledFor: undefined, address: undefined })
        await answerAll(order.id, null)
        const q = await quote(order.id)
        assert.equal(q.status, 422)
        assert.equal(errorCode(q), 'ORDER_INCOMPLETE')
        assert.ok(q.json.error.fields.scheduledFor)
        assert.ok(q.json.error.fields.address)
    })

    it('audit events record only the outcome, never which question was "yes"', async () => {
        const order = await newDraft()
        await answerAll(order.id, 'TEST_Q3')
        const events = await prisma.orderEvent.findMany({ where: { orderId: order.id } })
        assert.ok(events.some((e) => e.type === 'RED_FLAG_FLAGGED'))
        const dump = JSON.stringify(events)
        for (const q of RED_FLAG_FIXTURES) assert.equal(dump.includes(q.code), false)
    })
})
