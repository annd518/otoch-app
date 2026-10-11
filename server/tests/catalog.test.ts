import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { api, createUser, errorCode, loginAs, prisma, startServer, TestServer } from './helpers'
import { CATALOG_FIXTURES } from '../prisma/fixtures/catalog'

let srv: TestServer
let token: string

const SERVICE_KEYS = [
    'category', 'code', 'description', 'durationMin', 'id', 'isActive', 'isFixture',
    'name', 'priceMnt', 'redFlagQuestionnaire', 'requiresReferral',
].sort()

before(async () => {
    srv = await startServer()
    for (const item of CATALOG_FIXTURES) {
        await prisma.serviceCatalogItem.upsert({
            where: { code: item.code },
            update: {},
            create: { ...item, isFixture: true },
        })
    }
    // An inactive row that must never be returned
    await prisma.serviceCatalogItem.upsert({
        where: { code: 'TEST_INACTIVE_SERVICE' },
        update: {},
        create: {
            code: 'TEST_INACTIVE_SERVICE', name: 'Идэвхгүй (тест)', category: 'HOME_VISIT',
            priceMnt: 1000, durationMin: 10, isActive: false, isFixture: true,
        },
    })
    const user = await createUser('CHILD')
    token = await loginAs(srv.baseUrl, user.email)
})
after(async () => { await srv.close(); await prisma.$disconnect() })

describe('GET /api/catalog/services', () => {
    it('requires authentication (401)', async () => {
        const res = await api(srv.baseUrl, 'GET', '/api/catalog/services')
        assert.equal(res.status, 401)
        assert.equal(errorCode(res), 'UNAUTHENTICATED')
    })

    it('matches the mobile contract (docs/l1-1-api.md §2)', async () => {
        const res = await api(srv.baseUrl, 'GET', '/api/catalog/services', { token })
        assert.equal(res.status, 200)
        assert.equal(res.json.success, true)
        assert.equal(typeof res.json.message, 'string')

        const { catalogVersion, currency, containsFixtures, services } = res.json.data
        assert.equal(currency, 'MNT')
        assert.equal(typeof catalogVersion, 'string')
        assert.ok(!Number.isNaN(Date.parse(catalogVersion)))
        assert.equal(containsFixtures, true)
        assert.equal(services.length, CATALOG_FIXTURES.length)

        for (const s of services) {
            assert.deepEqual(Object.keys(s).sort(), SERVICE_KEYS)
            assert.match(s.code, /^[A-Z][A-Z0-9_]+$/)
            assert.ok(Number.isInteger(s.priceMnt) && s.priceMnt > 0, `priceMnt must be positive integer MNT: ${s.priceMnt}`)
            assert.ok(Number.isInteger(s.durationMin) && s.durationMin > 0)
            assert.equal(typeof s.requiresReferral, 'boolean')
            assert.equal(s.isActive, true)
            assert.equal(s.isFixture, true)
        }
        assert.deepEqual(services.map((s: any) => s.code), CATALOG_FIXTURES.map((f) => f.code))
        assert.equal(services.some((s: any) => s.code === 'TEST_INACTIVE_SERVICE'), false)
    })

    it('filters by category', async () => {
        const res = await api(srv.baseUrl, 'GET', '/api/catalog/services?category=HOME_PROCEDURE', { token })
        assert.equal(res.status, 200)
        const expected = CATALOG_FIXTURES.filter((f) => f.category === 'HOME_PROCEDURE').map((f) => f.code)
        assert.deepEqual(res.json.data.services.map((s: any) => s.code), expected)
    })

    it('rejects a malformed category with 400', async () => {
        const res = await api(srv.baseUrl, 'GET', '/api/catalog/services?category=drop;table', { token })
        assert.equal(res.status, 400)
        assert.equal(errorCode(res), 'VALIDATION_ERROR')
    })
})
