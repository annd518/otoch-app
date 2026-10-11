/**
 * Minimal logger that never prints request bodies, tokens, passwords or
 * health data. Prisma error messages embed query arguments (which can contain
 * patient data), so for Prisma errors only the name/code/model are logged.
 */
const isProduction = () => process.env.NODE_ENV === 'production'

export function logError(context: string, err: unknown) {
    const e = err as { name?: string; code?: string; message?: string; meta?: { modelName?: string } }
    const isPrisma = typeof e?.name === 'string' && e.name.startsWith('PrismaClient')
    const entry: Record<string, unknown> = {
        level: 'error',
        context,
        name: e?.name ?? typeof err,
        code: e?.code,
        model: e?.meta?.modelName,
    }
    if (!isProduction() && !isPrisma && e?.message) entry.message = e.message
    console.error(JSON.stringify(entry))
}
