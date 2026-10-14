import { strict as assert } from 'node:assert'
import { it } from 'node:test'
import { getQPayAdapter } from '../src/services/qpay'

it('refreshes epoch-expiry tokens and rejects missing tokens before invoice creation', async () => {
    const originalEnv = { ...process.env }
    const originalFetch = globalThis.fetch
    const originalNow = Date.now
    let now = 1_790_000_000_000
    let authCalls = 0
    let invoiceCalls = 0
    let missingToken = false
    try {
        Object.assign(process.env, { NODE_ENV: 'test', QPAY_MODE: 'sandbox', QPAY_BASE_URL: 'https://example.invalid', QPAY_USERNAME: 'fixture', QPAY_PASSWORD: 'fixture', QPAY_INVOICE_CODE: 'fixture' })
        Date.now = () => now
        globalThis.fetch = async (url) => {
            if (String(url).endsWith('/auth/token')) {
                authCalls++
                return Response.json(missingToken ? {} : { access_token: 'synthetic-token', expires_in: now / 1000 + 60 })
            }
            invoiceCalls++
            return Response.json({ invoice_id: 'synthetic-invoice', qr_text: 'synthetic-qr' })
        }
        const adapter = getQPayAdapter()
        const input = { senderInvoiceNo: 'test', amountMnt: 100, description: 'test', callbackUrl: 'https://example.invalid/callback' }
        await adapter.createInvoice(input)
        await adapter.createInvoice(input)
        assert.equal(authCalls, 1)
        now += 61_000
        await adapter.createInvoice(input)
        assert.equal(authCalls, 2)
        missingToken = true
        now += 61_000
        await assert.rejects(adapter.createInvoice(input))
        assert.equal(invoiceCalls, 3)
    } finally {
        globalThis.fetch = originalFetch
        Date.now = originalNow
        for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]
        Object.assign(process.env, originalEnv)
    }
})
