// Login / signup / logout logic. Pure: the HTTP client and session storage are
// injected so the flows can be tested without React Native.
import type { AppUser, SignupInput } from './apiTypes'
import { API_PATHS } from '../config/api'
import type { HttpClient } from './httpClient'
import { decodeJwtClaims } from './jwt'
import { parseLoginData, parseSignupData, parseUser, parseUserEnvelope } from './validators'

export interface Session {
  token: string
  user: AppUser
}

export interface SessionStore {
  saveSession(session: Session): Promise<void>
  clearSession(): Promise<void>
}

export type LoginOutcome = { ok: true; user: AppUser } | { ok: false; message: string }

export type SignupOutcome =
  | { kind: 'signed_in'; user: AppUser }
  | { kind: 'login_required'; email: string; message: string }
  | { kind: 'failed'; message: string }

export const LOGIN_PROFILE_ERROR = 'Хэрэглэгчийн мэдээллийг авч чадсангүй. Дахин нэвтэрнэ үү.'
export const SIGNUP_LOGIN_REQUIRED = 'Бүртгэл амжилттай үүслээ. Одоо нэвтэрнэ үү.'

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

  const { token } = login.data
  // Today the server puts the JWT string in data.user (backend plan F6).
  // Accept a real user object if it ever arrives, otherwise load the profile.
  let user = parseUser(login.data.user)
  if (!user) {
    const claims = decodeJwtClaims(token)
    if (!claims) return { ok: false, message: LOGIN_PROFILE_ERROR }
    const profile = await client.request({
      method: 'GET',
      path: API_PATHS.users.byId(claims.userId),
      auth: { token },
      parse: parseUserEnvelope,
    })
    if (!profile.ok) return { ok: false, message: LOGIN_PROFILE_ERROR }
    user = profile.data
  }

  await store.saveSession({ token, user })
  return { ok: true, user }
}

export async function signupFlow(
  client: HttpClient,
  store: SessionStore,
  input: SignupInput,
): Promise<SignupOutcome> {
  const result = await client.request({
    method: 'POST',
    path: API_PATHS.auth.signup,
    // The mobile app only creates family (CHILD) accounts.
    body: { name: input.name, email: input.email, password: input.password, role: 'CHILD' },
    auth: 'none',
    parse: parseSignupData,
  })
  if (!result.ok) return { kind: 'failed', message: result.message }

  const { user, token } = result.data
  if (token) {
    await store.saveSession({ token, user })
    return { kind: 'signed_in', user }
  }
  // Current contract: signup returns no token (docs/l1-1-api.md §1).
  return { kind: 'login_required', email: user.email, message: SIGNUP_LOGIN_REQUIRED }
}

export async function logoutFlow(store: SessionStore): Promise<void> {
  await store.clearSession()
}
