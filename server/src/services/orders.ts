import { Prisma } from '@prisma/client'
import prisma from '../db/db.config'
import { ApiError, FieldErrors } from '../utils/http'

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

export const orderInclude = {
    items: { include: { service: true }, orderBy: { serviceCode: 'asc' } },
} satisfies Prisma.OrderInclude

export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>

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

/** API shape. Only fields the server actually stores are returned. */
export function serializeOrder(order: OrderWithItems) {
    const questionnaires = questionnairesFor(order)
    const redFlagRequired = questionnaires.length > 0
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
        requirements: {
            redFlagAnswers: redFlagRequired && order.redFlagStatus !== 'CLEAR',
            referralAttachment: requiresReferral(order),
            // Private upload is not implemented yet (docs/l1-1-api.md §5)
            referralUploadAvailable: false,
        },
        // Server pricing is not implemented yet; never a fake quote
        quote: null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
    }
}

/**
 * Server-side guard for anything that moves an order towards payment
 * (quote now; payment/submit later). Must be called again at every such step,
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

    if (requiresReferral(order)) {
        throw new ApiError(422, 'REFERRAL_REQUIRED', 'Энэ үйлчилгээнд эмчийн заалтын зураг шаардлагатай. Зураг илгээх боломж хараахан нээгдээгүй байна')
    }
}
