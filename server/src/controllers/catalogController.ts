import { Request, Response } from 'express'
import { z } from 'zod'
import prisma from '../db/db.config'
import { ok, validationError } from '../utils/http'

const querySchema = z.object({
    category: z.string().trim().regex(/^[A-Z_]{2,40}$/, 'Ангиллын код буруу байна').optional()
})

// GET /api/catalog/services — contract: docs/l1-1-api.md §2
export const listCatalogServices = async (req: Request, res: Response) => {
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) throw validationError(parsed.error)

    const items = await prisma.serviceCatalogItem.findMany({
        where: { isActive: true, ...(parsed.data.category && { category: parsed.data.category }) },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }]
    })

    // Changes whenever any active row changes, so clients can cache by it
    const latest = items.reduce<Date | null>((max, i) => (!max || i.updatedAt > max ? i.updatedAt : max), null)

    const services = items.map((i) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        description: i.description,
        category: i.category,
        priceMnt: i.priceMnt,
        durationMin: i.durationMin,
        requiresReferral: i.requiresReferral,
        redFlagQuestionnaire: i.questionnaire,
        isActive: i.isActive,
        isFixture: i.isFixture
    }))

    return ok(res, {
        catalogVersion: latest ? latest.toISOString() : null,
        currency: 'MNT',
        containsFixtures: services.some((s) => s.isFixture),
        services
    }, 'Каталог')
}
