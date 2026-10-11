// Single HTTP client used by every screen. No React Native imports so it can
// be unit tested with a fake fetch / fake upload.
import type { ApiConfig } from '../utils/apiConfig'
import {
  UNAUTHORIZED_MESSAGE,
  interpretResponse,
  type ApiFailure,
  type ApiResult,
  type DataParser,
} from './apiResult'
import { decodeJwtClaims, isJwtExpired } from './jwt'

export interface HttpResponseLike {
  status: number
  text(): Promise<string>
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface HttpRequestInit {
  method: HttpMethod
  headers: Record<string, string>
  body?: string
}

export type FetchLike = (url: string, init: HttpRequestInit) => Promise<HttpResponseLike>

export interface UploadFile {
  uri: string
  name: string
  type: string
}

export interface UploadRequest {
  url: string
  headers: Record<string, string>
  file: UploadFile
  fields: Record<string, string>
  onProgress?: (fraction: number) => void
}

// multipart/form-data upload with progress. React Native uses XMLHttpRequest;
// tests and the development mock provide their own implementation.
export type UploadLike = (request: UploadRequest) => Promise<HttpResponseLike>

// 'stored': use the saved session token (default).
// 'none': public endpoint such as login.
// { token }: explicit token, only for the legacy login fallback (authFlow).
export type AuthMode = 'stored' | 'none' | { token: string }

export interface RequestOptions<T> {
  method: HttpMethod
  path: string
  parse: DataParser<T>
  body?: unknown
  auth?: AuthMode
  headers?: Record<string, string>
}

export interface UploadOptions<T> {
  path: string
  file: UploadFile
  fields: Record<string, string>
  parse: DataParser<T>
  onProgress?: (fraction: number) => void
}

export interface HttpClientDeps {
  config: ApiConfig
  fetch: FetchLike
  getToken: () => Promise<string | null>
  onUnauthorized?: () => void | Promise<void>
  upload?: UploadLike
  now?: () => number
}

export interface HttpClient {
  request<T>(options: RequestOptions<T>): Promise<ApiResult<T>>
  upload<T>(options: UploadOptions<T>): Promise<ApiResult<T>>
}

export const NETWORK_ERROR_MESSAGE = 'Сервертэй холбогдож чадсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.'
export const EXPIRED_SESSION_MESSAGE = 'Нэвтрэх хугацаа дууссан. Дахин нэвтэрнэ үү.'

async function readBody(response: HttpResponseLike): Promise<unknown> {
  try {
    const text = await response.text()
    return text === '' ? null : JSON.parse(text)
  } catch {
    return null
  }
}

export function createHttpClient(deps: HttpClientDeps): HttpClient {
  const now = () => (deps.now ?? Date.now)()

  async function endSession(failure: ApiFailure): Promise<ApiFailure> {
    if (deps.onUnauthorized) await deps.onUnauthorized()
    return failure
  }

  // Resolves the token for a request. A stored token that is already past its
  // exp claim is never sent: the session ends locally without a network call.
  async function resolveToken(auth: AuthMode): Promise<{ token: string | null } | { expired: ApiFailure }> {
    if (auth === 'none') return { token: null }
    if (auth !== 'stored') return { token: auth.token }
    const token = await deps.getToken()
    if (token) {
      const claims = decodeJwtClaims(token)
      if (claims && isJwtExpired(claims, now())) {
        return {
          expired: { ok: false, kind: 'unauthorized', code: 'TOKEN_EXPIRED', message: EXPIRED_SESSION_MESSAGE },
        }
      }
    }
    return { token }
  }

  async function finish<T>(
    response: HttpResponseLike,
    parse: DataParser<T>,
    auth: AuthMode,
    token: string | null,
  ): Promise<ApiResult<T>> {
    const result = interpretResponse(response.status, await readBody(response), parse)
    if (result.ok || auth !== 'stored') return result
    if (result.kind === 'unauthorized') return endSession(result)
    // Legacy server (origin/main) answers 403 for an expired token. Only that
    // case ends the session; every other 403 (FORBIDDEN, ROLE_NOT_ALLOWED...)
    // is a permission error and keeps the user signed in.
    if (result.status === 403 && token) {
      const claims = decodeJwtClaims(token)
      if (claims && isJwtExpired(claims, now())) {
        return endSession({ ok: false, kind: 'unauthorized', status: 403, message: UNAUTHORIZED_MESSAGE })
      }
    }
    return result
  }

  return {
    async request<T>(options: RequestOptions<T>): Promise<ApiResult<T>> {
      const { config } = deps
      if (!config.ok) return { ok: false, kind: 'config', message: config.error }

      const auth = options.auth ?? 'stored'
      const resolved = await resolveToken(auth)
      if ('expired' in resolved) return endSession(resolved.expired)
      const { token } = resolved

      const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
      if (options.body !== undefined) headers['Content-Type'] = 'application/json'
      if (token) headers.Authorization = `Bearer ${token}`

      const init: HttpRequestInit = { method: options.method, headers }
      if (options.body !== undefined) init.body = JSON.stringify(options.body)

      let response: HttpResponseLike
      try {
        response = await deps.fetch(`${config.baseUrl}${options.path}`, init)
      } catch {
        return { ok: false, kind: 'network', message: NETWORK_ERROR_MESSAGE }
      }
      return finish(response, options.parse, auth, token)
    },

    async upload<T>(options: UploadOptions<T>): Promise<ApiResult<T>> {
      const { config } = deps
      if (!config.ok) return { ok: false, kind: 'config', message: config.error }
      if (!deps.upload) return { ok: false, kind: 'config', message: 'Файл илгээх боломжгүй тохиргоо.' }

      const resolved = await resolveToken('stored')
      if ('expired' in resolved) return endSession(resolved.expired)
      const { token } = resolved

      const headers: Record<string, string> = { Accept: 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      let response: HttpResponseLike
      try {
        response = await deps.upload({
          url: `${config.baseUrl}${options.path}`,
          headers,
          file: options.file,
          fields: options.fields,
          onProgress: options.onProgress,
        })
      } catch {
        return { ok: false, kind: 'network', message: NETWORK_ERROR_MESSAGE }
      }
      return finish(response, options.parse, 'stored', token)
    },
  }
}
