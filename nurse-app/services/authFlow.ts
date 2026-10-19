// Login / logout logic. Pure: the HTTP client and session storage are injected
// so the flow can be tested without React Native.
import { API_PATHS } from '../config/api'
import type { HttpClient } from './httpClient'
import { parseLoginData, parseOtpSession, type AppUser } from './validators'

export interface Session {
  token: string
  // Only phone + OTP sign-in returns one (access token lives 15 minutes).
  refreshToken?: string
  user: AppUser
}

export interface SessionStore {
  saveSession(session: Session): Promise<void>
  clearSession(): Promise<void>
}

export type LoginOutcome = { ok: true; user: AppUser } | { ok: false; message: string }

export const NOT_NURSE_MESSAGE = 'Энэ апп зөвхөн сувилагчид зориулагдсан.'

export async function loginFlow(
  client: HttpClient,
  store: SessionStore,
  email: string,
  password: string,
): Promise<LoginOutcome> {
  const login = await client.request({
    method: 'POST',
    path: API_PATHS.auth.login,
    body: { email, password },
    auth: 'none',
    parse: parseLoginData,
  })
  if (!login.ok) return { ok: false, message: login.message }

  // Family and admin accounts must never get a session in the nurse app.
  if (login.data.user.role !== 'NURSE') return { ok: false, message: NOT_NURSE_MESSAGE }

  await store.saveSession({ token: login.data.token, user: login.data.user })
  return { ok: true, user: login.data.user }
}

export async function otpLoginFlow(
  client: HttpClient,
  store: SessionStore,
  phone: string,
  challengeId: string,
  code: string,
): Promise<LoginOutcome> {
  const verified = await client.request({
    method: 'POST',
    path: API_PATHS.auth.otpVerify,
    body: { phone, challengeId, code, app: 'nurse' },
    auth: 'none',
    parse: parseOtpSession,
  })
  if (!verified.ok) return { ok: false, message: verified.message }
  if (verified.data.user.role !== 'NURSE') return { ok: false, message: NOT_NURSE_MESSAGE }
  await store.saveSession(verified.data)
  return { ok: true, user: verified.data.user }
}

export async function logoutFlow(store: SessionStore): Promise<void> {
  await store.clearSession()
}
