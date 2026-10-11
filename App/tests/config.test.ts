import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { decodeJwtClaims, isJwtExpired } from '../services/jwt'
import { hostFromHostUri, resolveApiConfig } from '../utils/apiConfig'
import { makeClient, makeJwt } from './helpers'

describe('release builds never fall back to LAN or localhost', () => {
  it('fails without EXPO_PUBLIC_API_URL', () => {
    const config = resolveApiConfig({ isDev: false, platform: 'ios', devHost: '192.168.1.37' })
    assert.equal(config.ok, false)
  })

  it('fails with a plain http URL', () => {
    const config = resolveApiConfig({ isDev: false, platform: 'android', explicitUrl: 'http://staging.example.mn' })
    assert.equal(config.ok, false)
  })

  it('accepts https and normalises a trailing slash or /api', () => {
    const config = resolveApiConfig({ isDev: false, platform: 'ios', explicitUrl: 'https://staging.example.mn/api/' })
    assert.deepEqual(config, {
      ok: true,
      baseUrl: 'https://staging.example.mn',
      mode: 'real',
      source: 'explicit',
      mockRequestIgnored: false,
    })
  })

  it('ignores a mock request in release', () => {
    const config = resolveApiConfig({
      isDev: false,
      platform: 'ios',
      explicitUrl: 'https://staging.example.mn',
      requestedMode: 'mock',
    })
    assert.equal(config.mode, 'real')
    assert.equal(config.mockRequestIgnored, true)
  })

  it('a client with a config error makes no network request', async () => {
    const config = resolveApiConfig({ isDev: false, platform: 'ios' })
    const { client, calls } = makeClient([], { config })
    const result = await client.request({ method: 'GET', path: '/api/parents', parse: () => null })
    assert.equal(result.ok ? '' : result.kind, 'config')
    assert.equal(calls.length, 0)
  })
})

describe('development fallbacks', () => {
  it('uses mock mode only when asked in development', () => {
    assert.equal(resolveApiConfig({ isDev: true, platform: 'ios', requestedMode: 'mock' }).mode, 'mock')
    assert.equal(resolveApiConfig({ isDev: true, platform: 'ios' }).mode, 'real')
  })

  it('derives the LAN host from the Metro host URI', () => {
    const config = resolveApiConfig({ isDev: true, platform: 'ios', devHost: hostFromHostUri('192.168.1.37:8081') })
    assert.equal(config.ok && config.baseUrl, 'http://192.168.1.37:8000')
  })

  it('uses 10.0.2.2 on the Android emulator and localhost on web', () => {
    const android = resolveApiConfig({ isDev: true, platform: 'android', devHost: 'localhost' })
    assert.equal(android.ok && android.baseUrl, 'http://10.0.2.2:8000')
    const web = resolveApiConfig({ isDev: true, platform: 'web', port: '9000' })
    assert.equal(web.ok && web.baseUrl, 'http://localhost:9000')
  })
})

describe('JWT claims', () => {
  it('reads the claims the server signs and detects expiry', () => {
    const claims = decodeJwtClaims(makeJwt({ userId: 'u1', email: 'a@b.mn', role: 'CHILD', exp: 1000 }))
    assert.deepEqual(claims, { userId: 'u1', email: 'a@b.mn', role: 'CHILD', exp: 1000 })
    assert.equal(claims && isJwtExpired(claims, 999_000), false)
    assert.equal(claims && isJwtExpired(claims, 1_000_000), true)
  })

  it('returns null for malformed tokens', () => {
    assert.equal(decodeJwtClaims('not-a-jwt'), null)
    assert.equal(decodeJwtClaims(makeJwt({ email: 'missing-user-id@b.mn' })), null)
  })
})
