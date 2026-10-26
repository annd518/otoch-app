// Push notification device registration (server/src/routes/push.ts) and where a
// tapped notification leads. Pure: no React Native imports, so it is unit tested.
import type { ApiResult } from './apiResult'
import type { HttpClient } from './httpClient'

export type PushApp = 'client' | 'nurse'

export function registerPushDevice(
  client: HttpClient,
  device: { token: string; app: PushApp; platform: 'ios' | 'android' },
): Promise<ApiResult<true>> {
  return client.request({ method: 'POST', path: '/api/push/devices', body: device, parse: () => true as const })
}

export function unregisterPushDevice(client: HttpClient, token: string): Promise<ApiResult<true>> {
  return client.request({ method: 'DELETE', path: '/api/push/devices', body: { token }, parse: () => true as const })
}

/** The screen a tapped notification opens, from the data the server sent (services/push.ts). */
export function pushTarget(data: unknown, app: PushApp): string | null {
  if (!data || typeof data !== 'object') return null
  const { type, orderId } = data as { type?: unknown; orderId?: unknown }
  const order = typeof orderId === 'string' && orderId !== '' ? `/orders/${encodeURIComponent(orderId)}` : null
  if (app === 'client') return type === 'ORDER' ? order : null
  if (type === 'OFFER') return '/'
  if (type === 'ORDER') return order
  if (type === 'APPLICATION') return '/application'
  if (type === 'EARNINGS') return '/earnings'
  return null
}
