import assert from 'node:assert/strict'
import test from 'node:test'

import { loginFlow, NOT_NURSE_MESSAGE, type Session, type SessionStore } from '../services/authFlow'
import { createHttpClient, type FetchLike } from '../services/httpClient'
import { resolveApiConfig } from '../utils/apiConfig'

const config = resolveApiConfig({ isDev: true, platform: 'ios', explicitUrl: 'http://api.test' })

function setup(status: number, body: unknown) {
  const calls: { url: string; body?: string }[] = []
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, body: init.body })
    return { status, text: async () => JSON.stringify(body) }
  }
  const saved: Session[] = []
  let cleared = 0
  const store: SessionStore = {
    saveSession: async (s) => {
      saved.push(s)
    },
    clearSession: async () => {
      cleared++
    },
  }
  const client = createHttpClient({ config, fetch, getToken: async () => null })
  return { client, store, calls, saved, cleared: () => cleared }
}

const user = (role: string) => ({ id: 'u1', name: 'Б.Номин', email: 'n@x.mn', role, createdAt: '2026-10-01' })

test('NURSE login saves the session', async () => {
  const t = setup(200, { success: true, data: { token: 'tok', user: user('NURSE') } })
  const out = await loginFlow(t.client, t.store, 'n@x.mn', 'secret')
  assert.equal(out.ok, true)
  assert.equal(t.calls[0].url, 'http://api.test/api/auth/login')
  assert.equal(t.saved.length, 1)
  assert.equal(t.saved[0].token, 'tok')
})

for (const role of ['CHILD', 'ADMIN', 'MEDICAL_ADMIN']) {
  test(`${role} login is refused and nothing is stored`, async () => {
    const t = setup(200, { success: true, data: { token: 'tok', user: user(role) } })
    const out = await loginFlow(t.client, t.store, 'a@x.mn', 'secret')
    assert.deepEqual(out, { ok: false, message: NOT_NURSE_MESSAGE })
    assert.equal(t.saved.length, 0)
  })
}

test('wrong password shows the server message', async () => {
  const t = setup(401, { success: false, message: 'И-мэйл эсвэл нууц үг буруу', error: { code: 'INVALID_CREDENTIALS' } })
  const out = await loginFlow(t.client, t.store, 'n@x.mn', 'bad')
  assert.deepEqual(out, { ok: false, message: 'И-мэйл эсвэл нууц үг буруу' })
  assert.equal(t.saved.length, 0)
})

test('login response without a user object is a contract error', async () => {
  const t = setup(200, { success: true, data: { token: 'tok', user: 'a.b.c' } })
  const out = await loginFlow(t.client, t.store, 'n@x.mn', 'secret')
  assert.equal(out.ok, false)
  assert.equal(t.saved.length, 0)
})
