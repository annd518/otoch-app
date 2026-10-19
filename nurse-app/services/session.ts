// Access-token refresh helpers. Pure: the HTTP client is injected.
import { API_PATHS } from '../config/api'
import type { HttpClient } from './httpClient'
import { decodeJwtClaims } from './jwt'
import { parseOtpSession } from './validators'

// Refresh slightly before the token really expires so a request in flight never
// carries an already-dead token.
export const REFRESH_SKEW_MS = 30_000

export function needsRefresh(token: string, nowMs: number, skewMs: number = REFRESH_SKEW_MS): boolean {
  const claims = decodeJwtClaims(token)
  if (!claims || claims.exp === undefined) return false
  return claims.exp * 1000 - skewMs <= nowMs
}

export function refreshTokens(client: HttpClient, refreshToken: string) {
  return client.request({
    method: 'POST',
    auth: 'none',
    path: API_PATHS.auth.refresh,
    body: { refreshToken },
    parse: parseOtpSession,
  })
}

export function revokeRefreshToken(client: HttpClient, refreshToken: string) {
  return client.request({
    method: 'POST',
    auth: 'none',
    path: API_PATHS.auth.logout,
    body: { refreshToken },
    parse: () => true,
  })
}
