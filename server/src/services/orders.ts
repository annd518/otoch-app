import { Prisma } from '@prisma/client'
import prisma from '../db/db.config'
import { ApiError, FieldErrors } from '../utils/http'
import { getStorage } from './storage'

/**
 * Draft order domain helpers. Order is a PROPOSED separate model (docs/l1-1-api.md D2);
 * the legacy Visit flow is not touched.
 */

// Placeholder shown when an order is blocked. Not medical advice; must be replaced by
// clinician-approved text (docs/l1-1-api.md D4).
export const RED_FLAG_BLOCK_ADVICE = {
    text: 'Туршилтын мэдэгдэл: таны хариултын улмаас энэ захиалгыг үргэлжлүүлэх боломжгүй. (Эмнэлзүйн бичвэр батлагдаагүй)',
    isFixture: true,
}

export const MAX_ATTACHMENTS = 5
export const QUOTE_TTL_MINUTES = 15
// Pricing rule identifier: catalog list price × quantity. No travel fee, discount or VAT
// because none of them are approved (docs/l1-1-api.md D3).
export const PRICING_VERSION = 'LIST_PRICE_ONLY_V1'
export const PRICE_EXCLUDES = ['TRAVEL_FEE', 'DISCOUNT', 'VAT'] as const

export const orderInclude = {
    items: { include: { service: true }, orderBy: { serviceCode: 'asc' } },
    attachments: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } },
    quotes: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.OrderInclude

export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>
type QuoteRow = OrderWithItems['quotes'][number]

/** Loads an order owned by the user. Foreign and missing orders look identical (404). */
export async function loadOwnedOrder(orderId: string, userId: string): Promise<OrderWithItems> {
    const order = await prisma.order.findFirst({ where: { id: orderId, childId: userId }, include: orderInclude })
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Захиалга олдсонгүй')
    return order
}

/** Questionnaire codes required by the order's services (sorted, unique). */
export function questionnairesFor(order: OrderWithItems): string[] {
    return [...new Set(order.items.map((i) => i.service.questionnaire).filter((q): q is string => !!q))].sort()
}

export const requiresReferral = (order: OrderWithItems) => order.items.some((i) => i.service.requiresReferral)
const hasReferral = (order: OrderWithItems) => order.attachments.some((a) => a.kind === 'REFERRAL')

/** A quote is usable only for the exact order version it was made for, and before it expires. */
export function isQuoteValid(quote: QuoteRow | undefined, order: { version: number }, now = new Date()): quote is QuoteRow {
    return !!quote && quote.orderVersion === order.version && quote.expiresAt > now
}

export function serializeQuote(q: QuoteRow) {
    return {
        id: q.id,
        orderVersion: q.orderVersion,
        catalogVersion: q.catalogVersion,
        pricingVersion: q.pricingVersion,
        currency: q.currency,
        lines: q.lines,
        subtotalMnt: q.subtotalMnt,
        // 0 = not included in this quote (no approved fee/discount rule yet, see `excludes`)
        travelFeeMnt: 0,
        discountMnt: 0,
        totalMnt: q.totalMnt,
        excludes: PRICE_EXCLUDES,
        isFixture: q.isFixture,
        expiresAt: q.expiresAt.toISOString(),
        // A quote is a price snapshot only — never a payment or an order confirmation
        isPayment: false,
    }
}

export function serializeAttachment(a: OrderWithItems['attachments'][number]) {
    return { id: a.id, kind: a.kind, mimeType: a.mimeType, sizeBytes: a.sizeBytes, createdAt: a.createdAt.toISOString() }
}

/** API shape. Only fields the server actually stores are returned. */
export function serializeOrder(order: OrderWithItems) {
    const questionnaires = questionnairesFor(order)
    const redFlagRequired = questionnaires.length > 0
    const latestQuote = order.quotes[0]
    return {
        id: order.id,
        status: order.status,
        version: order.version,
        parentId: order.parentId,
        catalogVersion: order.catalogVersion,
        items: order.items.map((i) => ({
            serviceCode: i.serviceCode,
            name: i.service.name,
            quantity: i.quantity,
            requiresReferral: i.service.requiresReferral,
            isFixture: i.service.isFixture,
        })),
        scheduledFor: order.scheduledFor ? order.scheduledFor.toISOString() : null,
        timeSlot: order.timeSlot,
        address: order.addressText ? { text: order.addressText, lat: order.lat, lng: order.lng } : null,
        notes: order.notes,
        redFlag: {
            status: order.redFlagStatus,
            required: redFlagRequired,
            questionnaires,
            answeredAt: order.redFlagAnsweredAt ? order.redFlagAnsweredAt.toISOString() : null,
        },
        attachments: order.attachments.map(serializeAttachment),
        requirements: {
            redFlagAnswers: redFlagRequired && order.redFlagStatus !== 'CLEAR',
            referralAttachment: requiresReferral(order) && !hasReferral(order),
            referralUploadAvailable: getStorage() !== null,
        },
        // Only a quote that still matches this exact order version is returned
        quote: isQuoteValid(latestQuote, order) ? serializeQuote(latestQuote) : null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
    }
}

