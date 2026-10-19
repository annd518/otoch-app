// Display only: fixed UTC+8 avoids locale-dependent AM/PM fallbacks in mn-MN.
function parts(value: string | Date) {
  const instant = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(instant)) return null;
  return new Date(instant + 8 * 60 * 60 * 1000).toISOString();
}
export function dateTimeLabel(value: string | Date): string {
  const iso = parts(value);
  return iso
    ? `${iso.slice(0, 10).replace(/-/g, ".")} · ${iso.slice(11, 16)}`
    : "Огноо тодорхойгүй";
}
export function timeLabel(value: string | Date): string {
  return parts(value)?.slice(11, 16) ?? "Цаг тодорхойгүй";
}
