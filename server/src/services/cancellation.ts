// Order cancellation and refunds (spec v2.0 slide 25, "Цуцлалт, буцаалт, хугацаа").
//
//  Customer, before a nurse is assigned        -> free, 100% back
//  Customer, 2+ hours before the booked time   -> free, 100% back
//  Customer, less than 2 hours before          -> 30% fee, 70% back   (⚑ fee awaits the lawyer)
//  Customer, after the nurse arrived           -> not cancellable here (no-show, decided by staff)
//  Admin                                       -> any active order, chooses the refund percent
//
// The refund goes through QPay; if QPay refuses or cannot do it (a partial
// amount), the refund waits for an admin to pay it back by hand.
import type { Prisma, PrismaClient } from "@prisma/client";
import { ApiError } from "../utils/http";
import { logError } from "../utils/logger";
import { getQPayAdapter } from "./qpay";
import { notifyOrderCancelled } from "./push";

// ⚑ Spec slide 25: every percentage and minute lives in settings and the
// policy is confirmed by the lawyer. These are the spec's values.
export const CANCEL_POLICY = {
  freeHoursBefore: 2,
  lateRefundPercent: 70,
} as const;

/** Statuses a customer may cancel. */
const CLIENT_CANCELLABLE = ["DRAFT", "AWAITING_PAYMENT", "PAID", "ASSIGNED", "EN_ROUTE"] as const;
/** Statuses an admin may cancel (the visit has not finished). */
const ADMIN_CANCELLABLE = [
  ...CLIENT_CANCELLABLE,
  "BLOCKED_RED_FLAG",
  "IN_PROGRESS",
  "REFUSED",
  "INCIDENT",
] as const;

export type CancelTerms =
  | { allowed: false; reason: string }
  | {
      allowed: true;
      paidMnt: number; // 0 when nothing was paid
      refundPercent: number;
      refundMnt: number;
      feeMnt: number;
      rule: "UNPAID" | "BEFORE_ASSIGNMENT" | "EARLY" | "LATE";
    };

/** What a customer gets back if they cancel now (pure; also shown before confirming). */
export function clientCancelTerms(
  order: { status: string; scheduledFor: Date | null },
  paidMnt: number,
  now: Date,
): CancelTerms {
  if (!(CLIENT_CANCELLABLE as readonly string[]).includes(order.status))
    return {
      allowed: false,
      reason:
        order.status === "IN_PROGRESS"
          ? "Үйлчилгээ эхэлсэн тул цуцлах боломжгүй. Компанитай холбогдоно уу"
          : "Энэ захиалгыг цуцлах боломжгүй",
    };
  if (paidMnt <= 0)
    return { allowed: true, paidMnt: 0, refundPercent: 0, refundMnt: 0, feeMnt: 0, rule: "UNPAID" };
  const full = (rule: "BEFORE_ASSIGNMENT" | "EARLY") =>
    ({ allowed: true, paidMnt, refundPercent: 100, refundMnt: paidMnt, feeMnt: 0, rule }) as const;
  if (order.status === "PAID") return full("BEFORE_ASSIGNMENT");
  const hoursLeft = order.scheduledFor ? (order.scheduledFor.getTime() - now.getTime()) / 3600000 : Infinity;
  if (hoursLeft >= CANCEL_POLICY.freeHoursBefore) return full("EARLY");
  const refundMnt = Math.floor((paidMnt * CANCEL_POLICY.lateRefundPercent) / 100);
  return {
    allowed: true,
    paidMnt,
    refundPercent: CANCEL_POLICY.lateRefundPercent,
    refundMnt,
    feeMnt: paidMnt - refundMnt,
    rule: "LATE",
  };
}

type Tx = Prisma.TransactionClient;

/** The order's paid payment (amount actually received), if any. */
export async function paidPayment(db: Tx | PrismaClient, orderId: string) {
  return db.payment.findFirst({
    where: { orderId, status: "PAID" },
    orderBy: { createdAt: "desc" },
  });
}

export interface CancelInput {
  orderId: string;
  actorId: string;
  by: "CLIENT" | "ADMIN";
  reason: string | null;
  /** CLIENT: the percent the customer was shown (must still hold). ADMIN: the percent to refund. */
  refundPercent: number;
  /** CLIENT only: the order must belong to this user. */
  ownerId?: string;
}

/**
 * Cancels an order and records the refund in one transaction, then (after the
 * commit) asks QPay for the money back and tells the nurse. Returns the refund id.
 */
