// Ulaanbaatar address on booking step 1: district -> khoroo -> details.
//
// Khoroo counts per district (204 in total, ikon.mn 2025-08-12: "Нийт 204
// хороотой"). The split per district is to be confirmed by the business
// against the city's current list; change it here only.
export const UB_DISTRICTS = [
  { name: "Баянгол", khoroo: 34 },
  { name: "Баянзүрх", khoroo: 43 },
  { name: "Сонгинохайрхан", khoroo: 43 },
  { name: "Сүхбаатар", khoroo: 20 },
  { name: "Хан-Уул", khoroo: 25 },
  { name: "Чингэлтэй", khoroo: 24 },
  { name: "Налайх", khoroo: 8 },
  { name: "Багануур", khoroo: 5 },
  { name: "Багахангай", khoroo: 2 },
] as const;

export type District = (typeof UB_DISTRICTS)[number]["name"];

export interface AddressParts {
  district?: District;
  khoroo?: number;
  // building, entrance, apartment, door code ... as typed
  detail: string;
}

export const MIN_DETAIL_LENGTH = 3;
export const MAX_DETAIL_LENGTH = 200;

export function khorooCount(district?: string): number {
  return UB_DISTRICTS.find((d) => d.name === district)?.khoroo ?? 0;
}

/**
 * The single address text the order stores (orders.addressText), e.g.
 * "Баянзүрх дүүрэг, 5-р хороо, 12-р байр, 45 тоот". Nurses and the server
 * read this text, so no new field is needed.
 */
export function composeAddress(p: AddressParts): string {
  return [
    p.district && `${p.district} дүүрэг`,
    p.district && p.khoroo && `${p.khoroo}-р хороо`,
    p.detail,
  ]
    .filter((s) => typeof s === "string" && s.length > 0)
    .join(", ");
}

/** Back from the stored text; an older free-text address becomes `detail`. */
export function parseAddress(text: string): AddressParts {
  const district = UB_DISTRICTS.find((d) =>
    text.startsWith(`${d.name} дүүрэг`),
  );
  if (!district) return { detail: text };
  let rest = text.slice(`${district.name} дүүрэг`.length);
  if (rest && !rest.startsWith(", ")) return { detail: text };
  rest = rest.slice(2);
  const k = /^(\d{1,2})-р хороо(?:, |$)/.exec(rest);
  if (!k) return { district: district.name, detail: rest };
  const khoroo = Number(k[1]);
  if (khoroo < 1 || khoroo > district.khoroo)
    return { district: district.name, detail: rest };
  return { district: district.name, khoroo, detail: rest.slice(k[0].length) };
}
