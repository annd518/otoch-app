import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { API_PATHS } from '../config/api'
import { endpointForPath, pathOfUrl, resolveMockedEndpoints } from '../services/endpoints'
import { parseParentList } from '../services/validators'
import { makeClient, makeJwt } from './helpers'

describe('per-endpoint mock selection', () => {
  it('release builds never mock anything', () => {
    assert.equal(resolveMockedEndpoints({ isDev: false, mode: 'mock', list: 'orders' }).size, 0)
  })

  it('a list mocks exactly those endpoints; invalid names are ignored', () => {
    assert.deepEqual([...resolveMockedEndpoints({ isDev: true, mode: 'real', list: 'orders, redFlags,bogus' })].sort(), [
      'orders',
      'redFlags',
    ])
  })

  it('mock mode without a list mocks all mockable endpoints; real mode mocks none', () => {
    assert.equal(resolveMockedEndpoints({ isDev: true, mode: 'mock' }).size, 6)
    assert.equal(resolveMockedEndpoints({ isDev: true, mode: 'real' }).size, 0)
  })

  it('routes paths to endpoints; auth, parents and visits are never mockable', () => {
    assert.equal(endpointForPath(pathOfUrl('http://h:8000/api/catalog/services?x=1')), 'catalog')
    assert.equal(endpointForPath('/api/orders'), 'orders')
    assert.equal(endpointForPath('/api/orders/o1'), 'orders')
    assert.equal(endpointForPath('/api/orders/o1/cancel'), 'orders')
    assert.equal(endpointForPath('/api/orders/o1/red-flag-questions'), 'redFlags')
    assert.equal(endpointForPath('/api/orders/o1/attachments/a1'), 'attachments')
    assert.equal(endpointForPath('/api/orders/o1/quote'), 'quote')
    assert.equal(endpointForPath('/api/orders/o1/payments/qpay'), 'payments')
    assert.equal(endpointForPath('/api/orders/o1/payments/pay_1'), 'payments')
    assert.equal(endpointForPath('/api/auth/login'), null)
    assert.equal(endpointForPath('/api/parents'), null)
    assert.equal(endpointForPath('/api/visits'), null)
  })
})

describe('session handling: 401 vs expired vs forbidden', () => {
  it('an expired stored token is never sent; the session ends locally', async () => {
    const expired = makeJwt({ userId: 'u1', role: 'CHILD', exp: 1 })
    const { client, calls, unauthorizedCount } = makeClient([], { token: expired })
    const r = await client.request({ method: 'GET', path: API_PATHS.parents.list, parse: parseParentList })
    assert.equal(calls.length, 0)
    assert.equal(r.ok ? '' : r.code, 'TOKEN_EXPIRED')
    assert.equal(unauthorizedCount(), 1)
  })

  it('401 UNAUTHENTICATED ends the session', async () => {
    const valid = makeJwt({ userId: 'u1', role: 'CHILD', exp: 4102444800 })
    const { client, unauthorizedCount } = makeClient(
      [{ status: 401, body: { success: false, message: 'Нэвтрэх шаардлагатай', error: { code: 'UNAUTHENTICATED' } } }],
      { token: valid },
    )
    const r = await client.request({ method: 'GET', path: API_PATHS.parents.list, parse: parseParentList })
    assert.equal(r.ok ? '' : r.kind, 'unauthorized')
    assert.equal(unauthorizedCount(), 1)
  })

  it('403 FORBIDDEN and ROLE_NOT_ALLOWED keep the user signed in', async () => {
    const valid = makeJwt({ userId: 'u1', role: 'CHILD', exp: 4102444800 })
    for (const code of ['FORBIDDEN', 'ROLE_NOT_ALLOWED']) {
      const { client, unauthorizedCount } = makeClient(
        [{ status: 403, body: { success: false, message: 'Хандах эрхгүй', error: { code } } }],
        { token: valid },
      )
      const r = await client.request({ method: 'GET', path: API_PATHS.parents.list, parse: parseParentList })
      assert.equal(r.ok ? '' : r.status, 403)
      assert.equal(unauthorizedCount(), 0)
    }
  })
})
