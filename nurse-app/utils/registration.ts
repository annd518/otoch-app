// The "join as a nurse" form: validation and the exact wording of the three statements the
// nurse confirms. Pure and unit tested. The server checks the same limits again.
import { toE164 } from './phone'

// Minimum years in the profession (А/41 4.1, spec slide 35: fewer years are declined).
export const MIN_EXPERIENCE_YEARS = 3

export interface ApplicationInput {
  name: string
  phoneDigits: string // the 8 digits after +976
  licenseNo: string
  experience: string // years as typed
  declarations: { license: boolean; experience: boolean; scope: boolean }
}

export type ApplicationErrors = Partial<Record<'name' | 'phone' | 'licenseNo' | 'experience' | 'declarations', string>>

export const DECLARATIONS = [
  { key: 'license', text: 'Мэргэжлийн үйл ажиллагаа эрхлэх хүчин төгөлдөр зөвшөөрөлтэй' },
  { key: 'experience', text: 'Мэргэжлээрээ 3-аас дээш жил ажилласан' },
  {
    key: 'scope',
    text: 'ОТОЧ нь яаралтай тусламж биш гэдгийг ойлгосон: эмчийн заалтгүй тарилга, дусал хийхгүй, аюултай үед 103-т залгана',
  },
] as const

export interface ValidApplication {
  name: string
  phone: string
  licenseNo: string
  experienceYears: number
}

export function validateApplication(
  input: ApplicationInput,
): { ok: true; value: ValidApplication } | { ok: false; errors: ApplicationErrors } {
  const errors: ApplicationErrors = {}
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || !/\S+\s+\S+/.test(name)) errors.name = 'Овог, нэрээ бүтнээр бичнэ үү'

  const phone = toE164(input.phoneDigits)
  if (!phone) errors.phone = '8 оронтой утасны дугаар оруулна уу'

  const licenseNo = input.licenseNo.trim()
  if (licenseNo === '') errors.licenseNo = 'Зөвшөөрлийн дугаараа оруулна уу'
  else if (licenseNo.length > 40) errors.licenseNo = 'Дугаар хэт урт байна'

  const years = Number(input.experience.trim().replace(',', '.'))
  if (input.experience.trim() === '' || !Number.isInteger(years) || years < 0 || years > 60) {
    errors.experience = 'Ажилласан жилээ бүхэл тоогоор оруулна уу'
  } else if (years < MIN_EXPERIENCE_YEARS) {
    errors.experience = `Мэргэжлээрээ ${MIN_EXPERIENCE_YEARS}-аас дээш жил ажилласан байх шаардлагатай`
  }

  if (!input.declarations.license || !input.declarations.experience || !input.declarations.scope) {
    errors.declarations = 'Гурван нөхцөлийг бүгдийг нь баталгаажуулна уу'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { name, phone: phone!, licenseNo, experienceYears: years } }
}
