import type { Session, SessionStore } from '../services/authFlow'
import { createMockBackend } from '../mocks/mockBackend'
import {
  createHttpClient,
  type FetchLike,
  type HttpClient,
  type HttpRequestInit,
  type UploadLike,
} from '../services/httpClient'
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
  options: { token?: string | null; config?: ApiConfig; upload?: UploadLike; fetch?: FetchLike } = {},
): { client: HttpClient; calls: RecordedCall[]; remaining: () => number; unauthorizedCount: () => number } {
  const fake = createFakeFetch(replies)
  let unauthorized = 0
  const client = createHttpClient({
    config: options.config ?? TEST_CONFIG,
    fetch: options.fetch ?? fake.fetch,
    upload: options.upload,
    getToken: async () => options.token ?? null,
    onUnauthorized: () => {
      unauthorized += 1
    },
  })
  return { client, calls: fake.calls, remaining: fake.remaining, unauthorizedCount: () => unauthorized }
}

export const VALID_TOKEN = makeJwt({ userId: 'u_child_1', email: 'child@test.mn', role: 'CHILD', exp: 4102444800 })

// Client wired to the development mock backend, with timers removed.
export function makeMockClient(scenario = '') {
  const backend = createMockBackend({ scenario, sleep: async () => {} })
  let fetchCount = 0
  const countingFetch: FetchLike = (url, init) => {
    fetchCount += 1
    return backend.fetch(url, init)
  }
  const harness = makeClient([], { token: VALID_TOKEN, fetch: countingFetch, upload: backend.upload })
  return { ...harness, fetchCount: () => fetchCount }
}

// Unsigned test JWT with the same claims the server signs (authController.ts).
export function makeJwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.test-signature`
}
