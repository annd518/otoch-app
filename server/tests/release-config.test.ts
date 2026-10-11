// Release config regressions: a production deploy must never fall back to mock payments,
// dev/test storage or demo accounts by accident. Pure checks, no database.
import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { QPayConfigError, currentQPayMode, getQPayAdapter } from '../src/services/qpay'
import { getStorage } from '../src/services/storage'
import { fixtureDataAllowed } from '../src/services/orders'

const saved = { ...process.env }
afterEach(() => { process.env = { ...saved } })

const env = (vars: Record<string, string | undefined>) => {
    for (const [k, v] of Object.entries(vars)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
    }
}

describe('production config refuses dev/test fallbacks', () => {
    it('QPay: no implicit mock in production; explicit mock and production mode are refused', () => {
        env({ NODE_ENV: 'production', QPAY_MODE: undefined })
        assert.equal(currentQPayMode(), 'invalid')
        assert.throws(() => getQPayAdapter(), QPayConfigError)
        env({ QPAY_MODE: 'mock' })
        assert.throws(() => getQPayAdapter(), QPayConfigError)
        env({ QPAY_MODE: 'production' })
        assert.throws(() => getQPayAdapter(), QPayConfigError)
    })

    it('QPay sandbox: incomplete credentials or plain HTTP are refused', () => {
        env({ NODE_ENV: 'production', QPAY_MODE: 'sandbox', QPAY_BASE_URL: undefined, QPAY_USERNAME: undefined, QPAY_PASSWORD: undefined, QPAY_INVOICE_CODE: undefined })
        assert.throws(() => getQPayAdapter(), QPayConfigError)
        env({ QPAY_BASE_URL: 'http://example.invalid', QPAY_USERNAME: 'u', QPAY_PASSWORD: 'p', QPAY_INVOICE_CODE: 'c' })
        assert.throws(() => getQPayAdapter(), QPayConfigError)
    })

    it('storage: memory and local-dev are never used in production; s3 is not implemented (null → 503)', () => {
        for (const driver of [undefined, '', 'memory', 'local-dev', 's3']) {
            env({ NODE_ENV: 'production', STORAGE_DRIVER: driver })
            assert.equal(getStorage(), null, `STORAGE_DRIVER=${driver}`)
        }
        env({ NODE_ENV: 'development', STORAGE_DRIVER: 'memory' })
        assert.equal(getStorage(), null) // memory is test-only
    })

    it('fixture data: allowed outside production; in production only with explicit ALLOW_FIXTURE_DATA=true', () => {
        env({ NODE_ENV: 'development', ALLOW_FIXTURE_DATA: undefined })
        assert.equal(fixtureDataAllowed(), true)
        for (const v of [undefined, '', 'false', '1', 'TRUE']) {
            env({ NODE_ENV: 'production', ALLOW_FIXTURE_DATA: v })
            assert.equal(fixtureDataAllowed(), false, `ALLOW_FIXTURE_DATA=${v}`)
        }
        env({ ALLOW_FIXTURE_DATA: 'true' })
        assert.equal(fixtureDataAllowed(), true)
        const seed = readFileSync(path.resolve(process.cwd(), 'prisma/seed.ts'), 'utf8')
        assert.ok(seed.indexOf("ALLOW_FIXTURE_DATA !== 'true'") < seed.indexOf('await seedCatalogFixtures()'), 'production seed checks the flag before fixtures')
    })

    it('seed: production gets fixtures only, never the demo accounts', () => {
        const seed = readFileSync(path.resolve(process.cwd(), 'prisma/seed.ts'), 'utf8') // tests run from server/
        const guard = seed.indexOf('if (isProduction)')
        const demo = seed.indexOf('for (const u of demoUsers)')
        assert.ok(guard > 0 && demo > guard, 'production guard must return before demo users are written')
    })
})
