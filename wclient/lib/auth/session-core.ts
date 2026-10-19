/**
 * Pure auth/session helpers (no browser APIs) so they can be unit tested.
 *
 * Login/signup contract (docs/l1-1-api.md §1.1):
 *   data.token = JWT string
 *   data.user  = { id, name, email, role, createdAt }  (never a password/hash)
 * Older servers returned the JWT string in data.user; that is rejected here.
 */

export const USER_ROLES = ['CHILD', 'NURSE', 'MEDICAL_ADMIN', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Session {
  token: string;
  user: SessionUser;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const isUserRole = (v: unknown): v is UserRole =>
  typeof v === 'string' && (USER_ROLES as readonly string[]).includes(v);

/** Validates a user object; drops any extra fields (e.g. createdAt). */
export function parseSessionUser(value: unknown): SessionUser | null {
  if (!isRecord(value)) return null;
  const { id, name, email, role } = value;
  if (typeof id !== 'string' || !id || typeof name !== 'string' || typeof email !== 'string' || !email || !isUserRole(role)) {
    return null;
  }
  return { id, name, email, role };
}

/** Reads the JWT payload WITHOUT verifying it (the server verifies every request). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, nowMs: number = Date.now()): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  return typeof payload.exp === 'number' && payload.exp * 1000 <= nowMs;
}

/**
 * Builds a session from the login/signup `data` object.
 * Returns null when the response does not match the contract, including the
 * legacy shape where data.user was a JWT string, or when the user object
 * disagrees with the token's claims.
 */
export function sessionFromAuthData(data: unknown): Session | null {
  if (!isRecord(data) || typeof data.token !== 'string' || data.token.split('.').length !== 3) return null;
  const user = parseSessionUser(data.user);
  if (!user) return null;
  const claims = decodeJwtPayload(data.token);
  if (!claims || claims.userId !== user.id || claims.role !== user.role) return null;
  return { token: data.token, user };
}

/**
 * The web is the admin panel: only the super-admin (ADMIN) uses it. Nurses
 * work in the OTOCH Nurse app, customers in the OTOCH app.
 */
export const canUseWeb = (role: UserRole): boolean => role === 'ADMIN';

export const WEB_ROLE_REFUSED =
  'Энэ вэб зөвхөн супер админд зориулагдсан. Сувилагч OTOCH Nurse апп, үйлчлүүлэгч OTOCH апп ашиглана.';

/** Where a web user lands after login. */
export function homePathForRole(role: UserRole): string {
  return canUseWeb(role) ? '/dashboard/admin' : '/auth/login';
}
