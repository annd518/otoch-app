import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { api, createUser, errorCode, loginAs, prisma, startServer, TestServer } from './helpers'

let srv: TestServer
let tokenA: string
let tokenB: string
let parentIdA: string

const future = () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

before(async () => {
    srv = await startServer()
    const [a, b] = [await createUser('CHILD', 'child-a'), await createUser('CHILD', 'child-b')]
    tokenA = await loginAs(srv.baseUrl, a.email)
    tokenB = await loginAs(srv.baseUrl, b.email)
    // Fictional parent owned by child A
    const res = await api(srv.baseUrl, 'POST', '/api/parents', {
        token: tokenA,
        body: { name: 'Туршилтын Эх', age: 70, gender: 'Female', address: 'Туршилтын хаяг 1', emergencyContact: '99000000' },
    })
    assert.equal(res.status, 201, JSON.stringify(res.json))
    parentIdA = res.json.data.parent.id
})
after(async () => { await srv.close(); await prisma.$disconnect() })

const createVisit = (token: string | undefined, body: unknown) => api(srv.baseUrl, 'POST', '/api/visits', { token, body })

describe('POST /api/visits', () => {
    it('requires authentication (401)', async () => {
        const res = await createVisit(undefined, { parentId: parentIdA, scheduledFor: future(), visitType: 'FULL' })
        assert.equal(res.status, 401)
        assert.equal(errorCode(res), 'UNAUTHENTICATED')
    })

    it('rejects an empty body with 400 and per-field messages (not 200)', async () => {
        const res = await createVisit(tokenA, {})
        assert.equal(res.status, 400)
        assert.equal(errorCode(res), 'VALIDATION_ERROR')
        for (const f of ['parentId', 'scheduledFor', 'visitType']) assert.ok(res.json.error.fields[f], `missing field error for ${f}`)
    })

    it('rejects a past date and a bad visitType with 400', async () => {
        const res = await createVisit(tokenA, { parentId: parentIdA, scheduledFor: '2020-01-01T09:00:00Z', visitType: 'GOLD' })
        assert.equal(res.status, 400)
        assert.ok(res.json.error.fields.scheduledFor)
        assert.ok(res.json.error.fields.visitType)
    })

    it("rejects another user's parent with 404 PARENT_NOT_FOUND and creates nothing", async () => {
        const before = await prisma.visit.count({ where: { parentId: parentIdA } })
        const res = await createVisit(tokenB, { parentId: parentIdA, scheduledFor: future(), visitType: 'FULL' })
        assert.equal(res.status, 404)
        assert.equal(errorCode(res), 'PARENT_NOT_FOUND')
        assert.equal(await prisma.visit.count({ where: { parentId: parentIdA } }), before)
    })

    it('gives the same 404 for a non-existent parent', async () => {
        const res = await createVisit(tokenA, { parentId: 'does-not-exist', scheduledFor: future(), visitType: 'FULL' })
        assert.equal(res.status, 404)
        assert.equal(errorCode(res), 'PARENT_NOT_FOUND')
    })

    it('creates a PENDING visit for an owned parent (201), accepting a +08:00 offset', async () => {
        const at = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        const local = new Date(at.getTime() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00')
        const res = await createVisit(tokenA, { parentId: parentIdA, scheduledFor: local, visitType: 'FULL' })
        assert.equal(res.status, 201, JSON.stringify(res.json))
        assert.equal(res.json.success, true)
        assert.equal(res.json.data.visit.status, 'PENDING')
        assert.equal(new Date(res.json.data.visit.scheduledFor).getTime(), at.getTime())
    })
})

describe('role checks and data exposure', () => {
    it('CHILD cannot list nurse visits (403 FORBIDDEN)', async () => {
        const res = await api(srv.baseUrl, 'GET', '/api/visits/nurse', { token: tokenA })
        assert.equal(res.status, 403)
        assert.equal(errorCode(res), 'FORBIDDEN')
    })

    it('review reject response never includes the nurse password hash', async () => {
        const nurse = await createUser('NURSE')
        const reviewer = await createUser('ADMIN')
        const visit = await prisma.visit.create({
            data: { parentId: parentIdA, scheduledFor: new Date(), visitType: 'FULL', status: 'WAITING_APPROVAL', nurseId: nurse.id },
        })
        const token = await loginAs(srv.baseUrl, reviewer.email)
        const res = await api(srv.baseUrl, 'POST', `/api/review/visits/${visit.id}/reject`, { token, body: { rejectionNote: 'Тест' } })
        assert.equal(res.status, 200, JSON.stringify(res.json))
        assert.equal(res.json.data.visit.Nurse.id, nurse.id)
        assert.equal('password' in res.json.data.visit.Nurse, false)
    })

    it('rejecting a visit in the wrong status gives 409 INVALID_STATUS', async () => {
        const reviewer = await createUser('ADMIN')
        const visit = await prisma.visit.create({
            data: { parentId: parentIdA, scheduledFor: new Date(), visitType: 'FULL', status: 'PENDING' },
        })
        const token = await loginAs(srv.baseUrl, reviewer.email)
        const res = await api(srv.baseUrl, 'POST', `/api/review/visits/${visit.id}/reject`, { token, body: { rejectionNote: 'Тест' } })
        assert.equal(res.status, 409)
        assert.equal(errorCode(res), 'INVALID_STATUS')
    })
})
