// Vitals entry: text fields -> numbers, with the same limits the server enforces
// (server/src/routes/nurseOrders.ts vitalsSchema). Pure and unit tested.
import type { Vitals } from '../services/nurseVisit'

export const VITAL_FIELDS = [
  { key: 'systolic', label: 'Дээд даралт', unit: 'мм.м.у.б', min: 50, max: 260, integer: true },
  { key: 'diastolic', label: 'Доод даралт', unit: 'мм.м.у.б', min: 30, max: 160, integer: true },
  { key: 'pulse', label: 'Судасны цохилт', unit: 'удаа/мин', min: 20, max: 220, integer: true },
  { key: 'temperatureC', label: 'Биеийн халуун', unit: '°C', min: 30, max: 43, integer: false },
  { key: 'spo2', label: 'SpO₂', unit: '%', min: 50, max: 100, integer: true },
] as const

export type VitalKey = (typeof VITAL_FIELDS)[number]['key']
export type VitalsText = Record<VitalKey, string>

export const emptyVitalsText = (): VitalsText => ({ systolic: '', diastolic: '', pulse: '', temperatureC: '', spo2: '' })

export function vitalsToText(vitals: Vitals): VitalsText {
  const text = emptyVitalsText()
  for (const f of VITAL_FIELDS) {
    const v = vitals[f.key]
    if (v !== undefined) text[f.key] = String(v)
  }
  return text
}

export interface VitalsCheck {
  values: Vitals
  errors: Partial<Record<VitalKey, string>>
}

export function checkVitals(text: VitalsText): VitalsCheck {
  const values: Vitals = {}
  const errors: VitalsCheck['errors'] = {}
  for (const f of VITAL_FIELDS) {
    const raw = text[f.key].trim().replace(',', '.')
    if (raw === '') continue
    const n = Number(raw)
    if (!Number.isFinite(n) || (f.integer && !Number.isInteger(n))) {
      errors[f.key] = f.integer ? 'Бүхэл тоо оруулна уу' : 'Тоо оруулна уу'
    } else if (n < f.min || n > f.max) {
      errors[f.key] = `${f.min}–${f.max} хооронд байх ёстой`
    } else {
      values[f.key] = n
    }
  }
  if (values.systolic !== undefined && values.diastolic !== undefined && values.diastolic >= values.systolic) {
    errors.diastolic = 'Доод даралт дээд даралтаас бага байх ёстой'
    delete values.diastolic
  }
  return { values, errors }
}

export const hasAnyVital = (vitals: Vitals): boolean => Object.keys(vitals).length > 0
