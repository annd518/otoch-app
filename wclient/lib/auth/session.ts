/**
 * Browser session storage for the web dashboard.
 * - auth_token (cookie + localStorage): JWT, read by middleware.ts and the API clients
 * - auth_user  (cookie): JSON of the validated user object (id, name, email, role)
 * The legacy `user_token` (old JWT-in-data.user contract) is no longer trusted.
 */
import Cookies from 'js-cookie';
import { isTokenExpired, parseSessionUser, type Session, type SessionUser } from './session-core';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const LEGACY_KEYS = ['user_token', 'token', 'user'];
const COOKIE_OPTIONS = { expires: 7, sameSite: 'lax' as const };

export function saveSession({ token, user }: Session): void {
  Cookies.set(TOKEN_KEY, token, COOKIE_OPTIONS);
  Cookies.set(USER_KEY, JSON.stringify(user), COOKIE_OPTIONS);
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
  for (const key of LEGACY_KEYS) Cookies.remove(key);
  if (typeof window !== 'undefined') localStorage.removeItem('user_token');
}

export function clearSession(): void {
  for (const key of [TOKEN_KEY, USER_KEY, ...LEGACY_KEYS]) Cookies.remove(key);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('user_token');
  }
}

export function getToken(): string | null {
  return Cookies.get(TOKEN_KEY) ?? null;
}

/** Returns the stored user only if a non-expired token is present too. */
export function getSessionUser(): SessionUser | null {
  const token = getToken();
  const raw = Cookies.get(USER_KEY);
  if (!token || !raw || isTokenExpired(token)) return null;
  try {
    return parseSessionUser(JSON.parse(raw));
  } catch {
    return null;
  }
}
