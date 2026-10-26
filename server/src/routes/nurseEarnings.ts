// Nurse earnings screen (spec SCR-N11) and the bank account payouts go to.
// Mounted under /api/nurse.
import { Router, Request } from "express";
import { z } from "zod";
import prisma from "../db/db.config";
import { authenticateToken } from "../middlwares/auth";
import { ApiError, ok, validationError } from "../utils/http";
import { requireNurse } from "./nurseOrders";
import { getSettings, nurseSharePercent } from "../services/settings";
import { bankAccount, earningsRange, ubDay } from "../services/payouts";
import { ratingSummaries } from "../services/ratings";

interface NurseRequest extends Request {
  user?: { userId: string; email: string; role: string };
}

export const nurseEarnings = Router();
nurseEarnings.use(authenticateToken);
nurseEarnings.use(requireNurse);

const querySchema = z.object({
  range: z.enum(["week", "month"]).default("week"),
  // 0 = this week/month, 1 = the one before, ...
  offset: z.coerce.number().int().min(0).max(60).default(0),
});

// GET /api/nurse/earnings?range=week|month&offset=0
nurseEarnings.get("/earnings", async (req: NurseRequest, res) => {
  const q = querySchema.safeParse(req.query);
  if (!q.success) throw validationError(q.error);
  const nurseId = req.user!.userId;
  const period = earningsRange(q.data.range, q.data.offset);
  const [entries, unpaid, payouts, ratings, profile, settings] = await Promise.all([
    prisma.payoutEntry.findMany({
      where: { nurseId, earnedAt: { gte: period.from, lt: period.to } },
      orderBy: { earnedAt: "desc" },
      include: {
        payout: { select: { paidAt: true } },
        order: { select: { items: { select: { service: { select: { name: true } } } } } },
      },
    }),
    prisma.payoutEntry.aggregate({
      where: { nurseId, payoutId: null },
      _sum: { netMnt: true },
      _count: { _all: true },
    }),
    prisma.payout.findMany({ where: { nurseId }, orderBy: { paidAt: "desc" }, take: 10 }),
    ratingSummaries(prisma, [nurseId]),
    prisma.nurseProfile.findUnique({ where: { userId: nurseId } }),
    getSettings(prisma),
  ]);
  const perDay = new Map(period.days.map((d) => [d, { netMnt: 0, visits: 0 }]));
  for (const e of entries) {
    const day = perDay.get(ubDay(e.earnedAt));
    if (day) {
      day.netMnt += e.netMnt;
      day.visits += 1;
    }
  }
  return ok(
    res,
    {
      range: period.range,
      offset: q.data.offset,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      totals: {
        netMnt: entries.reduce((s, e) => s + e.netMnt, 0),
        grossMnt: entries.reduce((s, e) => s + e.grossMnt, 0),
        visits: entries.length,
      },
      days: period.days.map((date) => ({ date, ...perDay.get(date)! })),
      entries: entries.map((e) => ({
        orderId: e.orderId,
        services: e.order.items.map((i) => i.service.name),
        earnedAt: e.earnedAt.toISOString(),
        grossMnt: e.grossMnt,
        netMnt: e.netMnt,
        paidAt: e.payout?.paidAt.toISOString() ?? null,
      })),
      // everything earned and not yet transferred, any period
      unpaid: { netMnt: unpaid._sum.netMnt ?? 0, visits: unpaid._count._all },
      payouts: payouts.map((p) => ({
        id: p.id,
        paidAt: p.paidAt.toISOString(),
        totalMnt: p.totalMnt,
        visits: p.visits,
        periodFrom: p.periodFrom.toISOString(),
        periodTo: p.periodTo.toISOString(),
        reference: p.reference,
      })),
      rating: ratings.get(nurseId)!,
      sharePercent: nurseSharePercent(settings),
      bank: bankAccount(profile),
    },
    "Орлого",
  );
});

/** Mongolian banks (Монголбанкны жагсаалт), shown as choices in the nurse app. */
export const BANKS = [
  "Хаан банк",
  "Голомт банк",
  "Худалдаа хөгжлийн банк",
  "Хас банк",
  "Төрийн банк",
  "Капитрон банк",
  "Богд банк",
  "Үндэсний хөрөнгө оруулалтын банк",
  "Ариг банк",
  "Тээвэр хөгжлийн банк",
  "Чингис хаан банк",
  "М банк",
] as const;

const bankSchema = z
  .object({
    bankName: z.enum(BANKS),
    // account number or IBAN (MN + 18 digits); spaces are ignored
    accountNo: z
      .string()
      .transform((v) => v.replace(/\s+/g, "").toUpperCase())
      .refine((v) => /^(MN\d{18}|\d{6,20})$/.test(v), "Дансны дугаар буруу байна"),
    accountName: z.string().trim().min(2, "Данс эзэмшигчийн нэрийг оруулна уу").max(100),
  })
  .strict();

// PUT /api/nurse/bank: where payouts go. Every change is kept in the review
// history, so an admin sees it before paying (a changed account is a fraud risk).
nurseEarnings.put("/bank", async (req: NurseRequest, res) => {
  const p = bankSchema.safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const nurseId = req.user!.userId;
  const profile = await prisma.nurseProfile.findUnique({ where: { userId: nurseId } });
  if (!profile) throw new ApiError(409, "NOT_ELIGIBLE", "Эхлээд бүртгэлийн өргөдлөө бөглөнө үү");
  const [updated] = await prisma.$transaction([
    prisma.nurseProfile.update({
      where: { userId: nurseId },
      data: { bankName: p.data.bankName, bankAccountNo: p.data.accountNo, bankAccountName: p.data.accountName },
    }),
    prisma.nurseReviewEvent.create({
      data: {
        nurseId,
        actorId: nurseId,
        action: "BANK_UPDATED",
        // only the last digits, so the history does not spread the number
        note: `${p.data.bankName} ···${p.data.accountNo.slice(-4)}`,
      },
    }),
  ]);
  return ok(res, { bank: bankAccount(updated) }, "Дансны мэдээлэл хадгалагдлаа");
});
