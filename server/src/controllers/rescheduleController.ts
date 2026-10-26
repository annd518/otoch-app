// The customer picks another time for a paid order (spec slide 25: after 30
// minutes without a nurse the customer is offered "өөр цаг / цуцлах").
//
//  - PAID (no nurse yet): any time before the visit.
//  - ASSIGNED: only while free cancellation still applies (cancelFreeHours
//    setting); the nurse is released and dispatch looks again for the new time.
// The price does not change and nothing is charged or refunded.
import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../db/db.config";
import { ApiError, ok, validationError } from "../utils/http";
import { assertSlotAvailable, loadOwnedOrder, orderInclude, serializeOrder } from "../services/orders";
import { getSettings } from "../services/settings";
import { notifyRescheduled } from "../services/push";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; role: string };
}

/** The new start must be at least this far ahead (same as booking). */
export const RESCHEDULE_LEAD_MS = 2 * 3600000;

const schema = z
  .object({
    version: z.number().int().positive(),
    scheduledFor: z.iso.datetime({ offset: true }),
    timeSlot: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/, "Цагийн цонх буруу"),
  })
  .strict();

// POST /api/orders/:id/reschedule
export const rescheduleOrder = async (req: AuthenticatedRequest, res: Response) => {
  const p = schema.safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const userId = req.user!.userId;
  const id = String(req.params.id);
  await loadOwnedOrder(id, userId); // 404 for someone else's order
  const settings = await getSettings(prisma);
  const now = new Date();
  const newStart = new Date(p.data.scheduledFor);
  const released = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
    if (order.version !== p.data.version)
      throw new ApiError(409, "VERSION_CONFLICT", "Мэдээлэл шинэчлэгдсэн. Дахин ачаална уу");
    if (order.status !== "PAID" && order.status !== "ASSIGNED")
      throw new ApiError(409, "INVALID_STATUS", "Энэ захиалгын цагийг өөрчлөх боломжгүй");
    if (order.redFlagStatus === "FLAGGED")
      throw new ApiError(409, "INVALID_STATUS", "Энэ захиалгын цагийг өөрчлөх боломжгүй");
    if (
      order.status === "ASSIGNED" &&
      order.scheduledFor &&
      order.scheduledFor.getTime() - now.getTime() < settings.cancelFreeHours * 3600000
    )
      throw new ApiError(
        409,
        "RESCHEDULE_TOO_LATE",
        `Сувилагч томилогдсон тул товлосон цагаас ${settings.cancelFreeHours} цагийн өмнө л цагаа өөрчилнө. Компанитай холбогдоно уу`,
      );
    if (newStart.getTime() < now.getTime() + RESCHEDULE_LEAD_MS)
      throw new ApiError(422, "AVAILABILITY_REQUIRED", "Одоогоос хамгийн багадаа 2 цагийн дараах цаг сонгоно уу");
    if (order.scheduledFor?.getTime() === newStart.getTime() && order.timeSlot === p.data.timeSlot)
      throw new ApiError(422, "VALIDATION_ERROR", "Өмнөхөөс өөр цаг сонгоно уу");
    await assertSlotAvailable({ ...order, scheduledFor: newStart, timeSlot: p.data.timeSlot }, tx);

    await tx.order.update({
      where: { id },
      data: {
        scheduledFor: newStart,
        timeSlot: p.data.timeSlot,
        status: "PAID",
        assignedNurseId: null,
        eta: null,
        version: { increment: 1 },
      },
    });
    // Dispatch starts over for the new time. A nurse who withdrew from this
    // order (DECLINED) is still not asked again.
    await tx.orderOffer.deleteMany({ where: { orderId: id, status: { not: "DECLINED" } } });
    await tx.orderEvent.create({
      data: {
        orderId: id,
        type: "RESCHEDULE",
        actorId: userId,
        fromStatus: order.status,
        toStatus: "PAID",
        metadata: {
          from: order.scheduledFor?.toISOString() ?? null,
          to: newStart.toISOString(),
          releasedNurseId: order.assignedNurseId,
        },
      },
    });
    return order.assignedNurseId;
  });
  if (released) void notifyRescheduled(released, id);
  const order = await loadOwnedOrder(id, userId);
  return ok(res, { order: serializeOrder(order) }, "Цаг өөрчлөгдлөө. Сувилагч дахин хайж байна");
};
