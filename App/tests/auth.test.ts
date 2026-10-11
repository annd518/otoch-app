import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LOGIN_PROFILE_ERROR, SIGNUP_LOGIN_REQUIRED, loginFlow, logoutFlow, signupFlow } from '../services/authFlow'
import { createMemoryStore, makeClient, makeJwt } from './helpers'

// Response bodies copied from the current server code:
// login  server/src/controllers/authController.ts (success: data.user = JWT string; errors: HTTP 200 { message })
// users  server/src/routes/users.ts GET /api/users/:id
// signup server/src/controllers/authController.ts (no token in the response)
const JWT = makeJwt({ userId: 'u_child_1', email: 'child@test.mn', role: 'CHILD', exp: 4102444800 })
const USER = { id: 'u_child_1', name: 'Туршилтын Хүү', email: 'child@test.mn', role: 'CHILD' }

describe('login', () => {
  it('loads the user profile when data.user is the JWT string and stores token, user and role', async () => {
    const { client, calls } = makeClient([
      { status: 200, body: { success: true, message: 'Амжилттай нэвтэрлээ', data: { token: JWT, user: JWT } } },
      { status: 200, body: { success: true, data: { user: { ...USER, createdAt: '2026-10-01T00:00:00.000Z' } } } },
    ])
    const store = createMemoryStore()

    const result = await loginFlow(client, store, 'child@test.mn', 'secret1')

    assert.deepEqual(result, { ok: true, user: USER })
    assert.deepEqual(store.current(), { token: JWT, user: USER })
    assert.equal(calls[0].url, 'http://api.test/api/auth/login')
    assert.equal(calls[0].init.headers.Authorization, undefined)
    assert.deepEqual(JSON.parse(calls[0].init.body ?? ''), { email: 'child@test.mn', password: 'secret1' })
    assert.equal(calls[1].url, 'http://api.test/api/users/u_child_1')
    assert.equal(calls[1].init.headers.Authorization, `Bearer ${JWT}`)
  })

  it('uses data.user directly when the server returns a user object', async () => {
    const { client, calls } = makeClient([{ status: 200, body: { success: true, data: { token: JWT, user: USER } } }])
    const store = createMemoryStore()

    const result = await loginFlow(client, store, 'child@test.mn', 'secret1')

    assert.equal(result.ok, true)
    assert.equal(calls.length, 1)
    assert.equal(store.current()?.user.role, 'CHILD')
  })

  it('fails on HTTP 200 without success:true and stores nothing (wrong password today)', async () => {
    const { client, calls } = makeClient([{ status: 200, body: { message: 'Нууц үг буруу байна' } }])
    const store = createMemoryStore()

    const result = await loginFlow(client, store, 'child@test.mn', 'wrong')

    assert.deepEqual(result, { ok: false, message: 'Нууц үг буруу байна' })
    assert.equal(store.current(), null)
    assert.equal(calls.length, 1)
  })

  it('fails when success:true but the token is missing', async () => {
    const { client } = makeClient([{ status: 200, body: { success: true, data: { user: USER } } }])
    const store = createMemoryStore()

    const result = await loginFlow(client, store, 'child@test.mn', 'secret1')

    assert.equal(result.ok, false)
    assert.equal(store.current(), null)
  })

  it('fails and stores nothing when the profile request fails', async () => {
    const { client } = makeClient([
      { status: 200, body: { success: true, data: { token: JWT, user: JWT } } },
      { status: 403, body: { success: false, message: 'Хандах эрхгүй' } },
    ])
    const store = createMemoryStore()

    const result = await loginFlow(client, store, 'child@test.mn', 'secret1')

    assert.deepEqual(result, { ok: false, message: LOGIN_PROFILE_ERROR })
    assert.equal(store.current(), null)
  })

  it('does not trigger the session-expired handler on a 401 from login itself', async () => {
    const { client, unauthorizedCount } = makeClient([{ status: 401, body: { success: false, message: 'Unauthorized' } }])

    const result = await loginFlow(client, createMemoryStore(), 'a@b.mn', 'x')

    assert.equal(result.ok, false)
    assert.equal(unauthorizedCount(), 0)
  })

  it('reports a network failure without throwing', async () => {
    const { client } = makeClient([{ networkError: true }])

    const result = await loginFlow(client, createMemoryStore(), 'a@b.mn', 'x')

    assert.equal(result.ok, false)
    assert.match(result.ok ? '' : result.message, /Сервертэй холбогдож чадсангүй/)
  })
})

