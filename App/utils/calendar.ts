import { isValidCalendarDate } from "./datetime";
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
