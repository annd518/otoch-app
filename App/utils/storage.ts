import AsyncStorage from '@react-native-async-storage/async-storage'

import type { AppUser, UserRole } from '../services/apiTypes'
import type { Session, SessionStore } from '../services/authFlow'
import { decodeJwtClaims, isJwtExpired } from '../services/jwt'
import { isUserRole, parseUser } from '../services/validators'

// Keys are unchanged from the previous version so existing installs keep working.
const STORAGE_KEYS = {
  AUTH_TOKEN: '@auth_token',
  USER_DATA: '@user_data',
  USER_ROLE: '@user_role',
} as const

const SESSION_KEYS = [STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER_DATA, STORAGE_KEYS.USER_ROLE]

function parseStoredUser(raw: string | null): AppUser | null {
  if (!raw) return null
  try {
    return parseUser(JSON.parse(raw))
  } catch {
    return null
  }
}

async function saveSession({ token, user }: Session): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.AUTH_TOKEN, token],
    [STORAGE_KEYS.USER_DATA, JSON.stringify(user)],
    [STORAGE_KEYS.USER_ROLE, user.role],
  ])
}

async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove(SESSION_KEYS)
}

async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
}

async function getUser(): Promise<AppUser | null> {
  return parseStoredUser(await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA))
}

async function getUserRole(): Promise<UserRole | null> {
  const role = await AsyncStorage.getItem(STORAGE_KEYS.USER_ROLE)
  return isUserRole(role) ? role : null
}

// A session is valid only with a token, a well-formed user object and a token
// that is not past its exp claim. Older installs stored the JWT string as the
// user; those sessions are cleared so the user logs in again.
async function getValidSession(nowMs: number = Date.now()): Promise<Session | null> {
  const pairs = await AsyncStorage.multiGet([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER_DATA])
  const token = pairs[0]?.[1] ?? null
  const user = parseStoredUser(pairs[1]?.[1] ?? null)
  const claims = token ? decodeJwtClaims(token) : null
  if (!token || !user || !claims || isJwtExpired(claims, nowMs)) {
    if (token || user) await clearSession()
    return null
  }
  return { token, user }
}

export const storage = {
  saveSession,
  clearSession,
  getAuthToken,
  getUser,
  getUserRole,
  getValidSession,
} satisfies SessionStore & Record<string, unknown>
