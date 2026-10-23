import assert from 'node:assert/strict'
import test from 'node:test'

import { createHttpClient, type FetchLike } from '../services/httpClient'
import { pushTarget, registerPushDevice, unregisterPushDevice } from '../services/push'
import { resolveApiConfig } from '../utils/apiConfig'

const config = resolveApiConfig({ isDev: true, platform: 'ios', explicitUrl: 'http://api.test' })
const TOKEN = 'ExponentPushToken[abcdefghijklmnopqrstuv]'

test('a tapped notification opens the matching screen', () => {
  const order = { type: 'ORDER', orderId: 'o 1' }
  assert.equal(pushTarget(order, 'client'), '/orders/o%201')
  assert.equal(pushTarget({ type: 'OFFER', orderId: 'o1' }, 'client'), null)
  assert.equal(pushTarget(order, 'nurse'), '/orders/o%201')
  assert.equal(pushTarget({ type: 'OFFER', orderId: 'o1' }, 'nurse'), '/')
  assert.equal(pushTarget({ type: 'APPLICATION' }, 'nurse'), '/application')
  assert.equal(pushTarget({ type: 'ORDER' }, 'nurse'), null)
  assert.equal(pushTarget(null, 'nurse'), null)
  assert.equal(pushTarget('x', 'client'), null)
})

test('register and unregister send the token to /api/push/devices', async () => {
  const seen: { url: string; method: string; body: unknown }[] = []
  const fetch: FetchLike = async (url, init) => {
    seen.push({ url, method: init.method, body: JSON.parse(init.body ?? 'null') })
    return { status: 200, text: async () => JSON.stringify({ success: true, message: 'ok', data: null }) }
  }
  const client = createHttpClient({ config, fetch, getToken: async () => null })
  const r = await registerPushDevice(client, { token: TOKEN, app: 'nurse', platform: 'android' })
  assert.equal(r.ok, true)
  assert.deepEqual(seen[0], {
    url: 'http://api.test/api/push/devices',
    method: 'POST',
    body: { token: TOKEN, app: 'nurse', platform: 'android' },
  })
  await unregisterPushDevice(client, TOKEN)
  assert.deepEqual(seen[1], { url: 'http://api.test/api/push/devices', method: 'DELETE', body: { token: TOKEN } })
})
