// Ulaanbaatar districts; same names and order as the server
// (server/src/services/ubDistricts.ts) and the family app's address picker.
export const UB_DISTRICTS = [
  'Баянгол',
  'Баянзүрх',
  'Сонгинохайрхан',
  'Сүхбаатар',
  'Хан-Уул',
  'Чингэлтэй',
  'Налайх',
  'Багануур',
  'Багахангай',
] as const

export const isUbDistrict = (v: unknown): v is (typeof UB_DISTRICTS)[number] =>
  typeof v === 'string' && (UB_DISTRICTS as readonly string[]).includes(v)

/** "Бүх дүүрэг" when the list is empty (accounts made before districts). */
export const districtsText = (list: readonly string[]): string =>
  list.length === 0 ? 'Бүх дүүрэг' : list.join(', ')
