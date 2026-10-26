// Paid orders nobody took (spec slide 25, "Систем" rows). Runs with dispatch.
//
//  - Dispatch has been looking for 30 minutes  -> the customer is told (once)
//    and may cancel for free (a PAID order cancels with 100% back).
//  - The booked time has passed without a nurse -> the order EXPIRES and the
//    payment is refunded in full.
// The admin already sees an unassigned order in red after 5 minutes on the board.
import type { PrismaClient } from "@prisma/client";
import { logError } from "../utils/logger";
import { cancelOrder } from "./cancellation";
import { DISPATCH_HORIZON_MS } from "./dispatch";
import { notifyNoNurseYet } from "./push";
import { getSettings } from "./settings";

/** Default; the live value is the noNurseNoticeMin setting. */
export const NO_NURSE_NOTICE_MS = 30 * 60000;
/** A nurse may still check in this long after the booked start (CHECKIN_WINDOW_MIN). */
export const EXPIRE_AFTER_START_MS = 30 * 60000;
export const SYSTEM_ACTOR = "SYSTEM";

export async function runUnassignedSweep(prisma: PrismaClient, now: Date = new Date()) {
  let noticed = 0;
  let expired = 0;
  const noticeMs = (await getSettings(prisma)).noNurseNoticeMin * 60000;

  // 1. Booked time passed: nobody can do this visit any more.
  const late = await prisma.order.findMany({
    where: {
      status: "PAID",
      assignedNurseId: null,
      scheduledFor: { not: null, lt: new Date(now.getTime() - EXPIRE_AFTER_START_MS) },
    },
    select: { id: true },
    take: 50,
  });
  for (const { id } of late) {
    try {
      await cancelOrder(
        prisma,
        {
          orderId: id,
          actorId: SYSTEM_ACTOR,
          by: "SYSTEM",
          toStatus: "EXPIRED",
          reason: "Захиалсан цагт сувилагч олдсонгүй",
          refundPercent: 100,
        },
        now,
      );
      expired++;
    } catch (err) {
      // assigned or cancelled meanwhile: nothing to do
      logError("sweep.expire", err);
    }
  }

  // 2. Dispatch has been trying for 30 minutes (it starts at payment, or 24 h
  //    before the visit for later bookings).
  const waiting = await prisma.order.findMany({
    where: {
      status: "PAID",
      assignedNurseId: null,
      scheduledFor: { not: null, lte: new Date(now.getTime() + DISPATCH_HORIZON_MS) },
    },
    select: {
      id: true,
      childId: true,
      scheduledFor: true,
      // a new time (RESCHEDULE) starts the search over: one notice per time
      events: {
        where: { type: { in: ["NO_NURSE_NOTICE", "RESCHEDULE"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { type: true, createdAt: true },
      },
      payments: { where: { status: "PAID" }, select: { paidAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    // already-noticed orders are skipped below, so read generously
    take: 500,
  });
  for (const o of waiting) {
    const paidAt = o.payments[0]?.paidAt;
    if (!paidAt || !o.scheduledFor) continue;
    const last = o.events[0];
    if (last?.type === "NO_NURSE_NOTICE") continue;
    const searchingSince = Math.max(
      paidAt.getTime(),
      last?.createdAt.getTime() ?? 0,
      o.scheduledFor.getTime() - DISPATCH_HORIZON_MS,
    );
    if (now.getTime() - searchingSince < noticeMs) continue;
    await prisma.orderEvent.create({ data: { orderId: o.id, type: "NO_NURSE_NOTICE" } });
    await notifyNoNurseYet(o);
    noticed++;
  }
  return { noticed, expired };
}
