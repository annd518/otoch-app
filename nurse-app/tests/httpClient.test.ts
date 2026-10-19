import assert from 'node:assert/strict'
import test from 'node:test'

import { createHttpClient, EXPIRED_SESSION_MESSAGE, type FetchLike } from '../services/httpClient'
import { resolveApiConfig } from '../utils/apiConfig'

const config = resolveApiConfig({ isDev: true, platform: 'ios', explicitUrl: 'http://api.test' })

function jwt(payload: object): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${enc({ alg: 'none' })}.${enc(payload)}.sig`
}

const parse = (d: unknown) => d

test('an expired stored token is never sent and ends the session', async () => {
  let sent = 0
  let ended = 0
  const fetch: FetchLike = async () => {
    sent++
    return { status: 200, text: async () => '{}' }
  }
  const client = createHttpClient({
    config,
    fetch,
    getToken: async () => jwt({ userId: 'u1', exp: 100 }),
    onUnauthorized: () => {
      ended++
    },
    now: () => 200_000,
  })
  const res = await client.request({ method: 'GET', path: '/api/staff/orders', parse })
  assert.equal(sent, 0)
  assert.equal(ended, 1)
  assert.equal(res.ok, false)
  if (!res.ok) assert.equal(res.message, EXPIRED_SESSION_MESSAGE)
})

test('a valid token is sent as a Bearer header', async () => {
  let auth: string | undefined
  const fetch: FetchLike = async (_url, init) => {
    auth = init.headers.Authorization
    return { status: 200, text: async () => JSON.stringify({ success: true, data: { ok: 1 } }) }
  }
  const token = jwt({ userId: 'u1', exp: 4_000_000_000 })
  const client = createHttpClient({ config, fetch, getToken: async () => token })
  const res = await client.request({ method: 'GET', path: '/api/staff/orders', parse })
  assert.equal(res.ok, true)
  assert.equal(auth, `Bearer ${token}`)
})

test('a 401 from the server ends the session', async () => {
  let ended = 0
  const fetch: FetchLike = async () => ({
    status: 401,
    text: async () => JSON.stringify({ success: false, message: 'x', error: { code: 'UNAUTHENTICATED' } }),
  })
  const client = createHttpClient({
    config,
    fetch,
    getToken: async () => jwt({ userId: 'u1', exp: 4_000_000_000 }),
    onUnauthorized: () => {
      ended++
    },
  })
  const res = await client.request({ method: 'GET', path: '/api/staff/orders', parse })
  assert.equal(res.ok, false)
  assert.equal(ended, 1)
})
