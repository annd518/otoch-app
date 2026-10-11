import { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { ApiError, fail, zodFields } from '../utils/http'
import { logError } from '../utils/logger'

export const notFoundHandler = (req: Request, res: Response) => {
    fail(res, 404, 'NOT_FOUND', 'Хүссэн зам олдсонгүй')
}

// Express 5 forwards rejected async handlers here as well
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
        return fail(res, err.status, err.code, err.message, err.fields)
    }
    if (err instanceof ZodError) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Оруулсан мэдээлэл буруу байна', zodFields(err))
    }
    const e = err as { type?: string; status?: number; code?: string }
    // body-parser: malformed JSON / payload too large
    if (e?.type === 'entity.parse.failed') {
        return fail(res, 400, 'INVALID_JSON', 'JSON хэлбэр буруу байна')
    }
    if (e?.status === 413) {
        return fail(res, 413, 'VALIDATION_ERROR', 'Хүсэлт хэт том байна')
    }
    // Prisma: table/column missing (e.g. migration not applied yet)
    if (e?.code === 'P2021' || e?.code === 'P2022') {
        logError(`${req.method} ${req.path}`, err)
        return fail(res, 503, 'SERVICE_UNAVAILABLE', 'Үйлчилгээ түр ажиллахгүй байна. Дараа дахин оролдоно уу')
    }
    // Prisma: foreign key / unique constraint (e.g. deleting a parent that has visits)
    if (e?.code === 'P2003' || e?.code === 'P2002') {
        return fail(res, 409, 'CONFLICT', 'Холбоотой өгөгдөл байгаа тул үйлдлийг гүйцэтгэх боломжгүй')
    }
    logError(`${req.method} ${req.path}`, err)
    return fail(res, 500, 'INTERNAL_ERROR', 'Серверийн алдаа гарлаа. Дахин оролдоно уу')
}
