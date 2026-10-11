import prisma from '../db/db.config'

/**
 * Catalog version = latest updatedAt of the active catalog rows (ISO string),
 * or null when the catalog is empty. Changes whenever any active row changes.
 */
export async function getCatalogVersion(): Promise<string | null> {
    const latest = await prisma.serviceCatalogItem.aggregate({
        where: { isActive: true },
        _max: { updatedAt: true },
    })
    return latest._max.updatedAt ? latest._max.updatedAt.toISOString() : null
}
