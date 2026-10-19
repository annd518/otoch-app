// Dispatch (spec slide 70): a paid order is offered to up to WAVE_SIZE eligible
// nurses at a time; the first to accept gets it. Offers expire after OFFER_TTL_MS
// and the next wave goes to nurses not asked yet. An order nobody takes stays PAID
// for an admin to assign by hand (POST /api/staff/orders/:id/assign).
import type { Prisma, PrismaClient } from "@prisma/client";
import { ApiError } from "../utils/http";

export const OFFER_TTL_MS = 120_000;
export const WAVE_SIZE = 3;
/** Orders are dispatched when they start within this long (spec slide 70). */
export const DISPATCH_HORIZON_MS = 24 * 3_600_000;
/** A nurse cannot take two visits starting within this long of each other. */
export const CONFLICT_WINDOW_MS = 2 * 3_600_000;
/** The nurse's share of the service price (spec slide 5, contract 70/30). */
export const NURSE_SHARE_PERCENT = 70;
const BUSY = ["ASSIGNED", "EN_ROUTE", "IN_PROGRESS"] as const;

// Skill tag a service needs (spec slide 35). S01/S05 (assessment) need none.
const SERVICE_SKILL: Record<string, string> = {
  S02: "INJ",
  S03: "IV",
  S08: "IV",
  S04: "WOUND",
  S09: "CATH",
  S10: "NG",
  S06: "CARE",
  S07: "CARE",
};

export function requiredSkills(serviceCodes: readonly string[]): string[] {
  return [
    ...new Set(
      serviceCodes.map((c) => SERVICE_SKILL[c]).filter((s): s is string => !!s),
    ),
  ];
}

export interface ProfileLike {
  status: string;
  isActive: boolean;
  licenseExpiresAt: Date | null;
  skillTags: string[];
  zoneIds: string[];
}

/** Why this nurse cannot be offered (or take) the order; null when eligible. */
export function ineligibleReason(
  profile: ProfileLike | null,
  need: { skills: readonly string[]; zoneId: string | null },
  now: Date,
): string | null {
  if (!profile || profile.status !== "VERIFIED")
    return "Бүртгэл админаар баталгаажаагүй байна";
  if (!profile.licenseExpiresAt || profile.licenseExpiresAt <= now)
    return "Мэргэжлийн зөвшөөрлийн хугацаа дууссан байна";
  if (!profile.isActive) return "Идэвхтэй горимд ороогүй байна";
  if (!need.skills.every((s) => profile.skillTags.includes(s)))
    return "Энэ ажилбарт шаардлагатай ур чадвар таарахгүй";
  if (
    need.zoneId &&
    profile.zoneIds.length > 0 &&
    !profile.zoneIds.includes(need.zoneId)
  )
    return "Энэ бүс таны ажиллах бүсэд ороогүй байна";
  return null;
}

type Tx = Prisma.TransactionClient;

const orderSkills = (items: { serviceCode: string }[]) =>
  requiredSkills(items.map((i) => i.serviceCode));

async function hasConflict(
  tx: Tx,
  nurseId: string,
  scheduledFor: Date,
  exceptOrderId: string,
): Promise<boolean> {
  const from = new Date(scheduledFor.getTime() - CONFLICT_WINDOW_MS);
  const to = new Date(scheduledFor.getTime() + CONFLICT_WINDOW_MS);
  return (
    (await tx.order.count({
      where: {
        id: { not: exceptOrderId },
        assignedNurseId: nurseId,
        status: { in: [...BUSY] },
        scheduledFor: { gt: from, lt: to },
      },
    })) > 0
  );
}

export interface DispatchSummary {
  expired: number;
  ordersOffered: number;
  offersCreated: number;
}

/**
 * One pass: expire stale offers, then start the next wave for every PAID,
 * unassigned order inside the horizon that has no live offer. Safe to run from
 * several processes at once (row lock per order + unique (order, nurse)).
 */
export async function runDispatchCycle(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<DispatchSummary> {
  const expired = (
    await prisma.orderOffer.updateMany({
      where: { status: "PENDING", expiresAt: { lte: now } },
      data: { status: "EXPIRED", respondedAt: now },
    })
  ).count;

  const candidates = await prisma.order.findMany({
    where: {
      status: "PAID",
      assignedNurseId: null,
      redFlagStatus: { not: "FLAGGED" },
      scheduledFor: { not: null, lte: new Date(now.getTime() + DISPATCH_HORIZON_MS) },
      offers: { none: { status: "PENDING" } },
    },
    select: { id: true },
    orderBy: { scheduledFor: "asc" },
    take: 50,
  });

  let ordersOffered = 0;
  let offersCreated = 0;
  for (const { id } of candidates) {
    const created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "Order" WHERE "id"=${id} FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: { select: { serviceCode: true } }, offers: true },
      });
      if (
        !order ||
        order.status !== "PAID" ||
        order.assignedNurseId ||
        !order.scheduledFor ||
        order.redFlagStatus === "FLAGGED" ||
        order.offers.some((o) => o.status === "PENDING")
      )
        return 0;
      const asked = new Set(order.offers.map((o) => o.nurseId));
      const profiles = await tx.nurseProfile.findMany({
        where: {
          status: "VERIFIED",
          isActive: true,
          licenseExpiresAt: { gt: now },
          userId: { notIn: [...asked] },
          user: { deletedAt: null, role: "NURSE" },
        },
      });
      const need = { skills: orderSkills(order.items), zoneId: order.zoneId };
      const eligible: string[] = [];
      for (const p of profiles) {
        if (ineligibleReason(p, need, now)) continue;
        if (await hasConflict(tx, p.userId, order.scheduledFor, order.id)) continue;
        eligible.push(p.userId);
      }
      if (eligible.length === 0) return 0;
      // Spread the work: whoever has fewest visits ahead is asked first.
      const load = new Map<string, number>();
      for (const nurseId of eligible)
        load.set(
          nurseId,
          await tx.order.count({
            where: { assignedNurseId: nurseId, status: { in: [...BUSY] } },
          }),
        );
      const chosen = eligible
        .sort((a, b) => load.get(a)! - load.get(b)! || a.localeCompare(b))
        .slice(0, WAVE_SIZE);
      const wave = order.offers.reduce((m, o) => Math.max(m, o.wave), 0) + 1;
      await tx.orderOffer.createMany({
        data: chosen.map((nurseId) => ({
          orderId: order.id,
          nurseId,
          wave,
          expiresAt: new Date(now.getTime() + OFFER_TTL_MS),
        })),
        skipDuplicates: true,
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "OFFER_WAVE",
          metadata: { wave, offered: chosen.length },
        },
      });
      return chosen.length;
    });
    if (created > 0) {
      ordersOffered++;
      offersCreated += created;
    }
  }
  return { expired, ordersOffered, offersCreated };
}

