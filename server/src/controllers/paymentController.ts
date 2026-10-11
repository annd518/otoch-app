import { timingSafeEqual } from 'node:crypto'
import { Request, Response } from 'express'
import { z } from 'zod'
import { Payment } from '@prisma/client'
import prisma from '../db/db.config'
import { ApiError, ok, validationError } from '../utils/http'
import { logError } from '../utils/logger'
import { getCatalogVersion } from '../services/catalog'
import { assertOrderReadyForPricing, computeQuote, loadOwnedOrder } from '../services/orders'
import { isUniqueViolation, readIdempotencyKey } from '../services/idempotency'
import { QPayAdapter, QPayConfigError, currentQPayMode, getQPayAdapter, qpayMock } from '../services/qpay'

interface AuthenticatedRequest extends Request {
    user?: { userId: string; email: string; role: string }
}

const PAYMENT_TTL_MINUTES = 30
const CHECK_THROTTLE_MS = 2_000

const createSchema = z.object({ quoteId: z.string().trim().min(1, 'quoteId шаардлагатай') })

export function serializePayment(p: Payment) {
    return {
        id: p.id,
        provider: p.provider,
        mode: p.mode,
        // mock = in-process fake, never QPay; sandbox = QPay merchant sandbox
        isMock: p.mode === 'mock',
        status: p.status,
        amountMnt: p.amountMnt,
        currency: p.currency,
        qrText: p.qrText,
        qrImageBase64: p.qrImage,
        deeplinks: p.deeplinks ?? [],
        expiresAt: p.expiresAt.toISOString(),
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        failureCode: p.failureCode,
    }
}

function adapterOrUnavailable(): QPayAdapter {
    try {
        return getQPayAdapter()
    } catch (err) {
        if (err instanceof QPayConfigError) {
            throw new ApiError(503, 'PAYMENT_UNAVAILABLE', 'Төлбөрийн үйлчилгээ тохируулагдаагүй байна')
        }
        throw err
    }
}

function callbackUrl(paymentId: string, mode: string) {
    const base = process.env.PUBLIC_BASE_URL
    const secret = process.env.QPAY_CALLBACK_SECRET
    if (mode === 'sandbox' && (!base?.startsWith('https://') || !secret)) {
        throw new ApiError(503, 'PAYMENT_UNAVAILABLE', 'Төлбөрийн callback HTTPS хаяг тохируулагдаагүй байна')
    }
    return `${base ?? 'http://localhost'}/api/payments/qpay/callback/${secret ?? 'mock'}?paymentId=${encodeURIComponent(paymentId)}`
}

