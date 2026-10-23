// Admin cancellation and refunds that need a person (spec slide 25: "амжилтгүй
// бол гараар (админ)"). Mounted under /api/admin, behind its super-admin guard.
import { Router, Request } from "express";
import { z } from "zod";
import prisma from "../db/db.config";
import { ApiError, ok, validationError } from "../utils/http";
import { cancelOrder, sendRefund } from "../services/cancellation";
import { orderInclude, serializeOrder } from "../services/orders";

interface StaffRequest extends Request {
  user?: { userId: string; role: string };
}

export const adminCancel = Router();

const cancelSchema = z
  .object({
    reason: z.string().trim().min(5, "Шалтгааныг тодорхой бичнэ үү").max(500),
    refundPercent: z.number().int().min(0).max(100),
  })
  .strict();

// POST /api/admin/orders/:id/cancel
adminCancel.post("/orders/:id/cancel", async (req: StaffRequest, res) => {
  const p = cancelSchema.safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const id = String(req.params.id);
  await cancelOrder(prisma, {
    orderId: id,
    actorId: req.user!.userId,
    by: "ADMIN",
    reason: p.data.reason,
    refundPercent: p.data.refundPercent,
  });
  const order = await prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  return ok(res, { order: serializeOrder(order) }, "Захиалга цуцлагдлаа");
});

const STATUSES = ["MANUAL_REQUIRED", "PENDING", "REFUNDED"] as const;

// GET /api/admin/refunds?status=MANUAL_REQUIRED
adminCancel.get("/refunds", async (req: StaffRequest, res) => {
  const status = String(req.query.status ?? "MANUAL_REQUIRED");
  if (!(STATUSES as readonly string[]).includes(status))
    throw new ApiError(400, "VALIDATION_ERROR", "Төлөв буруу", { status: STATUSES.join(", ") });
  const rows = await prisma.refund.findMany({
    where: { status: status as (typeof STATUSES)[number] },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      payment: { select: { providerPaymentId: true, amountMnt: true, mode: true } },
      order: { select: { id: true, parent: { select: { name: true } }, child: { select: { name: true, phone: true } } } },
    },
  });
  return ok(
    res,
    {
      refunds: rows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        status: r.status,
        percent: r.percent,
        amountMnt: r.amountMnt,
        paidMnt: r.payment.amountMnt,
        isMock: r.payment.mode === "mock",
        // the QPay payment to refund by hand in the merchant portal
        providerPaymentId: r.payment.providerPaymentId,
        failureCode: r.failureCode,
        customer: { name: r.order.child.name, phone: r.order.child.phone },
        patientName: r.order.parent.name,
        resolvedNote: r.resolvedNote,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    "Буцаалтууд",
  );
});

const resolveSchema = z.object({ note: z.string().trim().min(3, "Тэмдэглэл бичнэ үү").max(500) }).strict();

// POST /api/admin/refunds/:id/resolve: the admin paid it back by hand
adminCancel.post("/refunds/:id/resolve", async (req: StaffRequest, res) => {
  const p = resolveSchema.safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const refund = await prisma.refund.findUnique({ where: { id: String(req.params.id) } });
  if (!refund) throw new ApiError(404, "REFUND_NOT_FOUND", "Буцаалт олдсонгүй");
  if (refund.status === "REFUNDED") throw new ApiError(409, "INVALID_STATUS", "Аль хэдийн буцаагдсан");
  await prisma.refund.update({
    where: { id: refund.id },
    data: { status: "REFUNDED", resolvedById: req.user!.userId, resolvedNote: p.data.note },
  });
  return ok(res, null, "Буцаасан гэж тэмдэглэлээ");
});

// POST /api/admin/refunds/:id/retry: ask QPay again
adminCancel.post("/refunds/:id/retry", async (req: StaffRequest, res) => {
  const refund = await prisma.refund.findUnique({ where: { id: String(req.params.id) } });
  if (!refund) throw new ApiError(404, "REFUND_NOT_FOUND", "Буцаалт олдсонгүй");
  if (refund.status !== "MANUAL_REQUIRED") throw new ApiError(409, "INVALID_STATUS", "Дахин оролдох боломжгүй");
  await prisma.refund.update({ where: { id: refund.id }, data: { status: "PENDING", failureCode: null } });
  await sendRefund(prisma, refund.id);
  const after = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
  return ok(res, { status: after.status, failureCode: after.failureCode }, "Дахин оролдлоо");
});
