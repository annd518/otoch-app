// Customer cancellation (spec slide 25): see the terms, then confirm them.
import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../db/db.config";
import { ApiError, ok, validationError } from "../utils/http";
import { CANCEL_POLICY, cancelOrder, clientCancelTerms, paidPayment } from "../services/cancellation";
import { loadOwnedOrder, serializeOrder } from "../services/orders";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; role: string };
}

// GET /api/orders/:id/cancellation: what cancelling now would mean
export const getCancelTerms = async (req: AuthenticatedRequest, res: Response) => {
  const order = await loadOwnedOrder(String(req.params.id), req.user!.userId);
  const payment = await paidPayment(prisma, order.id);
  const terms = clientCancelTerms(order, payment?.amountMnt ?? 0, new Date());
  return ok(
    res,
    {
      terms,
      policy: {
        freeHoursBefore: CANCEL_POLICY.freeHoursBefore,
        lateRefundPercent: CANCEL_POLICY.lateRefundPercent,
      },
    },
    "Цуцлалтын нөхцөл",
  );
};

const cancelSchema = z
  .object({
    // the refund percent the customer saw and agreed to
    refundPercent: z.number().int().min(0).max(100),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

// POST /api/orders/:id/cancel
export const cancelClientOrder = async (req: AuthenticatedRequest, res: Response) => {
  const p = cancelSchema.safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const userId = req.user!.userId;
  const id = String(req.params.id);
  await loadOwnedOrder(id, userId); // 404 for someone else's order
  await cancelOrder(prisma, {
    orderId: id,
    ownerId: userId,
    actorId: userId,
    by: "CLIENT",
    reason: p.data.reason || null,
    refundPercent: p.data.refundPercent,
  });
  const order = await loadOwnedOrder(id, userId);
  if (order.status !== "CANCELLED") throw new ApiError(409, "CONFLICT", "Цуцлагдсангүй");
  return ok(res, { order: serializeOrder(order) }, "Захиалга цуцлагдлаа");
};
