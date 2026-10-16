import { isValidCalendarDate, ulaanbaatarDate } from "./datetime";

// The server only books a start at least 2 hours from now (availability and
// quote guards); the app offers nothing earlier.
export const MIN_LEAD_MS = 2 * 60 * 60 * 1000;

/** A start "HH:MM" (Ulaanbaatar) on `date` is at least 2 hours from now. */
export function startAllowed(date: string, start: string, now: Date): boolean {
  if (!isValidCalendarDate(date) || !/^\d{2}:\d{2}$/.test(start)) return false;
  const at = Date.parse(`${date}T${start}:00+08:00`);
  return Number.isFinite(at) && at >= now.getTime() + MIN_LEAD_MS;
}

/**
 * Earliest bookable start on `date` as "HH:MM" (Ulaanbaatar), null when the
 * whole day is bookable, "24:00" when nothing is left that day.
 */
export function earliestStartOn(date: string, now: Date): string | null {
  const earliest = Math.ceil((now.getTime() + MIN_LEAD_MS) / 60000) * 60000;
  const earliestDate = ulaanbaatarDate(new Date(earliest));
  if (date > earliestDate) return null;
  if (date < earliestDate) return "24:00";
  const minutes = (earliest / 60000 + 8 * 60) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function calendarDays(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days: (string | null)[] = Array(offset).fill(null);
  for (let day = 1; day <= count; day++)
    days.push(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
  while (days.length % 7) days.push(null);
  return days;
}
export function timeWindow(start: string, durationMin: number): string | null {
  if (
    !/^\d{2}:\d{2}$/.test(start) ||
    !Number.isInteger(durationMin) ||
    durationMin < 1 ||
    durationMin > 1440
  )
    return null;
  const [hours, minutes] = start.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  const end = (hours * 60 + minutes + durationMin) % 1440;
  return `${start}-${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}
export function isSelectableDay(date: string, today: string): boolean {
  return isValidCalendarDate(date) && date >= today;
}