describe('signup', () => {
  it('asks the user to log in when the server returns no token (current contract)', async () => {
    const { client, calls } = makeClient([
      { status: 201, body: { success: true, message: 'Хэрэглэгч амжилттай бүртгэгдлээ', data: { user: USER } } },
    ])
    const store = createMemoryStore()

    const result = await signupFlow(client, store, { name: USER.name, email: USER.email, password: 'secret1' })

    assert.deepEqual(result, { kind: 'login_required', email: USER.email, message: SIGNUP_LOGIN_REQUIRED })
    assert.equal(store.current(), null)
    assert.equal(JSON.parse(calls[0].init.body ?? '').role, 'CHILD')
  })

  it('signs in when a future server returns a token', async () => {
    const { client } = makeClient([{ status: 201, body: { success: true, data: { user: USER, token: JWT } } }])
    const store = createMemoryStore()

    const result = await signupFlow(client, store, { name: USER.name, email: USER.email, password: 'secret1' })

    assert.deepEqual(result, { kind: 'signed_in', user: USER })
    assert.deepEqual(store.current(), { token: JWT, user: USER })
  })

  it('fails with the server message on HTTP 200 without success (email already used today)', async () => {
    const { client } = makeClient([{ status: 200, body: { message: 'Энэ имэйлээр бүртгэл аль хэдийн үүссэн байна' } }])

    const result = await signupFlow(client, createMemoryStore(), { name: 'A', email: 'a@b.mn', password: 'secret1' })

    assert.deepEqual(result, { kind: 'failed', message: 'Энэ имэйлээр бүртгэл аль хэдийн үүссэн байна' })
  })
})

describe('logout', () => {
  it('clears the stored session', async () => {
    const store = createMemoryStore({ token: JWT, user: { id: 'u1', name: 'A', email: 'a@b.mn', role: 'CHILD' } })

    await logoutFlow(store)

    assert.equal(store.current(), null)
  })
})

describe('auth shapes implemented on work/backend-l1-1 (e261639)', () => {
  it('login 401 INVALID_CREDENTIALS shows the message and does not end a session', async () => {
    const { client, unauthorizedCount } = makeClient([
      {
        status: 401,
        body: { success: false, message: 'Имэйл эсвэл нууц үг буруу байна', error: { code: 'INVALID_CREDENTIALS' } },
      },
    ])
    const store = createMemoryStore()

    const result = await loginFlow(client, store, 'a@b.mn', 'wrong')

    assert.deepEqual(result, { ok: false, message: 'Имэйл эсвэл нууц үг буруу байна' })
    assert.equal(unauthorizedCount(), 0)
    assert.equal(store.current(), null)
  })

  it('signup 409 EMAIL_TAKEN fails with the server message', async () => {
    const { client } = makeClient([
      {
        status: 409,
        body: {
          success: false,
          message: 'Энэ имэйлээр бүртгэл аль хэдийн үүссэн байна',
          error: { code: 'EMAIL_TAKEN', fields: { email: 'Бүртгэлтэй имэйл' } },
        },
      },
    ])

    const result = await signupFlow(client, createMemoryStore(), { name: 'A', email: 'a@b.mn', password: 'secret1' })

    assert.deepEqual(result, { kind: 'failed', message: 'Энэ имэйлээр бүртгэл аль хэдийн үүссэн байна' })
  })
})
