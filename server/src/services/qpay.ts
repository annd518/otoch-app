import { randomUUID } from 'node:crypto'

/**
 * QPay adapter. Credentials live only in backend env.
 *
 * QPAY_MODE:
 *  - mock     (default outside production): in-process fake. NOT QPay. Never reports itself as sandbox.
 *  - sandbox: QPay merchant sandbox over HTTPS. Implemented from QPay's public v2 API description;
 *             UNVERIFIED until sandbox credentials are available (docs/l1-1-api.md D5).
 *  - production: refused — real-money payments are out of scope for L1-1.
 */
export type QPayMode = 'mock' | 'sandbox'

export interface CreateInvoiceInput {
    senderInvoiceNo: string
    amountMnt: number
    description: string
    callbackUrl: string
}

export interface Invoice {
    invoiceId: string
    qrText: string
    qrImage: string | null
    deeplinks: { name: string; link: string; logo?: string }[]
}

export interface PaymentCheck {
    paid: boolean
    paymentId: string | null
    paidAmountMnt: number | null
    currency: string | null
}

export interface QPayAdapter {
    mode: QPayMode
    createInvoice(input: CreateInvoiceInput): Promise<Invoice>
    checkInvoice(invoiceId: string): Promise<PaymentCheck>
}

export class QPayConfigError extends Error {}

/**
 * Provider failure.
 * definite = the provider certainly did not create anything (request never sent, or a 4xx rejection).
 * Otherwise (timeout, network error, 5xx, unreadable answer) the invoice MAY exist at the provider.
 */
export class QPayProviderError extends Error {
    constructor(message: string, public definite: boolean) {
        super(message)
        this.name = 'QPayProviderError'
    }
}

// ---------------- mock ----------------
interface MockInvoice { amountMnt: number; paid: boolean; paymentId: string | null; paidAmountMnt: number | null }
const mockInvoices = new Map<string, MockInvoice>()
let mockNextCreateFailure: 'rejected' | 'timeout' | null = null

export const qpayMock = {
    /**
     * Test helper: make the next createInvoice fail.
     * 'timeout' still creates the invoice at the "provider" (the answer is lost), like a real timeout can.
     */
    failNextCreate(kind: 'rejected' | 'timeout') { mockNextCreateFailure = kind },
    lastInvoiceId: () => [...mockInvoices.keys()].pop() ?? null,
    /** Test/dev helper: simulate the customer paying (optionally a wrong amount). */
    markPaid(invoiceId: string, amountMnt?: number) {
        const inv = mockInvoices.get(invoiceId)
        if (!inv) return false
        inv.paid = true
        inv.paymentId = inv.paymentId ?? `MOCK-PAY-${randomUUID()}`
        inv.paidAmountMnt = amountMnt ?? inv.amountMnt
        return true
    },
    has: (invoiceId: string) => mockInvoices.has(invoiceId),
}

const mockAdapter: QPayAdapter = {
    mode: 'mock',
    async createInvoice(input) {
        const failure = mockNextCreateFailure
        mockNextCreateFailure = null
        if (failure === 'rejected') throw new QPayProviderError('mock invoice rejected', true)
        const invoiceId = `MOCK-INV-${randomUUID()}`
        mockInvoices.set(invoiceId, { amountMnt: input.amountMnt, paid: false, paymentId: null, paidAmountMnt: null })
        if (failure === 'timeout') throw new QPayProviderError('mock invoice timeout', false)
        return {
            invoiceId,
            qrText: `MOCK_QR_NOT_PAYABLE:${invoiceId}`,
            qrImage: null,
            deeplinks: [],
        }
    },
    async checkInvoice(invoiceId) {
        const inv = mockInvoices.get(invoiceId)
        if (!inv?.paid) return { paid: false, paymentId: null, paidAmountMnt: null, currency: null }
        return { paid: true, paymentId: inv.paymentId, paidAmountMnt: inv.paidAmountMnt, currency: 'MNT' }
    },
}

