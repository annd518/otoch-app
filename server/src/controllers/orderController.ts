import { Request, Response } from 'express'
import { z } from 'zod'
import prisma from '../db/db.config'
import { ApiError, FieldErrors, ok, validationError } from '../utils/http'
import { getCatalogVersion } from '../services/catalog'
import {
    PRICING_VERSION,
    QUOTE_TTL_MINUTES,
    RED_FLAG_BLOCK_ADVICE,
    assertOrderReadyForPricing,
    computeQuote,
    loadOwnedOrder,
    orderInclude,
    questionnairesFor,
    serializeOrder,
    serializeQuote,
} from '../services/orders'
import { findReplay, hashPayload, isUniqueViolation, purgeExpiredKey, readIdempotencyKey, recordKey } from '../services/idempotency'

interface AuthenticatedRequest extends Request {
    user?: { userId: string; email: string; role: string }
}

const MAX_DAYS_AHEAD = 90

const itemSchema = z.object({
    serviceCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,59}$/, 'Үйлчилгээний код буруу байна'),
    quantity: z.number().int().min(1, 'Тоо хэмжээ 1-3').max(3, 'Тоо хэмжээ 1-3').default(1),
})

const itemsSchema = z.array(itemSchema)
    .min(1, 'Хамгийн багадаа нэг үйлчилгээ сонгоно уу')
    .max(5, 'Хамгийн ихдээ 5 үйлчилгээ')
    .refine((items) => new Set(items.map((i) => i.serviceCode)).size === items.length, 'Ижил үйлчилгээ давхардсан байна')

const scheduledForSchema = z.string()
    .datetime({ offset: true, message: 'Огноо ISO-8601 хэлбэртэй байна (жишээ: 2026-10-20T09:00:00+08:00)' })
    .refine((v) => new Date(v).getTime() > Date.now(), 'Ирээдүйн огноо сонгоно уу')
    .refine((v) => new Date(v).getTime() <= Date.now() + MAX_DAYS_AHEAD * 86_400_000, `${MAX_DAYS_AHEAD} хоногоос хэтрэхгүй огноо сонгоно уу`)

const timeSlotSchema = z.string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/, 'Цагийн хэлбэр HH:MM-HH:MM')
    .refine((v) => v.slice(0, 5) < v.slice(6), 'Эхлэх цаг дуусах цагаас өмнө байна')

const addressSchema = z.object({
    text: z.string().trim().min(5, 'Хаяг хамгийн багадаа 5 тэмдэгт').max(300, 'Хаяг хэт урт байна'),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
})

const DRAFT_FIELDS = ['parentId', 'items', 'scheduledFor', 'timeSlot', 'address', 'notes', 'catalogVersion'] as const

const createSchema = z.object({
    parentId: z.string().trim().min(1, 'Эцэг/эхийг сонгоно уу'),
    items: itemsSchema,
    scheduledFor: scheduledForSchema.optional(),
    timeSlot: timeSlotSchema.optional(),
    address: addressSchema.optional(),
    notes: z.string().trim().max(500, 'Тэмдэглэл 500 тэмдэгтээс хэтрэхгүй').optional(),
    catalogVersion: z.string().optional(),
})

const updateSchema = z.object({
    version: z.number({ message: 'version шаардлагатай' }).int().min(1),
    items: itemsSchema.optional(),
    scheduledFor: scheduledForSchema.nullable().optional(),
    timeSlot: timeSlotSchema.nullable().optional(),
    address: addressSchema.nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    catalogVersion: z.string().optional(),
})

const answersSchema = z.object({
    // Questionnaire codes the client rendered; must match the server's current set
    questionnaires: z.array(z.string()).optional(),
    answers: z.array(z.object({
        questionId: z.string().min(1),
        value: z.boolean({ message: 'Хариулт нь true/false байна' }),
    })).min(1, 'Хариулт хоосон байна'),
})

