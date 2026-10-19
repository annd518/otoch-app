// Visit record rules shared by the record screen. They mirror the server guard in
// POST /api/nurse/orders/:id/finish; the server stays the authority.
import type { MedicationChecks, RejectReason, Vitals } from '../services/nurseVisit'

export const PROCEDURES = [
  { code: 'VITALS', label: 'Амин үзүүлэлт хэмжих' },
  { code: 'INJ', label: 'Тарилга' },
  { code: 'IV', label: 'Судсаар дусал' },
  { code: 'WOUND', label: 'Шархны арчилгаа, боолт' },
  { code: 'CATH', label: 'Давсагны гуурс' },
  { code: 'NG', label: 'Ходоодны зонд' },
  { code: 'CARE', label: 'Асаргаа, сувилгаа' },
] as const

// Catalog service -> the procedure the nurse most likely performed (spec slide 35 skill tags).
const SERVICE_PROCEDURE: Record<string, string> = {
  S01: 'VITALS',
  S02: 'INJ',
  S03: 'IV',
  S04: 'WOUND',
  S05: 'VITALS',
  S06: 'CARE',
  S07: 'CARE',
  S08: 'IV',
  S09: 'CATH',
  S10: 'NG',
}

export function suggestedProcedures(serviceCodes: readonly string[]): string[] {
  return [...new Set(serviceCodes.map((c) => SERVICE_PROCEDURE[c]).filter((c): c is string => !!c))]
}

export const MEDICATION_CHECKS: { key: keyof MedicationChecks; label: string }[] = [
  { key: 'patient', label: 'Өвчтөн зөв' },
  { key: 'medicine', label: 'Эм зөв' },
  { key: 'dose', label: 'Тун зөв' },
  { key: 'route', label: 'Арга зөв' },
  { key: 'time', label: 'Цаг зөв' },
]

export const emptyChecks = (): MedicationChecks => ({
  patient: false,
  medicine: false,
  dose: false,
  route: false,
  time: false,
})

export const allChecked = (checks: MedicationChecks): boolean => Object.values(checks).every((v) => v)

export interface ReadyInput {
  vitals: Vitals
  procedures: readonly string[]
  hasMedication: boolean
  medicationChecks: MedicationChecks
  signerName: string
  hasSignature: boolean
}

// What is still missing before the visit can be signed and finished.
export function missingForFinish(input: ReadyInput): string[] {
  const missing: string[] = []
  if (Object.keys(input.vitals).length === 0) missing.push('Амин үзүүлэлт оруулна уу')
  if (input.procedures.length === 0) missing.push('Хийсэн ажилбараа сонгоно уу')
  if (input.hasMedication && !allChecked(input.medicationChecks)) missing.push('Эм, заалтыг 5 зөв дээр шалгана уу')
  if (input.signerName.trim().length < 2) missing.push('Гарын үсэг зурсан хүний нэрийг оруулна уу')
  if (!input.hasSignature) missing.push('Гарын үсэг зурна уу')
  return missing
}

export const REJECT_LABELS: Record<RejectReason, string> = {
  NO_REFERRAL: 'Эмчийн заалтгүй',
  MED_EXPIRED: 'Эмийн хадгалах хугацаа дууссан',
  NAME_MISMATCH: 'Эмийн нэр заалттай таарахгүй',
  FIRST_DOSE: 'Эхний тун (гэрт хийхгүй)',
}

// Emergency services (spec slide 10): the app only dials, it never handles emergencies.
export const EMERGENCY_NUMBER = '103'

// Keeps only characters valid in a tel: URL.
export const telUrl = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`
