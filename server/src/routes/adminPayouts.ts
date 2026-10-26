// Paying nurses (spec slides 83, 98): the admin transfers the money in the
// bank and records it here. Mounted under /api/admin/payouts, behind the
// super-admin guard in admin.ts. No bank API: nothing is sent anywhere.
import { Router, Request } from "express";
import { z } from "zod";
import prisma from "../db/db.config";
import { ApiError, ok, validationError } from "../utils/http";
import { audit } from "../services/audit";
import { bankAccount } from "../services/payouts";
import { notifyPayout } from "../services/push";

interface StaffRequest extends Request {
  user?: { userId: string; role: string };
}

export const adminPayouts = Router();

/** A bank account changed this recently is flagged before paying. */
const BANK_CHANGE_WARN_MS = 7 * 86400000;

// GET /api/admin/payouts/due: every nurse with earnings not yet transferred
adminPayouts.get("/due", async (_req, res) => {
  const groups = await prisma.payoutEntry.groupBy({
    by: ["nurseId"],
    where: { payoutId: null },
    _sum: { netMnt: true, grossMnt: true },
    _count: { _all: true },
    _min: { earnedAt: true },
    _max: { earnedAt: true },
  });
  const ids = groups.map((g) => g.nurseId);
  const [profiles, bankChanges] = await Promise.all([
    prisma.nurseProfile.findMany({
      where: { userId: { in: ids } },
      include: { user: { select: { name: true, phone: true } } },
    }),
    prisma.nurseReviewEvent.findMany({
      where: { nurseId: { in: ids }, action: "BANK_UPDATED", createdAt: { gte: new Date(Date.now() - BANK_CHANGE_WARN_MS) } },
      select: { nurseId: true, createdAt: true },
    }),
  ]);
  const byId = new Map(profiles.map((p) => [p.userId, p]));
  const changed = new Map(bankChanges.map((b) => [b.nurseId, b.createdAt.toISOString()]));
  return ok(
    res,
    {
      nurses: groups
        .map((g) => {
          const p = byId.get(g.nurseId);
          return {
            nurseId: g.nurseId,
            name: p?.user.name ?? "—",
            phone: p?.user.phone ?? null,
            bank: bankAccount(p ?? null),
            bankChangedAt: changed.get(g.nurseId) ?? null,
            visits: g._count._all,
            grossMnt: g._sum.grossMnt ?? 0,
            netMnt: g._sum.netMnt ?? 0,
            from: g._min.earnedAt?.toISOString() ?? null,
            to: g._max.earnedAt?.toISOString() ?? null,
          };
        })
        .sort((a, b) => b.netMnt - a.netMnt),
    },
    "Шилжүүлэх орлого",
  );
});

const paySchema = z
  .object({
    nurseId: z.string().min(1),
    // what the admin saw and transferred; refused if it changed meanwhile
    expectedNetMnt: z.number().int().positive(),
    expectedVisits: z.number().int().positive(),
    reference: z.string().trim().min(3, "Гүйлгээний утга эсвэл дугаарыг оруулна уу").max(100),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

// POST /api/admin/payouts: record a bank transfer covering all unpaid visits
adminPayouts.post("/", async (req: StaffRequest, res) => {
  const p = paySchema.safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const { nurseId, expectedNetMnt, expectedVisits, reference, note } = p.data;
  const payout = await prisma.$transaction(async (tx) => {
    const profile = await tx.nurseProfile.findUnique({ where: { userId: nurseId } });
    if (!profile) throw new ApiError(404, "NURSE_NOT_FOUND", "Сувилагч олдсонгүй");
    if (!bankAccount(profile))
      throw new ApiError(409, "BANK_ACCOUNT_MISSING", "Сувилагч дансны мэдээллээ оруулаагүй байна");
    // two admins paying at once: the row locks make the second one see nothing left
    const rows = await tx.$queryRaw<{ id: string; netMnt: number; earnedAt: Date }[]>`
      SELECT "id", "netMnt", "earnedAt" FROM "PayoutEntry"
      WHERE "nurseId" = ${nurseId} AND "payoutId" IS NULL
      FOR UPDATE`;
    if (rows.length === 0) throw new ApiError(409, "NOTHING_TO_PAY", "Шилжүүлэх орлого алга");
    const total = rows.reduce((s, r) => s + Number(r.netMnt), 0);
    if (total !== expectedNetMnt || rows.length !== expectedVisits)
      throw new ApiError(409, "PAYOUT_CHANGED", "Шилжүүлэх дүн өөрчлөгдсөн байна. Дахин ачаалж шалгана уу");
    const times = rows.map((r) => new Date(r.earnedAt).getTime());
    const created = await tx.payout.create({
      data: {
        nurseId,
        totalMnt: total,
        visits: rows.length,
        periodFrom: new Date(Math.min(...times)),
        periodTo: new Date(Math.max(...times)),
        reference,
        note: note || null,
        paidAt: new Date(),
        createdById: req.user!.userId,
      },
    });
    await tx.payoutEntry.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { payoutId: created.id } });
    await audit(tx, {
      actorId: req.user!.userId,
      action: "PAYOUT_RECORDED",
      entity: "payout",
      entityId: created.id,
      after: { nurseId, totalMnt: total, visits: rows.length, reference },
    });
    return created;
  });
  void notifyPayout(nurseId, payout.totalMnt);
  return ok(res, { payout: serializePayout(payout, null) }, "Шилжүүлэг бүртгэгдлээ");
});

const serializePayout = (
  p: { id: string; nurseId: string; totalMnt: number; visits: number; periodFrom: Date; periodTo: Date; reference: string; note: string | null; paidAt: Date },
  nurseName: string | null,
) => ({
  id: p.id,
  nurseId: p.nurseId,
  nurseName,
  totalMnt: p.totalMnt,
  visits: p.visits,
  periodFrom: p.periodFrom.toISOString(),
  periodTo: p.periodTo.toISOString(),
  reference: p.reference,
  note: p.note,
  paidAt: p.paidAt.toISOString(),
});

// GET /api/admin/payouts?nurseId=: transfers already recorded, newest first
adminPayouts.get("/", async (req, res) => {
  const nurseId = typeof req.query.nurseId === "string" && req.query.nurseId ? req.query.nurseId : undefined;
  const rows = await prisma.payout.findMany({
    where: nurseId ? { nurseId } : {},
    orderBy: { paidAt: "desc" },
    take: 100,
    include: { nurse: { select: { name: true } } },
  });
  return ok(res, { payouts: rows.map((r) => serializePayout(r, r.nurse.name)) }, "Шилжүүлгүүд");
});

// GET /api/admin/payouts/:id: the visits one transfer covered
adminPayouts.get("/:id", async (req, res) => {
  const payout = await prisma.payout.findUnique({
    where: { id: String(req.params.id) },
    include: { nurse: { select: { name: true } }, entries: { orderBy: { earnedAt: "asc" } } },
  });
  if (!payout) throw new ApiError(404, "PAYOUT_NOT_FOUND", "Шилжүүлэг олдсонгүй");
  return ok(
    res,
    {
      payout: serializePayout(payout, payout.nurse.name),
      entries: payout.entries.map((e) => ({
        orderId: e.orderId,
        earnedAt: e.earnedAt.toISOString(),
        grossMnt: e.grossMnt,
        commissionPct: e.commissionPct,
        commissionMnt: e.commissionMnt,
        netMnt: e.netMnt,
      })),
    },
    "Шилжүүлэг",
  );
});
