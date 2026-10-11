// Contract test: real backend responses fed into the web client's session logic
// (wclient/lib/auth/session-core.ts). Fails if either side drifts.
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { api, createUser, prisma, startServer, TEST_PASSWORD, TestServer, uniqueEmail } from './helpers'
// wclient is a separate (bundler/ESM-style) package; under tsx it loads via CJS interop,
// so take the namespace from `default` when present.
type SessionCore = typeof import('../../wclient/lib/auth/session-core')
let core: SessionCore

let srv: TestServer

before(async () => {
    const mod: any = await import('../../wclient/lib/auth/session-core')
    core = mod.default ?? mod
    srv = await startServer()
})
after(async () => { await srv.close(); await prisma.$disconnect() })

describe('web client auth compatibility', () => {
    const expectedHome = {
        ADMIN: '/dashboard/admin',
        NURSE: '/dashboard/nurse',
        MEDICAL_ADMIN: '/dashboard/medical-admin',
        CHILD: '/dashboard',
    } as const

    for (const role of ['ADMIN', 'NURSE', 'MEDICAL_ADMIN', 'CHILD'] as const) {
        it(`login as ${role} produces a valid web session and routes to ${expectedHome[role]}`, async () => {
            const user = await createUser(role)
            const res = await api(srv.baseUrl, 'POST', '/api/auth/login', { body: { email: user.email, password: TEST_PASSWORD } })
            assert.equal(res.status, 200)
            const session = core.sessionFromAuthData(res.json.data)
            assert.ok(session, 'web client rejected the login response')
            assert.equal(session.user.id, user.id)
            assert.equal(session.user.role, role)
            assert.equal('password' in session.user, false)
            assert.equal(core.isTokenExpired(session.token), false)
            assert.equal(core.homePathForRole(session.user.role), expectedHome[role])
        })
    }

    it('signup response is also a valid web session (CHILD)', async () => {
        const res = await api(srv.baseUrl, 'POST', '/api/auth/signup', {
            body: { name: 'Вэб Туршилт', email: uniqueEmail('web'), password: TEST_PASSWORD },
        })
        assert.equal(res.status, 201)
        assert.equal(core.sessionFromAuthData(res.json.data)?.user.role, 'CHILD')
    })

    it('the legacy shape (data.user = JWT string) is rejected, not trusted', async () => {
        const user = await createUser('ADMIN')
        const res = await api(srv.baseUrl, 'POST', '/api/auth/login', { body: { email: user.email, password: TEST_PASSWORD } })
        const legacy = { token: res.json.data.token, user: res.json.data.token }
        assert.equal(core.sessionFromAuthData(legacy), null)
    })

    it('a user object that disagrees with the token claims is rejected', async () => {
        const user = await createUser('CHILD')
        const res = await api(srv.baseUrl, 'POST', '/api/auth/login', { body: { email: user.email, password: TEST_PASSWORD } })
        const tampered = { token: res.json.data.token, user: { ...res.json.data.user, role: 'ADMIN' } }
        assert.equal(core.sessionFromAuthData(tampered), null)
    })

    it('invalid credentials give a 401 with a displayable message for the web toast', async () => {
        const res = await api(srv.baseUrl, 'POST', '/api/auth/login', { body: { email: uniqueEmail('x'), password: 'wrong-password' } })
        assert.equal(res.status, 401)
        assert.equal(res.json.message, 'Имэйл эсвэл нууц үг буруу байна')
    })
})
