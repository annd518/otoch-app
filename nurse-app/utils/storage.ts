import * as SecureStore from 'expo-secure-store'

import type { Session, SessionStore } from '../services/authFlow'
import { createHttpClient } from '../services/httpClient'
import { decodeJwtClaims, isJwtExpired } from '../services/jwt'
import { needsRefresh, refreshTokens, revokeRefreshToken } from '../services/session'
import { parseUser } from '../services/validators'
import { apiConfig } from './env'

const TOKEN_KEY = 'otoch_nurse_access_token'
const REFRESH_KEY = 'otoch_nurse_refresh_token'
const USER_KEY = 'otoch_nurse_user'

// Unauthenticated client for refresh / logout; the main client (services/http.ts)
// depends on this module, so it cannot be used here.
const authClient = createHttpClient({
  config: apiConfig,
  fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }),
  getToken: async () => null,
})

async function saveSession({ token, refreshToken, user }: Session): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
  // An email sign-in has no refresh token; never keep an older user's one.
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, refreshToken)
  else await SecureStore.deleteItemAsync(REFRESH_KEY)
}

async function clearSession(): Promise<void> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY)
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ])
  // Best effort: the server revokes the refresh session; the local sign-out never waits on it.
  if (refreshToken) void revokeRefreshToken(authClient, refreshToken)
}

let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(stale: string | null, refreshToken: string): Promise<string | null> {
  const result = await refreshTokens(authClient, refreshToken)
  if (result.ok) {
    await SecureStore.setItemAsync(TOKEN_KEY, result.data.token)
    await SecureStore.setItemAsync(REFRESH_KEY, result.data.refreshToken)
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.data.user))
    return result.data.token
  }
  // Offline or server down: keep the session and try again on the next request.
  if (result.kind === 'network' || result.kind === 'config') return stale
  // The refresh token is spent, revoked or expired: the nurse signs in again.
  await clearSession()
  return null
}

// The stored access token, refreshed first when it is (about to be) expired.
// Concurrent callers share one refresh because refresh tokens are single use.
async function getAuthToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY)
  if (token && !needsRefresh(token, Date.now())) return token
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY)
  if (!refreshToken) return token
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(token, refreshToken).finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

// A session is valid only with a token, a well-formed NURSE user and either a
// live token or a refresh token that can renew it. Anything else is cleared.
async function getValidSession(nowMs: number = Date.now()): Promise<Session | null> {
  const token = await getAuthToken()
  const [rawUser, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(USER_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ])
  let user = null
  try {
    user = rawUser ? parseUser(JSON.parse(rawUser)) : null
  } catch {
    user = null
  }
  const claims = token ? decodeJwtClaims(token) : null
  const live = claims !== null && !isJwtExpired(claims, nowMs)
  if (!token || !user || !claims || user.role !== 'NURSE' || (!live && !refreshToken)) {
    if (token || rawUser) await clearSession()
    return null
  }
  return { token, user }
}

export const storage = {
  saveSession,
  clearSession,
  getAuthToken,
  getValidSession,
} satisfies SessionStore & Record<string, unknown>
