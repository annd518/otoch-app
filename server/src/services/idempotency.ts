import { createHash } from 'node:crypto'
import { Request } from 'express'
import { Prisma } from '@prisma/client'
import prisma from '../db/db.config'
import { ApiError } from '../utils/http'

/**
 * Idempotency-Key support (docs/l1-1-api.md §0.3).
 * Scope = user + operation (+ order). Keys are kept for IDEMPOTENCY_TTL_HOURS.
 * The DB unique constraint (userId, scope, key) is the real guard: concurrent
 * duplicates race on it and the loser replays the winner's result.
 */
export const IDEMPOTENCY_TTL_HOURS = 24
const KEY_PATTERN = /^[A-Za-z0-9_\-:.]{8,128}$/

export function readIdempotencyKey(req: Request, required = false): string | null {
    const raw = req.header('Idempotency-Key')
    if (raw === undefined || raw === '') {
        if (required) throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header шаардлагатай')
        return null
    }
    if (!KEY_PATTERN.test(raw)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Idempotency-Key буруу байна', {
            'Idempotency-Key': '8-128 тэмдэгт: A-Z a-z 0-9 _ - : .',
        })
    }
    return raw
}

/** Stable JSON (sorted keys) so the same payload always hashes the same way */
function canonical(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
    if (value && typeof value === 'object') {
        return `{${Object.keys(value as object).sort()
            .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`
    }
    return JSON.stringify(value ?? null)
}

export const hashPayload = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex')

/** Removes this key's expired record so the key can be reused after the retention window */
export async function purgeExpiredKey(userId: string, scope: string, key: string) {
    await prisma.idempotencyKey.deleteMany({ where: { userId, scope, key, expiresAt: { lt: new Date() } } })
}

/**
 * Returns the stored resource id for a previously completed request, or null.
 * Same key + different payload => 409 IDEMPOTENCY_KEY_REUSED.
 */
export async function findReplay(userId: string, scope: string, key: string, requestHash: string) {
    const row = await prisma.idempotencyKey.findUnique({ where: { userId_scope_key: { userId, scope, key } } })
    if (!row || row.expiresAt < new Date()) return null
    if (row.requestHash !== requestHash) {
        throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Энэ Idempotency-Key өөр хүсэлтэд ашиглагдсан байна. Шинэ key үүсгэнэ үү')
    }
    return row
}

export function recordKey(
    tx: Prisma.TransactionClient,
    data: { userId: string; scope: string; key: string; requestHash: string; resourceType: string; resourceId: string }
) {
    return tx.idempotencyKey.create({
        data: { ...data, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 3_600_000) },
    })
}

export const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === 'P2002'