const listSchema = z.object({
    status: z.enum(['DRAFT', 'BLOCKED_RED_FLAG', 'AWAITING_PAYMENT', 'PAID', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED']).optional(),
})

/** Top-level body keys the server does not store (reported, never echoed back as saved) */
function ignoredFields(body: unknown, allowed: readonly string[]): string[] {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return []
    return Object.keys(body).filter((k) => !allowed.includes(k)).sort()
}

/** Resolves service codes against the ACTIVE catalog. */
async function resolveItems(items: { serviceCode: string; quantity: number }[]) {
    const services = await prisma.serviceCatalogItem.findMany({
        where: { code: { in: items.map((i) => i.serviceCode) }, isActive: true },
    })
    const byCode = new Map(services.map((s) => [s.code, s]))
    const fields: FieldErrors = {}
    items.forEach((item, idx) => {
        if (!byCode.has(item.serviceCode)) fields[`items.${idx}.serviceCode`] = 'Үйлчилгээ олдсонгүй эсвэл идэвхгүй'
    })
    if (Object.keys(fields).length) throw new ApiError(400, 'VALIDATION_ERROR', 'Оруулсан мэдээлэл буруу байна', fields)
    return items.map((i) => ({ serviceId: byCode.get(i.serviceCode)!.id, serviceCode: i.serviceCode, quantity: i.quantity }))
}

async function assertCatalogVersion(clientVersion: string | undefined) {
    const current = await getCatalogVersion()
    if (!current) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Каталог хоосон байна')
    if (clientVersion !== undefined && clientVersion !== current) {
        throw new ApiError(409, 'CATALOG_OUTDATED', 'Каталог шинэчлэгдсэн байна. Каталогоо дахин ачаална уу')
    }
    return current
}

const addressData = (address: z.infer<typeof addressSchema> | null | undefined) =>
    address === undefined ? {} : address === null
        ? { addressText: null, lat: null, lng: null }
        : { addressText: address.text, lat: address.lat ?? null, lng: address.lng ?? null }

// POST /api/orders — create a draft
export const createDraftOrder = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = createSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw validationError(parsed.error)
    const body = parsed.data
    const userId = req.user!.userId

    // Idempotency-Key (optional for backward compatibility; mobile always sends one)
    const key = readIdempotencyKey(req)
    const scope = 'orders.create'
    const requestHash = hashPayload(req.body)
    const replay = async () => {
        const row = key && (await findReplay(userId, scope, key, requestHash))
        if (!row) return null
        const existing = await loadOwnedOrder(row.resourceId, userId)
        res.setHeader('Idempotent-Replayed', 'true')
        return ok(res, { order: serializeOrder(existing), ignoredFields: ignoredFields(req.body, DRAFT_FIELDS), idempotentReplay: true }, 'Ноорог үүссэн байна', 201)
    }
    if (key) {
        await purgeExpiredKey(userId, scope, key)
        const replayed = await replay()
        if (replayed) return replayed
    }

    const parent = await prisma.parent.findFirst({ where: { id: body.parentId, children: { some: { id: userId } } } })
    if (!parent) throw new ApiError(404, 'PARENT_NOT_FOUND', 'Эцэг/эх олдсонгүй эсвэл хандах эрхгүй', { parentId: 'Олдсонгүй' })

    const catalogVersion = await assertCatalogVersion(body.catalogVersion)
    const items = await resolveItems(body.items)

    let order
    try {
        // Order + idempotency record commit together; a concurrent duplicate key
        // blocks on the unique index and then fails, so only one order survives.
        order = await prisma.$transaction(async (tx) => {
            const created = await tx.order.create({
                data: {
                    childId: userId,
                    parentId: body.parentId,
                    catalogVersion,
                    scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
                    timeSlot: body.timeSlot ?? null,
                    notes: body.notes ?? null,
                    ...addressData(body.address),
                    items: { create: items },
                },
            })
            if (key) await recordKey(tx, { userId, scope, key, requestHash, resourceType: 'Order', resourceId: created.id })
            await tx.orderEvent.create({ data: { orderId: created.id, type: 'CREATED', toStatus: 'DRAFT', actorId: userId } })
            return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: orderInclude })
        })
    } catch (err) {
        if (key && isUniqueViolation(err)) {
            const replayed = await replay()
            if (replayed) return replayed
        }
        throw err
    }

    return ok(res, { order: serializeOrder(order), ignoredFields: ignoredFields(req.body, DRAFT_FIELDS), idempotentReplay: false }, 'Ноорог үүслээ', 201)
}

