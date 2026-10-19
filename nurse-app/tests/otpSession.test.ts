import assert from 'node:assert/strict'
import test from 'node:test'

import { NOT_NURSE_MESSAGE, otpLoginFlow, type Session, type SessionStore } from '../services/authFlow'
import { createHttpClient, type FetchLike } from '../services/httpClient'
import { requestOtp } from '../services/otp'
import { needsRefresh, refreshTokens } from '../services/session'
import { resolveApiConfig } from '../utils/apiConfig'
import { toE164 } from '../utils/phone'

const config = resolveApiConfig({ isDev: true, platform: 'ios', explicitUrl: 'http://api.test' })
const jwt = (payload: object) => {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${enc({ alg: 'none' })}.${enc(payload)}.sig`
}

function setup(status: number, data: unknown, error?: object) {
  const seen: { url: string; body: unknown }[] = []
  const fetch: FetchLike = async (url, init) => {
    seen.push({ url, body: init.body ? JSON.parse(init.body) : undefined })
    return { status, text: async () => JSON.stringify(status < 300 ? { success: true, data } : { success: false, message: 'x', error }) }
  }
  const saved: Session[] = []
  const store: SessionStore = { saveSession: async (s) => void saved.push(s), clearSession: async () => {} }
  return { seen, saved, store, client: createHttpClient({ config, fetch, getToken: async () => null }) }
}

const user = (role: string) => ({ id: 'u1', name: 'Б.Номин', email: 'n@x.mn', role })

test('phone numbers: 8 digits get +976, E.164 passes, junk is refused', () => {
  assert.equal(toE164('9911 2233'), '+97699112233')
  assert.equal(toE164('99-11-22-33'), '+97699112233')
  assert.equal(toE164('+97699112233'), '+97699112233')
  assert.equal(toE164('991122'), null)
  assert.equal(toE164('+1 555 123 4567'), null)
})

test('requestOtp posts the phone and keeps the resend delay', async () => {
  const t = setup(200, { challengeId: 'c1', expiresAt: '2026-10-05T00:05:00Z', resendAfterSeconds: 60, isMock: false })
  const r = await requestOtp(t.client, '+97699112233')
  assert.equal(r.ok, true)
  assert.deepEqual(t.seen[0].body, { phone: '+97699112233' })
  if (r.ok) assert.equal(r.data.challengeId, 'c1')
})

test('OTP login identifies itself as the nurse app and stores the refresh token', async () => {
  const t = setup(200, { token: 'a.b.c', refreshToken: 'r'.repeat(64), user: user('NURSE') })
  const out = await otpLoginFlow(t.client, t.store, '+97699112233', 'c1', '483920')
  assert.equal(out.ok, true)
  assert.deepEqual(t.seen[0].body, { phone: '+97699112233', challengeId: 'c1', code: '483920', app: 'nurse' })
  assert.equal(t.saved[0].refreshToken, 'r'.repeat(64))
})

test('OTP login refuses a non-nurse user and stores nothing', async () => {
  const t = setup(200, { token: 'a.b.c', refreshToken: 'r'.repeat(64), user: user('CHILD') })
  const out = await otpLoginFlow(t.client, t.store, '+97699112233', 'c1', '483920')
  assert.deepEqual(out, { ok: false, message: NOT_NURSE_MESSAGE })
  assert.equal(t.saved.length, 0)
})

test('wrong code shows the server message', async () => {
  const t = setup(400, null, { code: 'OTP_INVALID' })
  const out = await otpLoginFlow(t.client, t.store, '+97699112233', 'c1', '000000')
  assert.equal(out.ok, false)
  assert.equal(t.saved.length, 0)
})

test('needsRefresh: expired, within the skew, fresh, and tokens without exp', () => {
  const now = 1_000_000_000_000
  assert.equal(needsRefresh(jwt({ userId: 'u', exp: now / 1000 - 10 }), now), true)
  assert.equal(needsRefresh(jwt({ userId: 'u', exp: now / 1000 + 10 }), now), true)
  assert.equal(needsRefresh(jwt({ userId: 'u', exp: now / 1000 + 600 }), now), false)
  assert.equal(needsRefresh(jwt({ userId: 'u' }), now), false)
  assert.equal(needsRefresh('not-a-jwt', now), false)
})

test('refresh posts the refresh token and parses the rotated pair', async () => {
  const t = setup(200, { token: 'n.e.w', refreshToken: 'z'.repeat(64), user: user('NURSE') })
  const r = await refreshTokens(t.client, 'old'.repeat(20))
  assert.equal(r.ok, true)
  assert.equal(t.seen[0].url, 'http://api.test/api/auth/refresh')
  assert.deepEqual(t.seen[0].body, { refreshToken: 'old'.repeat(20) })
  if (r.ok) assert.equal(r.data.refreshToken, 'z'.repeat(64))
})

test('a spent refresh token is an unauthorized failure (the session is cleared)', async () => {
  const t = setup(401, null, { code: 'UNAUTHENTICATED' })
  const r = await refreshTokens(t.client, 'old'.repeat(20))
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.kind, 'unauthorized')
})