async function loadOfferForUpdate(tx: Tx, offerId: string, nurseId: string) {
  const found = await tx.orderOffer.findFirst({
    where: { id: offerId, nurseId },
    select: { orderId: true },
  });
  if (!found) throw new ApiError(404, "OFFER_NOT_FOUND", "Санал олдсонгүй");
  await tx.$executeRaw`SELECT 1 FROM "Order" WHERE "id"=${found.orderId} FOR UPDATE`;
  const offer = await tx.orderOffer.findUniqueOrThrow({ where: { id: offerId } });
  return offer;
}

/** The nurse takes the order: first valid accept wins, everyone else's offer is cancelled. */
export async function acceptOffer(
  prisma: PrismaClient,
  nurseId: string,
  offerId: string,
  now: Date = new Date(),
) {
  return prisma.$transaction(async (tx) => {
    const offer = await loadOfferForUpdate(tx, offerId, nurseId);
    if (offer.status !== "PENDING")
      throw new ApiError(409, "OFFER_EXPIRED", "Энэ санал хүчингүй болсон байна");
    if (offer.expiresAt <= now) {
      await tx.orderOffer.update({
        where: { id: offer.id },
        data: { status: "EXPIRED", respondedAt: now },
      });
      throw new ApiError(409, "OFFER_EXPIRED", "Саналын хугацаа дууссан байна");
    }
    const order = await tx.order.findUniqueOrThrow({
      where: { id: offer.orderId },
      include: { items: { select: { serviceCode: true } } },
    });
    if (
      order.status !== "PAID" ||
      order.assignedNurseId ||
      order.redFlagStatus === "FLAGGED"
    ) {
      await tx.orderOffer.update({
        where: { id: offer.id },
        data: { status: "CANCELLED", respondedAt: now },
      });
      throw new ApiError(409, "ORDER_TAKEN", "Энэ дуудлагыг өөр сувилагч авсан байна");
    }
    const profile = await tx.nurseProfile.findUnique({ where: { userId: nurseId } });
    const reason = ineligibleReason(
      profile,
      { skills: orderSkills(order.items), zoneId: order.zoneId },
      now,
    );
    if (reason) throw new ApiError(409, "NOT_ELIGIBLE", reason);
    if (order.scheduledFor && (await hasConflict(tx, nurseId, order.scheduledFor, order.id)))
      throw new ApiError(
        409,
        "NOT_ELIGIBLE",
        "Энэ цагтай ойролцоо өөр дуудлага танд байна",
      );
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "ASSIGNED",
        assignedNurseId: nurseId,
        eta: null,
        version: { increment: 1 },
      },
    });
    await tx.orderOffer.update({
      where: { id: offer.id },
      data: { status: "ACCEPTED", respondedAt: now },
    });
    await tx.orderOffer.updateMany({
      where: { orderId: order.id, id: { not: offer.id }, status: "PENDING" },
      data: { status: "CANCELLED", respondedAt: now },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "ACCEPT",
        actorId: nurseId,
        fromStatus: "PAID",
        toStatus: "ASSIGNED",
        metadata: { offerId: offer.id, wave: offer.wave },
      },
    });
    return order.id;
  });
}

export async function declineOffer(
  prisma: PrismaClient,
  nurseId: string,
  offerId: string,
  now: Date = new Date(),
) {
  await prisma.$transaction(async (tx) => {
    const offer = await loadOfferForUpdate(tx, offerId, nurseId);
    if (offer.status !== "PENDING")
      throw new ApiError(409, "OFFER_EXPIRED", "Энэ санал хүчингүй болсон байна");
    await tx.orderOffer.update({
      where: { id: offer.id },
      data: { status: "DECLINED", respondedAt: now },
    });
    await tx.orderEvent.create({
      data: {
        orderId: offer.orderId,
        type: "DECLINE",
        actorId: nurseId,
        metadata: { offerId: offer.id, wave: offer.wave },
      },
    });
  });
}