// GET /api/orders — own orders
export const listOrders = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = listSchema.safeParse(req.query)
    if (!parsed.success) throw validationError(parsed.error)
    const orders = await prisma.order.findMany({
        where: { childId: req.user!.userId, ...(parsed.data.status && { status: parsed.data.status }) },
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        take: 20,
    })
    return ok(res, { orders: orders.map(serializeOrder) }, 'Захиалгууд')
}

// GET /api/orders/:id
export const getOrder = async (req: AuthenticatedRequest, res: Response) => {
    const order = await loadOwnedOrder(req.params.id, req.user!.userId)
    return ok(res, { order: serializeOrder(order) }, 'Захиалга')
}

// PATCH /api/orders/:id — update own DRAFT (optimistic locking via version)
export const updateDraftOrder = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = updateSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw validationError(parsed.error)
    const body = parsed.data
    const userId = req.user!.userId

    const current = await loadOwnedOrder(req.params.id, userId)
    if (current.status === 'BLOCKED_RED_FLAG') {
        throw new ApiError(409, 'RED_FLAG_BLOCKED', 'Энэ захиалга аюулын шинжийн асуулгаар хаагдсан тул засах боломжгүй')
    }
    if (current.status !== 'DRAFT') throw new ApiError(409, 'ORDER_NOT_EDITABLE', 'Зөвхөн ноорог захиалгыг засна')
    if (current.version !== body.version) {
        throw new ApiError(409, 'VERSION_CONFLICT', 'Захиалга өөр газар өөрчлөгдсөн байна. Дахин ачаална уу')
    }

    const itemsChanged = body.items !== undefined
    const catalogVersion = itemsChanged ? await assertCatalogVersion(body.catalogVersion) : undefined
    const items = itemsChanged ? await resolveItems(body.items!) : undefined

    const order = await prisma.$transaction(async (tx) => {
        // Only a DRAFT at the expected version is updated (guards races)
        const updated = await tx.order.updateMany({
            where: { id: current.id, version: body.version, status: 'DRAFT' },
            data: {
                version: { increment: 1 },
                ...(body.scheduledFor !== undefined && { scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null }),
                ...(body.timeSlot !== undefined && { timeSlot: body.timeSlot }),
                ...(body.notes !== undefined && { notes: body.notes }),
                ...addressData(body.address),
                // New services may need a different questionnaire: answers must be given again
                ...(itemsChanged && { catalogVersion, redFlagStatus: 'NOT_ANSWERED' as const, redFlagAnsweredAt: null }),
            },
        })
        if (updated.count === 0) throw new ApiError(409, 'VERSION_CONFLICT', 'Захиалга өөр газар өөрчлөгдсөн байна. Дахин ачаална уу')

        if (itemsChanged) {
            await tx.orderItem.deleteMany({ where: { orderId: current.id } })
            await tx.orderItem.createMany({ data: items!.map((i) => ({ ...i, orderId: current.id })) })
            await tx.redFlagAnswer.deleteMany({ where: { orderId: current.id } })
        }
        await tx.orderEvent.create({
            data: { orderId: current.id, type: itemsChanged ? 'UPDATED_ITEMS_RED_FLAG_RESET' : 'UPDATED', actorId: userId },
        })
        return tx.order.findUniqueOrThrow({ where: { id: current.id }, include: orderInclude })
    })

    return ok(res, { order: serializeOrder(order), ignoredFields: ignoredFields(req.body, ['version', ...DRAFT_FIELDS]) }, 'Ноорог шинэчлэгдлээ')
}

async function activeQuestionsFor(questionnaires: string[]) {
    if (!questionnaires.length) return []
    const questions = await prisma.redFlagQuestion.findMany({
        where: { questionnaire: { in: questionnaires }, isActive: true },
        orderBy: [{ questionnaire: 'asc' }, { sortOrder: 'asc' }],
    })
    const covered = new Set(questions.map((q) => q.questionnaire))
    if (questionnaires.some((q) => !covered.has(q))) {
        throw new ApiError(503, 'QUESTIONNAIRE_UNAVAILABLE', 'Асуулга түр ашиглах боломжгүй байна')
    }
    return questions
}