export async function cancelOrder(prisma: PrismaClient, input: CancelInput, now = new Date()) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order || (input.ownerId && order.childId !== input.ownerId))
      throw new ApiError(404, "ORDER_NOT_FOUND", "Захиалга олдсонгүй");
    const payment = await paidPayment(tx, order.id);
    const paidMnt = payment?.amountMnt ?? 0;

    let refundPercent: number;
    if (input.by === "CLIENT") {
      const terms = clientCancelTerms(order, paidMnt, now);
      if (!terms.allowed) throw new ApiError(409, "INVALID_STATUS", terms.reason);
      // e.g. the 2-hour line passed while the customer was reading the terms
      if (terms.refundPercent !== input.refundPercent)
        throw new ApiError(
          409,
          "CANCEL_TERMS_CHANGED",
          `Цуцлалтын нөхцөл өөрчлөгдлөө: одоо ${terms.refundPercent}% буцаана`,
          { refundPercent: String(terms.refundPercent) },
        );
      refundPercent = terms.refundPercent;
    } else {
      if (!(ADMIN_CANCELLABLE as readonly string[]).includes(order.status))
        throw new ApiError(409, "INVALID_STATUS", "Энэ захиалгыг цуцлах боломжгүй");
      refundPercent = paidMnt > 0 ? input.refundPercent : 0;
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        version: { increment: 1 },
        eta: null,
        cancelledAt: now,
        cancelledBy: input.by,
        cancelReason: input.reason,
      },
    });
    await tx.orderOffer.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "CANCELLED", respondedAt: now },
    });
    // an invoice not paid yet must not be payable any more
    const openInvoices = await tx.payment.findMany({
      where: { orderId: order.id, status: "PENDING" },
      select: { id: true, providerInvoiceId: true },
    });
    if (openInvoices.length > 0)
      await tx.payment.updateMany({
        where: { id: { in: openInvoices.map((p) => p.id) } },
        data: { status: "CANCELLED" },
      });
    const refundMnt = Math.floor((paidMnt * refundPercent) / 100);
    const refund =
      payment && refundMnt > 0
        ? await tx.refund.create({
            data: {
              orderId: order.id,
              paymentId: payment.id,
              percent: refundPercent,
              amountMnt: refundMnt,
              requestedById: input.actorId,
            },
          })
        : null;
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "CANCEL",
        actorId: input.actorId,
        fromStatus: order.status,
        toStatus: "CANCELLED",
        metadata: { by: input.by, refundPercent, refundMnt, reason: input.reason },
      },
    });
    return {
      order,
      refund,
      payment,
      invoices: openInvoices.flatMap((p) => (p.providerInvoiceId ? [p.providerInvoiceId] : [])),
    };
  });

  // After the commit: the provider and the people involved.
  const adapter = (() => {
    try {
      return getQPayAdapter();
    } catch {
      return null;
    }
  })();
  for (const invoiceId of result.invoices) {
    try {
      await adapter?.cancelInvoice(invoiceId);
    } catch (err) {
      logError("cancel.invoice", err);
    }
  }
  if (result.refund) await sendRefund(prisma, result.refund.id);
  void notifyOrderCancelled(result.order, input.by);
  return { refundId: result.refund?.id ?? null };
}

/** Asks QPay for a PENDING refund; on any failure it waits for an admin. Never throws. */
export async function sendRefund(prisma: PrismaClient, refundId: string): Promise<void> {
  const refund = await prisma.refund.findUnique({ where: { id: refundId }, include: { payment: true } });
  if (!refund || refund.status !== "PENDING") return;
  const manual = (failureCode: string) =>
    prisma.refund.update({ where: { id: refund.id }, data: { status: "MANUAL_REQUIRED", failureCode } });
  if (!refund.payment.providerPaymentId) return void (await manual("NO_PROVIDER_PAYMENT"));
  try {
    const r = await getQPayAdapter().refund({
      providerPaymentId: refund.payment.providerPaymentId,
      amountMnt: refund.amountMnt,
      paidAmountMnt: refund.payment.amountMnt,
    });
    if (r.refunded) await prisma.refund.update({ where: { id: refund.id }, data: { status: "REFUNDED" } });
    else await manual(r.reason);
  } catch (err) {
    logError("cancel.refund", err);
    await manual("PROVIDER_UNAVAILABLE");
  }
}

/** For the order screens: the latest refund in plain words. */
export const REFUND_LABEL: Record<string, string> = {
  PENDING: "Буцаалт хийгдэж байна",
  REFUNDED: "Мөнгө буцаагдсан",
  MANUAL_REQUIRED: "Буцаалтыг ажилтан хийнэ (1–3 ажлын өдөр)",
};
