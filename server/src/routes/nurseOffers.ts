// The nurse's own dispatch surface: offers, accept/decline, profile and online toggle.
import { Router, Request } from "express";
import { z } from "zod";
import prisma from "../db/db.config";
import { authenticateToken } from "../middlwares/auth";
import { ApiError, ok, validationError } from "../utils/http";
import {
  NURSE_SHARE_PERCENT,
  acceptOffer,
  declineOffer,
  ineligibleReason,
} from "../services/dispatch";
import { orderInclude, serializeOrder } from "../services/orders";
import { requireNurse } from "./nurseOrders";

interface NurseRequest extends Request {
  user?: { userId: string; role: string };
}

export const nurseOffers = Router();
nurseOffers.use(authenticateToken);
nurseOffers.use(requireNurse);

nurseOffers.get("/offers", async (req: NurseRequest, res) => {
  const now = new Date();
  const rows = await prisma.orderOffer.findMany({
    where: {
      nurseId: req.user!.userId,
      status: "PENDING",
      expiresAt: { gt: now },
      order: { status: "PAID", assignedNurseId: null },
    },
    include: {
      order: {
        include: {
          items: { include: { service: { select: { name: true } } } },
          quotes: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { expiresAt: "asc" },
  });
  const zones = await prisma.serviceZone.findMany({
    where: { id: { in: rows.flatMap((r) => (r.order.zoneId ? [r.order.zoneId] : [])) } },
    select: { id: true, name: true },
  });
  const zoneName = new Map(zones.map((z) => [z.id, z.name]));
  return ok(
    res,
    {
      offers: rows.map((r) => {
        const quote = r.order.quotes[0];
        return {
          id: r.id,
          wave: r.wave,
          expiresAt: r.expiresAt.toISOString(),
          secondsLeft: Math.max(0, Math.round((r.expiresAt.getTime() - now.getTime()) / 1000)),
          order: {
            id: r.order.id,
            items: r.order.items.map((i) => ({
              serviceCode: i.serviceCode,
              name: i.service.name,
              quantity: i.quantity,
            })),
            scheduledFor: r.order.scheduledFor?.toISOString() ?? null,
            timeSlot: r.order.timeSlot,
            // The exact address is shared only once the nurse accepts.
            area: r.order.zoneId ? (zoneName.get(r.order.zoneId) ?? null) : null,
          },
          earnings: quote
            ? {
                nurseShareMnt: Math.floor((quote.subtotalMnt * NURSE_SHARE_PERCENT) / 100),
                sharePercent: NURSE_SHARE_PERCENT,
                isFixture: quote.isFixture,
              }
            : null,
        };
      }),
    },
    "Дуудлагын саналууд",
  );
});

nurseOffers.post("/offers/:id/accept", async (req: NurseRequest, res) => {
  const orderId = await acceptOffer(prisma, req.user!.userId, req.params.id as string);
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: orderInclude,
  });
  return ok(
    res,
    { order: { ...serializeOrder(order), patientName: order.parent.name } },
    "Дуудлагыг хүлээн авлаа",
  );
});

nurseOffers.post("/offers/:id/decline", async (req: NurseRequest, res) => {
  await declineOffer(prisma, req.user!.userId, req.params.id as string);
  return ok(res, null, "Татгалзлаа");
});

const serializeProfile = (
  p: Awaited<ReturnType<typeof prisma.nurseProfile.findUnique>>,
) => {
  if (!p) return null;
  const blocker = ineligibleReason({ ...p, isActive: true }, { skills: [], zoneId: null }, new Date());
  return {
    status: p.status,
    isActive: p.isActive,
    licenseNo: p.licenseNo,
    licenseExpiresAt: p.licenseExpiresAt?.toISOString() ?? null,
    skillTags: p.skillTags,
    // Why the nurse cannot go online (null = can).
    blocker,
  };
};

nurseOffers.get("/me", async (req: NurseRequest, res) => {
  const profile = await prisma.nurseProfile.findUnique({
    where: { userId: req.user!.userId },
  });
  return ok(res, { profile: serializeProfile(profile) }, "Профайл");
});

nurseOffers.put("/me", async (req: NurseRequest, res) => {
  const p = z.object({ isActive: z.boolean() }).strict().safeParse(req.body);
  if (!p.success) throw validationError(p.error);
  const userId = req.user!.userId;
  const profile = await prisma.nurseProfile.findUnique({ where: { userId } });
  if (p.data.isActive) {
    const reason = ineligibleReason(
      profile && { ...profile, isActive: true },
      { skills: [], zoneId: null },
      new Date(),
    );
    if (reason) throw new ApiError(409, "NOT_ELIGIBLE", reason);
  }
  if (!profile) throw new ApiError(409, "NOT_ELIGIBLE", "Бүртгэл админаар баталгаажаагүй байна");
  const updated = await prisma.nurseProfile.update({
    where: { userId },
    data: { isActive: p.data.isActive },
  });
  return ok(res, { profile: serializeProfile(updated) }, "Хадгалагдлаа");
});
