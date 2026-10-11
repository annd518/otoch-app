import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { api, createUser, decodeJwtPayload, errorCode, prisma, startServer, TEST_PASSWORD, TestServer, uniqueEmail } from './helpers'

let srv: TestServer

before(async () => { srv = await startServer() })
after(async () => { await srv.close(); await prisma.$disconnect() })

const signup = (body: unknown) => api(srv.baseUrl, 'POST', '/api/auth/signup', { body })
const login = (body: unknown) => api(srv.baseUrl, 'POST', '/api/auth/login', { body })

function assertPublicUser(user: any, role = 'CHILD') {
    assert.equal(typeof user, 'object', 'data.user must be an object, not a token string')
    assert.deepEqual(Object.keys(user).sort(), ['createdAt', 'email', 'id', 'name', 'role'])
    assert.equal(user.role, role)
    assert.equal('password' in user, false)
}

describe('POST /api/auth/signup', () => {
    it('creates a CHILD and returns separate token + user object (201)', async () => {
        const email = uniqueEmail('signup')
        const res = await signup({ name: 'Туршилт Хэрэглэгч', email, password: TEST_PASSWORD })
        assert.equal(res.status, 201)
        assert.equal(res.json.success, true)
        assert.equal(typeof res.json.data.token, 'string')
        assert.equal(res.json.data.token.split('.').length, 3)
        assertPublicUser(res.json.data.user)
        assert.equal(res.json.data.user.email, email)
        assert.equal(decodeJwtPayload(res.json.data.token).role, 'CHILD')

        // the issued token works on a protected route
        const parents = await api(srv.baseUrl, 'GET', '/api/parents', { token: res.json.data.token })
        assert.equal(parents.status, 200)
    })

    it('accepts an explicit role=CHILD (current mobile payload)', async () => {
        const res = await signup({ name: 'Туршилт', email: uniqueEmail('child'), password: TEST_PASSWORD, role: 'CHILD' })
        assert.equal(res.status, 201)
        assert.equal(res.json.data.user.role, 'CHILD')
    })

    for (const role of ['ADMIN', 'NURSE', 'MEDICAL_ADMIN', 'admin', 'SUPERUSER']) {
        it(`rejects privileged/unknown role "${role}" with 403 and creates nothing`, async () => {
            const email = uniqueEmail(`priv-${role}`)
            const res = await signup({ name: 'Халдагч', email, password: TEST_PASSWORD, role })
            assert.equal(res.status, 403)
            assert.equal(errorCode(res), 'ROLE_NOT_ALLOWED')
            assert.ok(res.json.error.fields?.role)
            assert.equal(res.json.data, undefined)
            assert.equal(await prisma.user.count({ where: { email } }), 0)
        })
    }

    it('returns 409 EMAIL_TAKEN for an existing email (case-insensitive)', async () => {
        const email = uniqueEmail('dup')
        assert.equal((await signup({ name: 'Анхны', email, password: TEST_PASSWORD })).status, 201)
        const res = await signup({ name: 'Давхар', email: email.toUpperCase(), password: TEST_PASSWORD })
        assert.equal(res.status, 409)
        assert.equal(errorCode(res), 'EMAIL_TAKEN')
    })

    it('returns 400 VALIDATION_ERROR with field messages for invalid input', async () => {
        const res = await signup({ name: 'A', email: 'not-an-email', password: '123' })
        assert.equal(res.status, 400)
        assert.equal(errorCode(res), 'VALIDATION_ERROR')
        assert.ok(res.json.error.fields.name)
        assert.ok(res.json.error.fields.email)
        assert.ok(res.json.error.fields.password)
    })
})

describe('POST /api/auth/login', () => {
    it('returns 200 with token string and user object', async () => {
        const user = await createUser('NURSE')
        const res = await login({ email: user.email, password: TEST_PASSWORD })
        assert.equal(res.status, 200)
        assert.equal(res.json.success, true)
        assert.equal(typeof res.json.data.token, 'string')
        assertPublicUser(res.json.data.user, 'NURSE')
        assert.equal(res.json.data.user.id, user.id)
        assert.equal(decodeJwtPayload(res.json.data.token).userId, user.id)
    })

    it('wrong password and unknown email give the same 401 (no account enumeration)', async () => {
        const user = await createUser('CHILD')
        const wrong = await login({ email: user.email, password: 'definitely-wrong' })
        const unknown = await login({ email: uniqueEmail('nobody'), password: 'definitely-wrong' })
        for (const res of [wrong, unknown]) {
            assert.equal(res.status, 401)
            assert.equal(errorCode(res), 'INVALID_CREDENTIALS')
        }
        assert.equal(wrong.json.message, unknown.json.message)
        assert.deepEqual(wrong.json.error, unknown.json.error)
    })

    it('returns 400 VALIDATION_ERROR for invalid body', async () => {
        const res = await login({ email: 'bad', password: '' })
        assert.equal(res.status, 400)
        assert.equal(errorCode(res), 'VALIDATION_ERROR')
    })

    it('returns 400 INVALID_JSON for malformed JSON', async () => {
        const res = await api(srv.baseUrl, 'POST', '/api/auth/login', { rawBody: '{"email": ' })
        assert.equal(res.status, 400)
        assert.equal(errorCode(res), 'INVALID_JSON')
    })
})

describe('auth middleware and error contract', () => {
    it('missing and invalid tokens give 401 UNAUTHENTICATED', async () => {
        const none = await api(srv.baseUrl, 'GET', '/api/parents')
        const bad = await api(srv.baseUrl, 'GET', '/api/parents', { token: 'not.a.jwt' })
        for (const res of [none, bad]) {
            assert.equal(res.status, 401)
            assert.equal(errorCode(res), 'UNAUTHENTICATED')
        }
    })

    it('expired token gives 401 TOKEN_EXPIRED; forged signature gives 401 UNAUTHENTICATED', async () => {
        const user = await createUser('CHILD')
        const claims = { userId: user.id, email: user.email, role: user.role }
        const expired = jwt.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET!)
        const forged = jwt.sign(claims, 'not-the-server-secret', { expiresIn: '1h' })

        const exp = await api(srv.baseUrl, 'GET', '/api/parents', { token: expired })
        assert.equal(exp.status, 401)
        assert.equal(errorCode(exp), 'TOKEN_EXPIRED')

        const bad = await api(srv.baseUrl, 'GET', '/api/parents', { token: forged })
        assert.equal(bad.status, 401)
        assert.equal(errorCode(bad), 'UNAUTHENTICATED')
    })

    it('valid token with the wrong role gives 403 FORBIDDEN (not 401)', async () => {
        const user = await createUser('CHILD')
        const token = (await login({ email: user.email, password: TEST_PASSWORD })).json.data.token
        const res = await api(srv.baseUrl, 'GET', '/api/users', { token })
        assert.equal(res.status, 403)
        assert.equal(errorCode(res), 'FORBIDDEN')
    })

    it('unknown /api route gives 404 NOT_FOUND in the error contract', async () => {
        const res = await api(srv.baseUrl, 'GET', '/api/does-not-exist')
        assert.equal(res.status, 404)
        assert.equal(errorCode(res), 'NOT_FOUND')
    })
})
