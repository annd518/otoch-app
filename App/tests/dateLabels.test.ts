import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dateTimeLabel, timeLabel } from "../design/dateLabels";

test("date labels show Ulaanbaatar midnight rollover without locale fallback", () => {
  assert.equal(dateTimeLabel("2026-10-19T18:30:00Z"), "2026.10.20 · 02:30");
});
test("equivalent explicit-offset dates and Date objects show the same local time", () => {
  assert.equal(timeLabel("2026-10-20T02:30:00+08:00"), "02:30");
  assert.equal(timeLabel(new Date("2026-10-19T18:30:00Z")), "02:30");
});
test("missing or invalid date labels do not invent dates or crash", () => {
  assert.equal(dateTimeLabel("invalid"), "Огноо тодорхойгүй");
  assert.equal(timeLabel(new Date(NaN)), "Цаг тодорхойгүй");
});
