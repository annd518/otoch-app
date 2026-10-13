import { it } from "node:test";
import assert from "node:assert/strict";
import { calendarDays, timeWindow, isSelectableDay } from "../utils/calendar";
it("calendar aligns Monday, handles leap years and month lengths", () => {
  assert.equal(calendarDays(2024, 2).filter(Boolean).length, 29);
  assert.equal(calendarDays(2026, 2).filter(Boolean).length, 28);
  assert.equal(calendarDays(2026, 6)[0], "2026-06-01");
  assert.equal(calendarDays(2026, 10)[3], "2026-10-01");
});
it("allows future dates beyond the old 14-day list but not past or invalid dates", () => {
  assert.equal(isSelectableDay("2027-01-01", "2026-10-13"), true);
  assert.equal(isSelectableDay("2026-10-12", "2026-10-13"), false);
  assert.equal(isSelectableDay("2026-02-30", "2026-01-01"), false);
});
it("24-hour times cross midnight correctly, including two-hour services", () => {
  assert.equal(timeWindow("00:00", 60), "00:00-01:00");
  assert.equal(timeWindow("23:59", 120), "23:59-01:59");
  assert.equal(timeWindow("24:00", 60), null);
  assert.equal(timeWindow("12:60", 60), null);
});
