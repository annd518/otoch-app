// Nurse earnings (spec slides 71, 83, 98): every finished visit writes one
// PayoutEntry (payout_ledger) with the price the customer paid, the company's
// commission and the nurse's net. An admin pays nurses by bank transfer and
// records it as a Payout; there is no bank API.
import type { Prisma } from "@prisma/client";
import { NURSE_SHARE_PERCENT } from "./dispatch";

type Tx = Prisma.TransactionClient;

/** The nurse's net and the company's commission from a paid price (whole MNT). */
export function splitEarning(grossMnt: number, nurseSharePercent: number = NURSE_SHARE_PERCENT) {
  const netMnt = Math.floor((grossMnt * nurseSharePercent) / 100);
  return {
    grossMnt,
    netMnt,
    commissionMnt: grossMnt - netMnt,
    commissionPct: 100 - nurseSharePercent,
  };
}

/**
 * Called in the transaction that completes a visit. Writes nothing for an
 * order without a nurse or without a paid payment; a second call is a no-op.
 */
export async function recordEarning(tx: Tx, orderId: string, now: Date = new Date()) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      assignedNurseId: true,
      payoutEntry: { select: { id: true } },
      payments: { where: { status: "PAID" }, orderBy: { createdAt: "desc" }, take: 1, select: { amountMnt: true } },
    },
  });
  const gross = order?.payments[0]?.amountMnt ?? 0;
  if (!order?.assignedNurseId || order.payoutEntry || gross <= 0) return null;
  return tx.payoutEntry.create({
    data: { nurseId: order.assignedNurseId, orderId, earnedAt: now, ...splitEarning(gross) },
  });
}

// ---- Ulaanbaatar calendar (UTC+8, no daylight saving) ----
const UB_OFFSET_MS = 8 * 3600000;
const DAY_MS = 86400000;
/** YYYY-MM-DD of an instant in Ulaanbaatar. */
export const ubDay = (d: Date) => new Date(d.getTime() + UB_OFFSET_MS).toISOString().slice(0, 10);
/** Start (UTC instant) of the Ulaanbaatar day YYYY-MM-DD. */
const ubDayStart = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - UB_OFFSET_MS);

export interface EarningsRange {
  range: "week" | "month";
  from: Date; // inclusive
  to: Date; // exclusive
  days: string[]; // YYYY-MM-DD, Ulaanbaatar
}

/** This (offset 0) or an earlier week (Monday first) or calendar month, in Ulaanbaatar. */
export function earningsRange(range: "week" | "month", offset: number, now: Date = new Date()): EarningsRange {
  const today = ubDay(now);
  let fromDay: string;
  let toDay: string;
  if (range === "week") {
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    const monday = Date.parse(`${today}T00:00:00Z`) - (weekday + 7 * offset) * DAY_MS;
    fromDay = new Date(monday).toISOString().slice(0, 10);
    toDay = new Date(monday + 7 * DAY_MS).toISOString().slice(0, 10);
  } else {
    const [y, m] = today.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1 - offset, 1));
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
    fromDay = first.toISOString().slice(0, 10);
    toDay = next.toISOString().slice(0, 10);
  }
  const days: string[] = [];
  for (let t = Date.parse(`${fromDay}T00:00:00Z`); t < Date.parse(`${toDay}T00:00:00Z`); t += DAY_MS)
    days.push(new Date(t).toISOString().slice(0, 10));
  return { range, from: ubDayStart(fromDay), to: ubDayStart(toDay), days };
}

/** The bank account a nurse gave; null until all three fields are filled. */
export function bankAccount(p: { bankName: string | null; bankAccountNo: string | null; bankAccountName: string | null } | null) {
  return p?.bankName && p.bankAccountNo && p.bankAccountName
    ? { bankName: p.bankName, accountNo: p.bankAccountNo, accountName: p.bankAccountName }
    : null;
}