// POST /api/orders/:id/payments/qpay  (Idempotency-Key required, body { quoteId })
export const createQPayPayment = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId
    const key = readIdempotencyKey(req, true)!
    const parsed = createSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw validationError(parsed.error)
    const { quoteId } = parsed.data

    const order = await loadOwnedOrder(req.params.id, userId)

    const replay = async () => {
        const existing = await prisma.payment.findUnique({ where: { orderId_idempotencyKey: { orderId: order.id, idempotencyKey: key } } })
        if (!existing) return null
        if (existing.quoteId !== quoteId) {
            throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Энэ Idempotency-Key өөр хүсэлтэд ашиглагдсан байна')
        }
        res.setHeader('Idempotent-Replayed', 'true')
        const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
        return ok(res, { payment: serializePayment(existing), orderStatus: current.status, idempotentReplay: true }, 'Нэхэмжлэх үүссэн байна', 201)
    }
    const replayed = await replay()
    if (replayed) return replayed

    // Same guards as quote, run again: red flag, status, completeness, referral
    assertOrderReadyForPricing(order)

    const quote = await prisma.quote.findFirst({ where: { id: quoteId, orderId: order.id } })
    if (!quote) throw new ApiError(404, 'QUOTE_NOT_FOUND', 'Үнийн санал олдсонгүй')
    if (quote.orderVersion !== order.version) {
        throw new ApiError(409, 'QUOTE_MISMATCH', 'Захиалга үнийн саналаас хойш өөрчлөгдсөн. Шинэ үнийн санал авна уу')
    }
    if (quote.expiresAt <= new Date()) throw new ApiError(409, 'QUOTE_EXPIRED', 'Үнийн саналын хугацаа дууссан. Шинэ санал авна уу')
    const catalogVersion = await getCatalogVersion()
    if (catalogVersion !== quote.catalogVersion) {
        throw new ApiError(409, 'CATALOG_OUTDATED', 'Каталог шинэчлэгдсэн байна. Шинэ үнийн санал авна уу')
    }
    // Amount is always the server's quote, re-derived and compared — never from the client
    const recomputed = computeQuote(order)
    if (recomputed.totalMnt !== quote.totalMnt || quote.currency !== 'MNT') {
        throw new ApiError(409, 'QUOTE_MISMATCH', 'Үнийн дүн зөрж байна. Шинэ үнийн санал авна уу')
    }

    const adapter = adapterOrUnavailable()

    let payment: Payment
    try {
        payment = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT 1 FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`
            const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } })
            if (current.status !== 'DRAFT' || current.version !== order.version) {
                const pending = await tx.payment.findFirst({ where: { orderId: order.id, status: 'PENDING' } })
                if (pending) throw new ApiError(409, 'PAYMENT_IN_PROGRESS', 'Энэ захиалгад төлбөр хүлээгдэж байна', { paymentId: pending.id })
                throw new ApiError(409, 'QUOTE_MISMATCH', 'Захиалга өөрчлөгдсөн байна. Шинэ үнийн санал авна уу')
            }
            const created = await tx.payment.create({
                data: {
                    orderId: order.id, quoteId: quote.id, userId, mode: adapter.mode, idempotencyKey: key,
                    amountMnt: quote.totalMnt, currency: 'MNT',
                    expiresAt: new Date(Date.now() + PAYMENT_TTL_MINUTES * 60_000),
                },
            })
            await tx.order.update({ where: { id: order.id }, data: { status: 'AWAITING_PAYMENT', version: { increment: 1 } } })
            await tx.orderEvent.create({
                data: { orderId: order.id, type: 'PAYMENT_CREATED', fromStatus: 'DRAFT', toStatus: 'AWAITING_PAYMENT', actorId: userId, metadata: { mode: adapter.mode } },
            })
            return created
        })
    } catch (err) {
        if (isUniqueViolation(err)) {
            const again = await replay()
            if (again) return again
        }
        throw err
    }

    try {
        const invoice = await adapter.createInvoice({
            senderInvoiceNo: payment.id,
            amountMnt: payment.amountMnt,
            description: `OTOCH захиалга ${order.id}`,
            callbackUrl: callbackUrl(payment.id, adapter.mode),
        })
        payment = await prisma.payment.update({
            where: { id: payment.id },
            data: { providerInvoiceId: invoice.invoiceId, qrText: invoice.qrText, qrImage: invoice.qrImage, deeplinks: invoice.deeplinks },
        })
    } catch (err) {
        logError('qpay createInvoice', err)
        await prisma.$transaction([
            prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureCode: 'PROVIDER_ERROR' } }),
            prisma.order.updateMany({ where: { id: order.id, status: 'AWAITING_PAYMENT' }, data: { status: 'DRAFT', version: { increment: 1 } } }),
            prisma.orderEvent.create({ data: { orderId: order.id, type: 'PAYMENT_FAILED', fromStatus: 'AWAITING_PAYMENT', toStatus: 'DRAFT' } }),
        ])
        if (err instanceof ApiError) throw err
        throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', 'Төлбөрийн үйлчилгээ түр алдаатай байна. Дахин оролдоно уу')
    }

    return ok(res, { payment: serializePayment(payment), orderStatus: 'AWAITING_PAYMENT', idempotentReplay: false }, 'Нэхэмжлэх үүслээ', 201)
}

/**
 * Confirms a payment ONLY through the provider's payment check (never from callback data).
 * Transitions are conditional (status = PENDING), so duplicate callbacks/polls apply once.
 */
export async function syncPayment(paymentId: string, opts: { force?: boolean } = {}): Promise<Payment> {
    let payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })
    if (payment.status !== 'PENDING') return payment
    if (!opts.force && payment.lastCheckedAt && Date.now() - payment.lastCheckedAt.getTime() < CHECK_THROTTLE_MS) return payment

    const mode = currentQPayMode()
    if (payment.providerInvoiceId && mode === payment.mode) {
        const check = await getQPayAdapter().checkInvoice(payment.providerInvoiceId)
        payment = await prisma.payment.update({ where: { id: payment.id }, data: { lastCheckedAt: new Date() } })
        if (check.paid) {
            const amountOk = check.paidAmountMnt === payment.amountMnt && (check.currency === null || check.currency === 'MNT')
            if (!amountOk) {
                if (payment.failureCode !== 'AMOUNT_MISMATCH') {
                    await prisma.$transaction([
                        prisma.payment.update({ where: { id: payment.id }, data: { failureCode: 'AMOUNT_MISMATCH' } }),
                        prisma.orderEvent.create({ data: { orderId: payment.orderId, type: 'PAYMENT_AMOUNT_MISMATCH' } }),
                    ])
                }
                return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
            }
            await prisma.$transaction(async (tx) => {
                const moved = await tx.payment.updateMany({
                    where: { id: payment.id, status: 'PENDING' },
                    data: { status: 'PAID', paidAt: new Date(), providerPaymentId: check.paymentId, failureCode: null },
                })
                if (moved.count === 1) {
                    await tx.order.updateMany({ where: { id: payment.orderId, status: 'AWAITING_PAYMENT' }, data: { status: 'PAID', version: { increment: 1 } } })
                    await tx.orderEvent.create({ data: { orderId: payment.orderId, type: 'PAYMENT_PAID', fromStatus: 'AWAITING_PAYMENT', toStatus: 'PAID', metadata: { mode: payment.mode } } })
                }
            })
            return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
        }
    }

    if (payment.expiresAt <= new Date()) {
        await prisma.$transaction(async (tx) => {
            const moved = await tx.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'EXPIRED' } })
            if (moved.count === 1) {
                await tx.order.updateMany({ where: { id: payment.orderId, status: 'AWAITING_PAYMENT' }, data: { status: 'DRAFT', version: { increment: 1 } } })
                await tx.orderEvent.create({ data: { orderId: payment.orderId, type: 'PAYMENT_EXPIRED', fromStatus: 'AWAITING_PAYMENT', toStatus: 'DRAFT' } })
            }
        })
        return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
    }
    return payment
}

// GET /api/orders/:id/payments/:paymentId — owner; checks the provider when still pending
export const getPayment = async (req: AuthenticatedRequest, res: Response) => {
    const order = await loadOwnedOrder(req.params.id, req.user!.userId)
    const found = await prisma.payment.findFirst({ where: { id: req.params.paymentId, orderId: order.id } })
    if (!found) throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Төлбөр олдсонгүй')
    let payment = found
    try {
        payment = await syncPayment(found.id)
    } catch (err) {
        logError('qpay check', err)
    }
    const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    return ok(res, { payment: serializePayment(payment), orderStatus: current.status }, 'Төлбөрийн төлөв')
}

const secretMatches = (given: string) => {
    const expected = process.env.QPAY_CALLBACK_SECRET || (currentQPayMode() === 'mock' ? 'mock' : '')
    if (!expected) return false
    const a = Buffer.from(given)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
}

// GET|POST /api/payments/qpay/callback/:secret?paymentId=… — provider → backend (public, no JWT)
export const qpayCallback = async (req: Request, res: Response) => {
    if (!secretMatches(req.params.secret ?? '')) return res.status(404).json({ success: false })
    const paymentId = typeof req.query.paymentId === 'string' ? req.query.paymentId : ''
    if (paymentId) {
        const exists = await prisma.payment.findUnique({ where: { id: paymentId } })
        if (exists) {
            // The callback is only a hint: the provider's payment check decides
            await syncPayment(paymentId, { force: true }).catch((err) => logError('qpay callback check', err))
        }
    }
    // Same response whatever happened (no information for probes)
    return res.status(200).json({ success: true })
}

// POST /api/dev/qpay-mock/orders/:id/payments/:paymentId/pay — dev/test only, mock mode only
export const devMockPay = async (req: AuthenticatedRequest, res: Response) => {
    if (process.env.NODE_ENV === 'production' || currentQPayMode() !== 'mock') {
        throw new ApiError(404, 'NOT_FOUND', 'Хүссэн зам олдсонгүй')
    }
    const order = await loadOwnedOrder(req.params.id, req.user!.userId)
    const payment = await prisma.payment.findFirst({ where: { id: req.params.paymentId, orderId: order.id } })
    if (!payment?.providerInvoiceId) throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Төлбөр олдсонгүй')
    qpayMock.markPaid(payment.providerInvoiceId)
    return ok(res, { mockPaid: true, note: 'MOCK: QPay биш. GET payment-ээр төлөвийг шалгана' }, 'Mock төлбөр тэмдэглэгдлээ')
}
