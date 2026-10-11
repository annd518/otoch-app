// Reads JWT claims WITHOUT verifying the signature. The server verifies the
// token on every request; the app only uses the claims to find its own user id
// (login returns the JWT string in data.user, docs/l1-1-backend-plan.md F6)
// and to skip an obviously expired session.
import { isRecord } from './apiResult'

export interface JwtClaims {
  userId: string
  email?: string
  role?: string
  exp?: number
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64UrlToBytes(input: string): number[] | null {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const char of base64) {
    if (char === '=') break
    const value = BASE64_ALPHABET.indexOf(char)
    if (value === -1) return null
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return bytes
}

function utf8Decode(bytes: number[]): string {
  let out = ''
  let i = 0
  while (i < bytes.length) {
    const b0 = bytes[i++]
    if (b0 < 0x80) {
      out += String.fromCharCode(b0)
    } else if (b0 >= 0xc0 && b0 < 0xe0) {
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (bytes[i++] & 0x3f))
    } else if (b0 >= 0xe0 && b0 < 0xf0) {
      out += String.fromCharCode(((b0 & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f))
    } else {
      const cp =
        ((b0 & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
      out += String.fromCodePoint(cp)
    }
  }
  return out
}

export function decodeJwtClaims(token: string): JwtClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const bytes = base64UrlToBytes(parts[1])
  if (!bytes) return null
  let payload: unknown
  try {
    payload = JSON.parse(utf8Decode(bytes))
  } catch {
    return null
  }
  if (!isRecord(payload) || typeof payload.userId !== 'string' || payload.userId === '') return null
  const claims: JwtClaims = { userId: payload.userId }
  if (typeof payload.email === 'string') claims.email = payload.email
  if (typeof payload.role === 'string') claims.role = payload.role
  if (typeof payload.exp === 'number') claims.exp = payload.exp
  return claims
}

export function isJwtExpired(claims: JwtClaims, nowMs: number): boolean {
  return claims.exp !== undefined && claims.exp * 1000 <= nowMs
}