// GET /api/orders/:id/red-flag-questions
export const getRedFlagQuestions = async (req: AuthenticatedRequest, res: Response) => {
    const order = await loadOwnedOrder(req.params.id, req.user!.userId)
    const questionnaires = questionnairesFor(order)
    const questions = await activeQuestionsFor(questionnaires)
    return ok(res, {
        orderId: order.id,
        orderStatus: order.status,
        redFlag: { status: order.redFlagStatus },
        questionnaires,
        // false while any question is placeholder/fixture text (no clinician-approved content yet)
        approved: questions.length > 0 && questions.every((q) => !q.isFixture),
        containsFixtures: questions.some((q) => q.isFixture),
        questions: questions.map((q) => ({
            id: q.id, questionnaire: q.questionnaire, code: q.code, text: q.text,
            isFixture: q.isFixture, approved: !q.isFixture,
        })),
    }, 'Асуулга')
}

/**
 * PUT /api/orders/:id/red-flag-answers
 *  - Any "true" for a question of this order blocks the order immediately, even if
 *    other answers are missing or malformed (early "yes" is never lost).
 *  - CLEAR requires every current question answered, all false, valid ids,
 *    and (if sent) the current questionnaire set.
 */
export const putRedFlagAnswers = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = answersSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw validationError(parsed.error)
    const { answers, questionnaires: clientQuestionnaires } = parsed.data
    const userId = req.user!.userId

    const order = await loadOwnedOrder(req.params.id, userId)
    // Once blocked, new answers can never unblock the order
    if (order.status === 'BLOCKED_RED_FLAG' || order.redFlagStatus === 'FLAGGED') {
        throw new ApiError(409, 'RED_FLAG_BLOCKED', 'Энэ захиалга аюулын шинжийн асуулгаар хаагдсан. Хариултыг өөрчлөх боломжгүй')
    }
    if (order.status !== 'DRAFT') throw new ApiError(409, 'ORDER_NOT_EDITABLE', 'Зөвхөн ноорог захиалгад хариулна')

    const questionnaires = questionnairesFor(order)
    const questions = await activeQuestionsFor(questionnaires)
    const byId = new Map(questions.map((q) => [q.id, q]))

    // 1) Early positive: block on any "yes" to a real question of this order
    const positives = answers.filter((a) => a.value === true && byId.has(a.questionId))
    if (positives.length) {
        // Store only well-formed answers for this order's questions (one per question; "yes" wins)
        const stored = new Map<string, boolean>()
        for (const a of answers) if (byId.has(a.questionId)) stored.set(a.questionId, stored.get(a.questionId) === true || a.value)
        const updated = await writeAnswers(order.id, order.status, userId, stored, true)
        return ok(res, {
            redFlag: { status: updated.redFlagStatus, answeredAt: updated.redFlagAnsweredAt?.toISOString() ?? null },
            orderStatus: updated.status,
            version: updated.version,
            advice: RED_FLAG_BLOCK_ADVICE,
        }, 'Захиалгыг үргэлжлүүлэх боломжгүй')
    }

    // 2) No positive: everything must be valid and complete to become CLEAR
    if (clientQuestionnaires && [...new Set(clientQuestionnaires)].sort().join(',') !== questionnaires.join(',')) {
        throw new ApiError(409, 'QUESTIONNAIRE_OUTDATED', 'Асуулга шинэчлэгдсэн байна. Асуултуудыг дахин ачаална уу')
    }
    const fields: FieldErrors = {}
    const seen = new Set<string>()
    answers.forEach((a, idx) => {
        if (!byId.has(a.questionId)) fields[`answers.${idx}.questionId`] = 'Энэ захиалгын асуулт биш'
        else if (seen.has(a.questionId)) fields[`answers.${idx}.questionId`] = 'Давхардсан хариулт'
        seen.add(a.questionId)
    })
    if (Object.keys(fields).length) throw new ApiError(400, 'VALIDATION_ERROR', 'Оруулсан мэдээлэл буруу байна', fields)

    const missing = questions.filter((q) => !seen.has(q.id))
    if (missing.length) {
        throw new ApiError(400, 'RED_FLAG_INCOMPLETE', 'Бүх асуултад хариулна уу',
            Object.fromEntries(missing.map((q) => [q.id, 'Хариулаагүй'])))
    }

    const updated = await writeAnswers(order.id, order.status, userId, new Map(answers.map((a) => [a.questionId, false])), false)
    return ok(res, {
        redFlag: { status: updated.redFlagStatus, answeredAt: updated.redFlagAnsweredAt?.toISOString() ?? null },
        orderStatus: updated.status,
        version: updated.version,
    }, 'Хариулт хадгалагдлаа')
}

