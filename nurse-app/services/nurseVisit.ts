// Visit flow calls (docs/nurse-app-api-proposal.md). Pure: takes an HttpClient.
import { API_PATHS } from '../config/api'
import { isRecord, type ApiResult } from './apiResult'
import type { HttpClient } from './httpClient'
import { parseStaffOrderEnvelope, type StaffOrder } from './staffOrders'

export interface Vitals {
  systolic?: number
  diastolic?: number
  pulse?: number
  temperatureC?: number
  spo2?: number
}

export interface MedicationChecks {
  patient: boolean
  medicine: boolean
  dose: boolean
  route: boolean
  time: boolean
}

export interface VisitRecord {
  checkinAt: string | null
  checkinDistanceM: number | null
  vitals: Vitals
  procedures: string[]
  medicationChecks: MedicationChecks | null
  note: string | null
  signed: boolean
}

export interface RecordPatch {
  vitals?: Vitals
  procedures?: string[]
  medicationChecks?: MedicationChecks
  note?: string
}

export const REJECT_REASONS = ['NO_REFERRAL', 'MED_EXPIRED', 'NAME_MISMATCH', 'FIRST_DOSE'] as const
export type RejectReason = (typeof REJECT_REASONS)[number]

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

function parseVitals(value: unknown): Vitals {
  if (!isRecord(value)) return {}
  const out: Vitals = {}
  for (const key of ['systolic', 'diastolic', 'pulse', 'temperatureC', 'spo2'] as const) {
    const n = num(value[key])
    if (n !== undefined) out[key] = n
  }
  return out
}

function parseChecks(value: unknown): MedicationChecks | null {
  if (!isRecord(value)) return null
  return {
    patient: value.patient === true,
    medicine: value.medicine === true,
    dose: value.dose === true,
    route: value.route === true,
    time: value.time === true,
  }
}

// The server answers { record: null } before a record exists; that is a valid
// "empty" state, not a contract error.
export function parseRecordEnvelope(data: unknown): { record: VisitRecord | null } | null {
  if (!isRecord(data) || !('record' in data)) return null
  const r = data.record
  if (r === null) return { record: null }
  if (!isRecord(r)) return null
  return {
    record: {
      checkinAt: typeof r.checkinAt === 'string' ? r.checkinAt : null,
      checkinDistanceM: num(r.checkinDistanceM) ?? null,
      vitals: parseVitals(r.vitals),
      procedures: Array.isArray(r.procedures) ? r.procedures.filter((p): p is string => typeof p === 'string') : [],
      medicationChecks: parseChecks(r.medicationChecks),
      note: typeof r.note === 'string' ? r.note : null,
      signed: r.signed === true,
    },
  }
}

const post = (client: HttpClient, id: string, action: Parameters<typeof API_PATHS.nurseOrders.action>[1], body: object) =>
  client.request({
    method: 'POST',
    path: API_PATHS.nurseOrders.action(id, action),
    body,
    parse: parseStaffOrderEnvelope,
  }) as Promise<ApiResult<StaffOrder>>

export const enRoute = (client: HttpClient, id: string, version: number) => post(client, id, 'en-route', { version })

export interface CheckinInput {
  version: number
  lat: number
  lng: number
}

// The three confirmations are required by the server and shown as checkboxes
// before this call; sending them is the nurse's attestation.
export const checkin = (client: HttpClient, id: string, input: CheckinInput) =>
  post(client, id, 'checkin', {
    version: input.version,
    method: 'GEO',
    lat: input.lat,
    lng: input.lng,
    checklist: { identified: true, hygiene: true, medicationChecked: true },
  })

export const finish = (
  client: HttpClient,
  id: string,
  input: { version: number; signerName: string; signature: string },
) => post(client, id, 'finish', input)

export const reject = (
  client: HttpClient,
  id: string,
  input: { version: number; reason: RejectReason; comment?: string },
) => post(client, id, 'reject', input)

export const reportIncident = (client: HttpClient, id: string, input: { version: number; description: string }) =>
  post(client, id, 'incident', input)

export const getRecord = (client: HttpClient, id: string) =>
  client.request({ method: 'GET', path: API_PATHS.nurseOrders.record(id), parse: parseRecordEnvelope })

export const saveRecord = (client: HttpClient, id: string, patch: RecordPatch) =>
  client.request({ method: 'PUT', path: API_PATHS.nurseOrders.record(id), body: patch, parse: parseRecordEnvelope })