/**
 * Server-side guard for anything that moves an order towards payment
 * (quote, payment invoice). Must be called again at every such step,
 * so the red flag check cannot be skipped by calling a later endpoint directly.
 */
export function assertOrderReadyForPricing(order: OrderWithItems, now = new Date()) {
    if (order.status === 'BLOCKED_RED_FLAG' || order.redFlagStatus === 'FLAGGED') {
        throw new ApiError(422, 'RED_FLAG_BLOCKED', 'Энэ захиалга аюулын шинжийн асуулгаар хаагдсан тул үргэлжлэх боломжгүй')
    }
    if (order.status !== 'DRAFT') {
        throw new ApiError(409, 'ORDER_NOT_EDITABLE', `Захиалгын төлөв (${order.status}) энэ үйлдлийг зөвшөөрөхгүй`)
    }
    if (questionnairesFor(order).length > 0 && order.redFlagStatus !== 'CLEAR') {
        throw new ApiError(422, 'RED_FLAG_REQUIRED', 'Эхлээд аюулын шинжийн асуулгад хариулна уу')
    }

    const fields: FieldErrors = {}
    if (!order.scheduledFor) fields.scheduledFor = 'Огноо, цагаа сонгоно уу'
    else if (order.scheduledFor.getTime() <= now.getTime()) fields.scheduledFor = 'Ирээдүйн огноо сонгоно уу'
    if (!order.addressText) fields.address = 'Хаягаа оруулна уу'
    if (order.items.some((i) => !i.service.isActive)) fields.items = 'Идэвхгүй болсон үйлчилгээ байна'
    if (Object.keys(fields).length) {
        throw new ApiError(422, 'ORDER_INCOMPLETE', 'Захиалгын мэдээлэл дутуу байна', fields)
    }

    if (requiresReferral(order) && !hasReferral(order)) {
        throw new ApiError(422, 'REFERRAL_REQUIRED', 'Энэ үйлчилгээнд эмчийн заалтын зураг шаардлагатай')
    }
}

/**
 * Fixture prices and unapproved (fixture) red flag questions are demo data.
 * In NODE_ENV=production they are refused unless ALLOW_FIXTURE_DATA=true is set explicitly
 * (a staging deployment that knowingly runs on fixtures). Never set it for real customers.
 */
export const fixtureDataAllowed = () =>
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_FIXTURE_DATA === 'true'

export async function assertNoFixtureDataInProduction(order: OrderWithItems) {
    if (fixtureDataAllowed()) return
    const fixturePrice = order.items.some((i) => i.service.isFixture)
    const questionnaires = questionnairesFor(order)
    const fixtureQuestions = questionnaires.length > 0
        && (await prisma.redFlagQuestion.count({ where: { questionnaire: { in: questionnaires }, isFixture: true } })) > 0
    if (fixturePrice || fixtureQuestions) {
        throw new ApiError(503, 'FIXTURE_DATA_NOT_ALLOWED', 'Үнэ эсвэл аюулын шинжийн асуулга батлагдаагүй байгаа тул захиалга түр боломжгүй')
    }
}

/** Server-side price from the current catalog. Integer MNT only. */
export function computeQuote(order: OrderWithItems) {
    const lines = order.items.map((i) => {
        if (!Number.isInteger(i.service.priceMnt) || i.service.priceMnt < 0) {
            throw new ApiError(500, 'INTERNAL_ERROR', 'Каталогийн үнэ буруу байна')
        }
        return {
            type: 'SERVICE',
            serviceCode: i.serviceCode,
            name: i.service.name,
            quantity: i.quantity,
            unitPriceMnt: i.service.priceMnt,
            amountMnt: i.service.priceMnt * i.quantity,
            isFixture: i.service.isFixture,
        }
    })
    const subtotalMnt = lines.reduce((sum, l) => sum + l.amountMnt, 0)
    if (!Number.isSafeInteger(subtotalMnt)) throw new ApiError(500, 'INTERNAL_ERROR', 'Үнийн дүн хэт их байна')
    return {
        lines,
        subtotalMnt,
        totalMnt: subtotalMnt,
        isFixture: lines.some((l) => l.isFixture),
    }
}
