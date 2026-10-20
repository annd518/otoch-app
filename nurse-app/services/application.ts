// The nurse's registration application (server/src/routes/nurseApplication.ts).
// Pure: takes an HttpClient, no React Native imports.
import { API_PATHS } from '../config/api'
import { isRecord, type ApiResult } from './apiResult'
import type { HttpClient, UploadFile } from './httpClient'

export const DOCUMENT_KINDS = ['LICENSE', 'DIPLOMA', 'ID_CARD', 'PORTRAIT'] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  LICENSE: 'Мэргэжлийн зөвшөөрөл',
  DIPLOMA: 'Диплом',
  ID_CARD: 'Иргэний үнэмлэх',
  PORTRAIT: 'Цээж зураг',
}

export type ApplicationState = 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED'
const STATES: readonly string[] = ['DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'SUSPENDED']

export const STATE_TEXT: Record<ApplicationState, { title: string; body: string }> = {
  DRAFT: {
    title: 'Бүртгэлээ гүйцээнэ үү',
    body: 'Мэдээлэл, баримтын зургаа оруулаад админд илгээнэ. Баталгаажсаны дараа дуудлага ирнэ.',
  },
  SUBMITTED: {
    title: 'Шалгагдаж байна',
    body: 'Өргөдөл тань админд очсон. Шийдвэр гарахад энд харагдана.',
  },
  VERIFIED: { title: 'Баталгаажсан', body: 'Та дуудлага хүлээн авах боломжтой.' },
  REJECTED: {
    title: 'Буцаагдсан',
    body: 'Доорх шалтгааныг засаад дахин илгээнэ үү.',
  },
  SUSPENDED: {
    title: 'Түр хаагдсан',
    body: 'Дуудлага ирэхгүй. Дэлгэрэнгүйг компаниас лавлана уу.',
  },
}

export interface Application {
  state: ApplicationState
  editable: boolean
  name: string
  phone: string | null
  licenseNo: string | null
  // "YYYY-MM-DD"
  licenseExpiresAt: string | null
  employer: string | null
  experienceYears: number | null
  submittedAt: string | null
  reviewNote: string | null
  // upload time per document, null when missing
  documents: Record<DocumentKind, string | null>
  missing: string[]
}

export interface ApplicationDetails {
  name?: string
  licenseNo?: string
  licenseExpiresAt?: string
  employer?: string
  experienceYears?: number
}

const text = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const optText = (v: unknown): string | null => (text(v) ? v : null)

export function parseApplicationEnvelope(data: unknown): Application | null {
  if (!isRecord(data) || !isRecord(data.application)) return null
  const a = data.application
  if (typeof a.state !== 'string' || !STATES.includes(a.state) || !isRecord(a.documents)) return null
  const docs = a.documents
  return {
    state: a.state as ApplicationState,
    editable: a.editable === true,
    name: typeof a.name === 'string' ? a.name : '',
    phone: optText(a.phone),
    licenseNo: optText(a.licenseNo),
    licenseExpiresAt: optText(a.licenseExpiresAt),
    employer: optText(a.employer),
    experienceYears: typeof a.experienceYears === 'number' ? a.experienceYears : null,
    submittedAt: optText(a.submittedAt),
    reviewNote: optText(a.reviewNote),
    documents: Object.fromEntries(DOCUMENT_KINDS.map((k) => [k, optText(docs[k])])) as Record<
      DocumentKind,
      string | null
    >,
    missing: Array.isArray(a.missing) ? a.missing.filter((m): m is string => typeof m === 'string') : [],
  }
}

/** "2027-05-31" → a real calendar date, otherwise null. Accepts "2027.05.31" and "2027/05/31". */
export function normalizeDate(input: string): string | null {
  const m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(input.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export interface DetailsForm {
  name: string
  licenseNo: string
  licenseExpiresAt: string
  employer: string
  experienceYears: string
}

/** Form text → request body, or field errors in Mongolian. */
export function detailsFromForm(form: DetailsForm):
  | { ok: true; details: ApplicationDetails }
  | { ok: false; errors: Partial<Record<keyof DetailsForm, string>> } {
  const errors: Partial<Record<keyof DetailsForm, string>> = {}
  const details: ApplicationDetails = {}
  if (form.name.trim().length < 2) errors.name = 'Овог нэрээ оруулна уу'
  else details.name = form.name.trim()
  if (form.licenseNo.trim() === '') errors.licenseNo = 'Зөвшөөрлийн дугаар оруулна уу'
  else details.licenseNo = form.licenseNo.trim()
  const date = normalizeDate(form.licenseExpiresAt)
  if (!date) errors.licenseExpiresAt = 'Огноог ОООО-СС-ӨӨ хэлбэрээр оруулна уу'
  else details.licenseExpiresAt = date
  if (form.employer.trim().length < 2) errors.employer = 'Ажлын газраа оруулна уу'
  else details.employer = form.employer.trim()
  const years = Number(form.experienceYears)
  if (!/^\d{1,2}$/.test(form.experienceYears.trim()) || years > 60) errors.experienceYears = 'Жилийг тоогоор оруулна уу'
  else details.experienceYears = years
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, details }
}

export const fetchApplication = (client: HttpClient): Promise<ApiResult<Application>> =>
  client.request({ method: 'GET', path: API_PATHS.application.root, parse: parseApplicationEnvelope })

export const saveApplication = (client: HttpClient, details: ApplicationDetails): Promise<ApiResult<Application>> =>
  client.request({ method: 'PUT', path: API_PATHS.application.root, body: details, parse: parseApplicationEnvelope })

export const uploadDocument = (
  client: HttpClient,
  kind: DocumentKind,
  file: UploadFile,
  onProgress?: (fraction: number) => void,
): Promise<ApiResult<Application>> =>
  client.upload({
    path: API_PATHS.application.documents,
    file,
    fields: { kind },
    parse: parseApplicationEnvelope,
    onProgress,
  })

export const submitApplication = (client: HttpClient): Promise<ApiResult<Application>> =>
  client.request({ method: 'POST', path: API_PATHS.application.submit, body: {}, parse: parseApplicationEnvelope })