async function writeAnswers(orderId: string, fromStatus: string, userId: string, answers: Map<string, boolean>, flagged: boolean) {
    const now = new Date()
    return prisma.$transaction(async (tx) => {
        const res = await tx.order.updateMany({
            where: { id: orderId, status: 'DRAFT', redFlagStatus: { not: 'FLAGGED' } },
            data: {
                version: { increment: 1 },
                redFlagStatus: flagged ? 'FLAGGED' : 'CLEAR',
                redFlagAnsweredAt: now,
                ...(flagged && { status: 'BLOCKED_RED_FLAG' as const }),
            },
        })
        if (res.count === 0) {
            const current = await tx.order.findUnique({ where: { id: orderId } })
            if (current?.redFlagStatus === 'FLAGGED') {
                throw new ApiError(409, 'RED_FLAG_BLOCKED', 'Энэ захиалга аюулын шинжийн асуулгаар хаагдсан. Хариултыг өөрчлөх боломжгүй')
            }
            throw new ApiError(409, 'ORDER_NOT_EDITABLE', 'Захиалгын төлөв өөрчлөгдсөн байна. Дахин ачаална уу')
        }
        await tx.redFlagAnswer.deleteMany({ where: { orderId } })
        await tx.redFlagAnswer.createMany({
            data: [...answers].map(([questionId, value]) => ({ orderId, questionId, value })),
        })
        // Audit: outcome only — never which question was answered "yes"
        await tx.orderEvent.create({
            data: {
                orderId,
                type: flagged ? 'RED_FLAG_FLAGGED' : 'RED_FLAG_CLEAR',
                fromStatus,
                toStatus: flagged ? 'BLOCKED_RED_FLAG' : fromStatus,
                actorId: userId,
            },
        })
        return tx.order.findUniqueOrThrow({ where: { id: orderId } })
    })
}

const quoteSchema = z.object({
    orderVersion: z.number({ message: 'orderVersion шаардлагатай' }).int().min(1),
})

/**
 * POST /api/orders/:id/quote — server-side price for the exact current order version.
 * A quote is a price snapshot; it is not a payment and does not confirm the order.
 */
export const requestQuote = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = quoteSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw validationError(parsed.error)

    const order = await loadOwnedOrder(req.params.id, req.user!.userId)
    if (order.version !== parsed.data.orderVersion) {
        throw new ApiError(409, 'VERSION_CONFLICT', 'Захиалга өөрчлөгдсөн байна. Дахин ачаална уу')
    }
    assertOrderReadyForPricing(order)

    const catalogVersion = await getCatalogVersion()
    if (!catalogVersion || catalogVersion !== order.catalogVersion) {
        throw new ApiError(409, 'CATALOG_OUTDATED', 'Каталог шинэчлэгдсэн байна. Үйлчилгээгээ дахин сонгоно уу')
    }

    const price = computeQuote(order)
    const quote = await prisma.$transaction(async (tx) => {
        // Re-check the version inside the transaction so a concurrent edit cannot be priced
        const still = await tx.order.count({ where: { id: order.id, version: order.version, status: 'DRAFT' } })
        if (!still) throw new ApiError(409, 'VERSION_CONFLICT', 'Захиалга өөрчлөгдсөн байна. Дахин ачаална уу')
        const created = await tx.quote.create({
            data: {
                orderId: order.id,
                orderVersion: order.version,
                catalogVersion,
                pricingVersion: PRICING_VERSION,
                currency: 'MNT',
                lines: price.lines,
                subtotalMnt: price.subtotalMnt,
                totalMnt: price.totalMnt,
                isFixture: price.isFixture,
                expiresAt: new Date(Date.now() + QUOTE_TTL_MINUTES * 60_000),
            },
        })
        await tx.orderEvent.create({ data: { orderId: order.id, type: 'QUOTED', actorId: req.user!.userId } })
        return created
    })

    return ok(res, { quote: serializeQuote(quote), orderStatus: order.status }, 'Үнийн санал (төлбөр биш)', 201)
}
