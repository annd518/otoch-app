import { isRecord } from './apiResult'

export type UserRole = 'CHILD' | 'NURSE' | 'MEDICAL_ADMIN' | 'ADMIN'
const USER_ROLES: readonly string[] = ['CHILD', 'NURSE', 'MEDICAL_ADMIN', 'ADMIN']

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

export function parseUser(value: unknown): AppUser | null {
  if (!isRecord(value)) return null
  const { id, name, email, role } = value
  if (
    !nonEmptyString(id) ||
    typeof name !== 'string' ||
    !nonEmptyString(email) ||
    typeof role !== 'string' ||
    !USER_ROLES.includes(role)
  )
    return null
  return { id, name, email, role: role as UserRole }
}

export interface LoginData {
  token: string
  user: AppUser
}

// Login answers { token, user: {id, name, email, role, createdAt} }
// (docs/l1-1-api.md §1.2). A response without a user object is a contract error.
export function parseLoginData(data: unknown): LoginData | null {
  if (!isRecord(data) || !nonEmptyString(data.token)) return null
  const user = parseUser(data.user)
  return user ? { token: data.token, user } : null
}

export interface OtpSession {
  token: string
  refreshToken: string
  user: AppUser
}

// Shared by POST /api/auth/otp/verify and POST /api/auth/refresh.
export function parseOtpSession(data: unknown): OtpSession | null {
  if (!isRecord(data) || !nonEmptyString(data.token) || !nonEmptyString(data.refreshToken)) return null
  const user = parseUser(data.user)
  return user ? { token: data.token, refreshToken: data.refreshToken, user } : null
}
