import type { Session, SessionStore } from '../services/authFlow'
import { createHttpClient, type FetchLike, type HttpClient, type HttpRequestInit } from '../services/httpClient'
import type { ApiConfig } from '../utils/apiConfig'

export interface RecordedCall {
  url: string
  init: HttpRequestInit
}

export type FakeReply = { status: number; body?: unknown } | { networkError: true }

// Fake fetch that replays queued replies and fails the test on any extra request.
export function createFakeFetch(replies: FakeReply[]) {
  const queue = [...replies]
  const calls: RecordedCall[] = []
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init })
    const reply = queue.shift()
    if (!reply) throw new Error(`Unexpected request: ${init.method} ${url}`)
    if ('networkError' in reply) throw new TypeError('Network request failed')
    const text = reply.body === undefined ? '' : JSON.stringify(reply.body)
    return { status: reply.status, text: async () => text }
  }
  return { fetch, calls, remaining: () => queue.length }
}

export function createMemoryStore(initial: Session | null = null) {
  let session = initial
  const store: SessionStore & { current(): Session | null } = {
    async saveSession(next) {
      session = next
    },
    async clearSession() {
      session = null
    },
    current: () => session,
  }
  return store
}

export const TEST_CONFIG: ApiConfig = {
  ok: true,
  baseUrl: 'http://api.test',
  mode: 'real',
  source: 'explicit',
  mockRequestIgnored: false,
}

export function makeClient(
  replies: FakeReply[],
  options: { token?: string | null; config?: ApiConfig } = {},
): { client: HttpClient; calls: RecordedCall[]; remaining: () => number; unauthorizedCount: () => number } {
  const fake = createFakeFetch(replies)
  let unauthorized = 0
  const client = createHttpClient({
    config: options.config ?? TEST_CONFIG,
    fetch: fake.fetch,
    getToken: async () => options.token ?? null,
    onUnauthorized: () => {
      unauthorized += 1
    },
  })
  return { client, calls: fake.calls, remaining: fake.remaining, unauthorizedCount: () => unauthorized }
}

// Unsigned test JWT with the same claims the server signs (authController.ts).
export function makeJwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.test-signature`
}
