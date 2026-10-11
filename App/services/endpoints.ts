// Endpoints that have a development mock. Mocks exist only for endpoints that
// the backend has not implemented (or has implemented only on a branch).
//
// Selection (development builds only, release builds never mock):
// - EXPO_PUBLIC_MOCK_ENDPOINTS="attachments,quote,payments" mocks exactly those.
// - EXPO_PUBLIC_API_MODE=mock without the list mocks all of them.

export const MOCKABLE_ENDPOINTS = ['catalog', 'orders', 'redFlags', 'attachments', 'quote', 'payments'] as const
export type MockableEndpoint = (typeof MOCKABLE_ENDPOINTS)[number]

function isMockable(value: string): value is MockableEndpoint {
  return (MOCKABLE_ENDPOINTS as readonly string[]).includes(value)
}

export function resolveMockedEndpoints(input: {
  isDev: boolean
  mode: 'real' | 'mock'
  list?: string
}): Set<MockableEndpoint> {
  if (!input.isDev) return new Set()
  const requested = (input.list ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(isMockable)
  if (requested.length > 0) return new Set(requested)
  return input.mode === 'mock' ? new Set(MOCKABLE_ENDPOINTS) : new Set()
}

// "http://host:8000/api/orders/abc/red-flag-answers?x=1" -> "/api/orders/abc/red-flag-answers"
export function pathOfUrl(url: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/[^/]+(\/[^?#]*)?/i.exec(url)
  return match?.[1] ?? '/'
}

export function endpointForPath(path: string): MockableEndpoint | null {
  if (path === '/api/catalog/services') return 'catalog'
  if (/^\/api\/orders\/[^/]+\/red-flag-(questions|answers)$/.test(path)) return 'redFlags'
  if (/^\/api\/orders\/[^/]+\/attachments(\/.*)?$/.test(path)) return 'attachments'
  if (/^\/api\/orders\/[^/]+\/quote$/.test(path)) return 'quote'
  if (/^\/api\/orders\/[^/]+\/payments(\/.*)?$/.test(path)) return 'payments'
  if (/^\/api\/orders(\/[^/]+(\/cancel)?)?$/.test(path)) return 'orders'
  return null
}
