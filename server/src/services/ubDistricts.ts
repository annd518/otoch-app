// Ulaanbaatar districts. Same names as the customer app (App/utils/ubAddress.ts),
// which stores an order address as "Баянзүрх дүүрэг, 5-р хороо, ...".
export const UB_DISTRICTS = [
  "Баянгол",
  "Баянзүрх",
  "Сонгинохайрхан",
  "Сүхбаатар",
  "Хан-Уул",
  "Чингэлтэй",
  "Налайх",
  "Багануур",
  "Багахангай",
] as const;
export type UbDistrict = (typeof UB_DISTRICTS)[number];

export const isUbDistrict = (v: string): v is UbDistrict =>
  (UB_DISTRICTS as readonly string[]).includes(v);

/** The district of an order address, or null for an older free-text address. */
export function orderDistrict(addressText: string | null | undefined): UbDistrict | null {
  if (!addressText) return null;
  const text = addressText.trim();
  return (
    UB_DISTRICTS.find((d) => text === `${d} дүүрэг` || text.startsWith(`${d} дүүрэг,`)) ??
    null
  );
}
