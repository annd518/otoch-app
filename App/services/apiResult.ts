// Turns an HTTP status + JSON body into a typed result.
// The server sometimes answers HTTP 200 with only { message } on errors,
// so success requires body.success === true AND valid data, not just 2xx.

export type ApiFailureKind =
  | 'network'
  | 'http'
  | 'rejected'
  | 'contract'
  | 'unauthorized'
  | 'not_implemented'
  | 'config'

export interface ApiSuccess<T> {
  ok: true
  data: T
  message?: string
}

export interface ApiFailure {
  ok: false
  kind: ApiFailureKind
  message: string
  status?: number
  code?: string
  fields?: Record<string, string>
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export type DataParser<T> = (data: unknown) => T | null

export const DEFAULT_ERROR_MESSAGE = 'Алдаа гарлаа. Дахин оролдоно уу.'
export const CONTRACT_ERROR_MESSAGE = 'Серверийн хариу дутуу байна. Дахин оролдоно уу.'
export const UNAUTHORIZED_MESSAGE = 'Нэвтрэх хугацаа дууссан. Дахин нэвтэрнэ үү.'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Most handlers use { message }. The auth middleware answers { error: "..." }
// (server/src/middlwares/auth.ts), so a string `error` is a message too.
function readMessage(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined
  const { message, error } = body
  if (typeof message === 'string' && message.trim() !== '') return message
  if (typeof error === 'string' && error.trim() !== '') return error
  return undefined
}

function readErrorDetails(body: unknown): { code?: string; fields?: Record<string, string> } {
  if (!isRecord(body) || !isRecord(body.error)) return {}
  const { code, fields } = body.error
  const result: { code?: string; fields?: Record<string, string> } = {}
  if (typeof code === 'string') result.code = code
  if (isRecord(fields)) {
    const clean: Record<string, string> = {}
    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === 'string') clean[key] = value
    }
    result.fields = clean
  }
  return result
}

export function interpretResponse<T>(
  status: number,
  body: unknown,
  parse: DataParser<T>,
): ApiResult<T> {
  const message = readMessage(body)
  const details = readErrorDetails(body)

  if (status === 401) {
    return { ok: false, kind: 'unauthorized', status, message: message ?? UNAUTHORIZED_MESSAGE, ...details }
  }
  if (status < 200 || status >= 300) {
    return { ok: false, kind: 'http', status, message: message ?? DEFAULT_ERROR_MESSAGE, ...details }
  }
  if (!isRecord(body) || body.success !== true) {
    return { ok: false, kind: 'rejected', status, message: message ?? DEFAULT_ERROR_MESSAGE, ...details }
  }
  const data = parse(body.data)
  if (data === null) {
    return { ok: false, kind: 'contract', status, message: CONTRACT_ERROR_MESSAGE }
  }
  return message === undefined ? { ok: true, data } : { ok: true, data, message }
}
