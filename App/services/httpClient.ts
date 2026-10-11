// Single HTTP client used by every screen. No React Native imports so it can
// be unit tested with a fake fetch.
import type { ApiConfig } from '../utils/apiConfig'
import { UNAUTHORIZED_MESSAGE, interpretResponse, type ApiResult, type DataParser } from './apiResult'
import { decodeJwtClaims, isJwtExpired } from './jwt'

export interface HttpResponseLike {
  status: number
  text(): Promise<string>
}

export interface HttpRequestInit {
  method: HttpMethod
  headers: Record<string, string>
  body?: string
}

export type FetchLike = (url: string, init: HttpRequestInit) => Promise<HttpResponseLike>

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// 'stored': use the saved session token (default).
// 'none': public endpoint such as login.
// { token }: explicit token, used right after login before the session is saved.
export type AuthMode = 'stored' | 'none' | { token: string }

export interface RequestOptions<T> {
  method: HttpMethod
  path: string
  parse: DataParser<T>
  body?: unknown
  auth?: AuthMode
}

export interface HttpClientDeps {
  config: ApiConfig
  fetch: FetchLike
  getToken: () => Promise<string | null>
  onUnauthorized?: () => void | Promise<void>
  now?: () => number
}

export interface HttpClient {
  request<T>(options: RequestOptions<T>): Promise<ApiResult<T>>
}

export const NETWORK_ERROR_MESSAGE = 'Сервертэй холбогдож чадсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.'

export function createHttpClient(deps: HttpClientDeps): HttpClient {
  return {
    async request<T>(options: RequestOptions<T>): Promise<ApiResult<T>> {
      const { config } = deps
      if (!config.ok) {
        return { ok: false, kind: 'config', message: config.error }
      }

      const auth = options.auth ?? 'stored'
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (options.body !== undefined) headers['Content-Type'] = 'application/json'

      let token: string | null = null
      if (auth === 'stored') token = await deps.getToken()
      else if (auth !== 'none') token = auth.token
      if (token) headers.Authorization = `Bearer ${token}`

      const init: HttpRequestInit = { method: options.method, headers }
      if (options.body !== undefined) init.body = JSON.stringify(options.body)

      let response: HttpResponseLike
      try {
        response = await deps.fetch(`${config.baseUrl}${options.path}`, init)
      } catch {
        return { ok: false, kind: 'network', message: NETWORK_ERROR_MESSAGE }
      }

      let body: unknown = null
      try {
        const text = await response.text()
        body = text === '' ? null : JSON.parse(text)
      } catch {
        body = null
      }

      let result = interpretResponse(response.status, body, options.parse)
      // The server answers 403 (not 401) for an expired token. Treat a 403 on a
      // request made with an expired stored token as the end of the session.
      if (!result.ok && result.status === 403 && auth === 'stored' && token) {
        const claims = decodeJwtClaims(token)
        if (claims && isJwtExpired(claims, (deps.now ?? Date.now)())) {
          result = { ok: false, kind: 'unauthorized', status: 403, message: UNAUTHORIZED_MESSAGE }
        }
      }
      if (!result.ok && result.kind === 'unauthorized' && auth === 'stored' && deps.onUnauthorized) {
        await deps.onUnauthorized()
      }
      return result
    },
  }
}
