import { Response } from 'express'
import { ZodError } from 'zod'

/**
 * Unified API response contract (docs/l1-1-api.md §0.1):
 *   success → { success: true,  message, data }
 *   failure → { success: false, message, error: { code, fields? } }
 * `message` is for people (Mongolian), `error.code` is for program logic.
 */

export type ErrorCode =
    | 'VALIDATION_ERROR'
    | 'INVALID_JSON'
    | 'UNAUTHENTICATED'
    | 'INVALID_CREDENTIALS'
    | 'FORBIDDEN'
    | 'ROLE_NOT_ALLOWED'
    | 'NOT_FOUND'
    | 'PARENT_NOT_FOUND'
    | 'VISIT_NOT_FOUND'
    | 'NURSE_NOT_FOUND'
    | 'USER_NOT_FOUND'
    | 'EMAIL_TAKEN'
    | 'INVALID_STATUS'
    | 'CONFLICT'
    | 'SERVICE_UNAVAILABLE'
    | 'INTERNAL_ERROR'

export type FieldErrors = Record<string, string>

export class ApiError extends Error {
    constructor(
        public status: number,
        public code: ErrorCode,
        message: string,
        public fields?: FieldErrors
    ) {
        super(message)
        this.name = 'ApiError'
    }
}

export const ok = <T>(res: Response, data: T, message: string, status = 200) =>
    res.status(status).json({ success: true, message, data })

export const fail = (res: Response, status: number, code: ErrorCode, message: string, fields?: FieldErrors) =>
    res.status(status).json({ success: false, message, error: fields ? { code, fields } : { code } })

/** Flatten a ZodError into { "field.path": "first message" } */
export const zodFields = (error: ZodError): FieldErrors => {
    const fields: FieldErrors = {}
    for (const issue of error.issues) {
        const key = issue.path.length ? issue.path.join('.') : '_'
        if (!fields[key]) fields[key] = issue.message
    }
    return fields
}

export const validationError = (error: ZodError) =>
    new ApiError(400, 'VALIDATION_ERROR', 'Оруулсан мэдээлэл буруу байна', zodFields(error))