// ---------------- sandbox (unverified) ----------------
function sandboxAdapter(): QPayAdapter {
    const base = process.env.QPAY_BASE_URL
    const username = process.env.QPAY_USERNAME
    const password = process.env.QPAY_PASSWORD
    const invoiceCode = process.env.QPAY_INVOICE_CODE
    if (!base || !username || !password || !invoiceCode) {
        throw new QPayConfigError('QPAY_BASE_URL, QPAY_USERNAME, QPAY_PASSWORD, QPAY_INVOICE_CODE are required for sandbox mode')
    }
    if (!base.startsWith('https://')) throw new QPayConfigError('QPAY_BASE_URL must be HTTPS')

    let token: { value: string; expiresAt: number } | null = null
    const call = async (pathname: string, body: unknown, auth: string) => {
        let res: globalThis.Response
        try {
            res = await fetch(`${base}${pathname}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: auth },
                body: JSON.stringify(body ?? {}),
                signal: AbortSignal.timeout(10_000),
            })
        } catch {
            // timeout / network: the request may have reached the provider
            throw new QPayProviderError(`qpay ${pathname} no response`, false)
        }
        if (!res.ok) {
            const rejected = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429
            throw new QPayProviderError(`qpay ${pathname} http ${res.status}`, rejected)
        }
        try {
            return (await res.json()) as any
        } catch {
            throw new QPayProviderError(`qpay ${pathname} unreadable response`, false)
        }
    }
    const bearer = async () => {
        if (token && token.expiresAt > Date.now() + 30_000) return `Bearer ${token.value}`
        const basic = Buffer.from(`${username}:${password}`).toString('base64')
        const data = await call('/v2/auth/token', {}, `Basic ${basic}`)
        if (typeof data.access_token !== 'string' || !data.access_token) {
            throw new QPayProviderError('qpay auth without access_token', true)
        }
        // QPay sandbox returns expires_in as a Unix timestamp in seconds.
        // Also accept a duration for provider versions using OAuth-style expiry.
        const expiry = Number(data.expires_in)
        const expiresAt = Number.isFinite(expiry) && expiry > 0
            ? (expiry >= 1_000_000_000 ? expiry * 1000 : Date.now() + expiry * 1000)
            : Date.now() + 3600 * 1000
        token = { value: data.access_token, expiresAt }
        return `Bearer ${token.value}`
    }
    return {
        mode: 'sandbox',
        async createInvoice(input) {
            let auth: string
            try {
                auth = await bearer()
            } catch {
                // no invoice request was sent
                throw new QPayProviderError('qpay auth failed', true)
            }
            const data = await call('/v2/invoice', {
                invoice_code: invoiceCode,
                sender_invoice_no: input.senderInvoiceNo,
                invoice_receiver_code: 'terminal',
                invoice_description: input.description,
                amount: input.amountMnt,
                callback_url: input.callbackUrl,
            }, auth)
            if (data?.invoice_id === undefined || data?.invoice_id === null) {
                throw new QPayProviderError('qpay invoice without invoice_id', false)
            }
            return {
                invoiceId: String(data.invoice_id),
                qrText: String(data.qr_text ?? ''),
                qrImage: data.qr_image ?? null,
                deeplinks: Array.isArray(data.urls) ? data.urls.map((u: any) => ({ name: u.name, link: u.link, logo: u.logo })) : [],
            }
        },
        async checkInvoice(invoiceId) {
            const data = await call('/v2/payment/check', {
                object_type: 'INVOICE', object_id: invoiceId, offset: { page_number: 1, page_limit: 100 },
            }, await bearer())
            const paidRow = Array.isArray(data.rows) ? data.rows.find((r: any) => r.payment_status === 'PAID') : null
            if (!paidRow) return { paid: false, paymentId: null, paidAmountMnt: null, currency: null }
            return {
                paid: true,
                paymentId: String(paidRow.payment_id),
                paidAmountMnt: Number(paidRow.payment_amount),
                currency: paidRow.payment_currency ? String(paidRow.payment_currency) : null,
            }
        },
    }
}

export function currentQPayMode(): QPayMode | 'production' | 'invalid' {
    const raw = process.env.QPAY_MODE || (process.env.NODE_ENV === 'production' ? '' : 'mock')
    if (raw === 'mock' || raw === 'sandbox') return raw
    if (raw === 'production') return 'production'
    return 'invalid'
}

/** Returns the adapter for the configured mode, or throws QPayConfigError. */
export function getQPayAdapter(): QPayAdapter {
    const mode = currentQPayMode()
    if (mode === 'mock') {
        if (process.env.NODE_ENV === 'production') throw new QPayConfigError('mock QPay is not allowed in production')
        return mockAdapter
    }
    if (mode === 'sandbox') return sandboxAdapter()
    if (mode === 'production') throw new QPayConfigError('QPay production mode is disabled for L1-1')
    throw new QPayConfigError('QPAY_MODE is not configured')
}
