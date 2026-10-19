import * as SecureStore from 'expo-secure-store'

import type { Session, SessionStore } from '../services/authFlow'
import { decodeJwtClaims, isJwtExpired } from '../services/jwt'
import { parseUser } from '../services/validators'

const TOKEN_KEY = 'otoch_nurse_access_token'
const USER_KEY = 'otoch_nurse_user'

async function saveSession({ token, user }: Session): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
}

async function clearSession(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)])
}

async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

// A session is valid only with a token that is not past its exp claim, a
// well-formed user and the NURSE role. Anything else is cleared.
async function getValidSession(nowMs: number = Date.now()): Promise<Session | null> {
  const [token, rawUser] = await Promise.all([getAuthToken(), SecureStore.getItemAsync(USER_KEY)])
  let user = null
  try {
    user = rawUser ? parseUser(JSON.parse(rawUser)) : null
  } catch {
    user = null
  }
  const claims = token ? decodeJwtClaims(token) : null
  if (!token || !user || !claims || isJwtExpired(claims, nowMs) || user.role !== 'NURSE') {
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
