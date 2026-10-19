import { Router, Request } from "express";
import prisma from "../db/db.config";
import { authenticateToken } from "../middlwares/auth";
import { ApiError, ok } from "../utils/http";

interface StaffRequest extends Request {
  user?: { userId: string; role: string };
}

// Admin web dashboard (wclient /dashboard/admin). Read-only numbers.
export const adminRoutes = Router();
adminRoutes.use(authenticateToken);
// The role and the account state are read from the database, not from the
// token: a changed role or a deactivated account takes effect immediately.
adminRoutes.use(async (req: StaffRequest, _res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { role: true, deletedAt: true },
  });
  if (!user || user.deletedAt || !["ADMIN", "MEDICAL_ADMIN"].includes(user.role))
    throw new ApiError(403, "FORBIDDEN", "Админ эрх шаардлагатай");
  req.user!.role = user.role;
  next();
});

const UB_OFFSET_MS = 8 * 3600000;
/** Start of the Ulaanbaatar calendar day / month that contains `now`. */
export function ulaanbaatarDayStart(now: Date): Date {
  const local = new Date(now.getTime() + UB_OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
      UB_OFFSET_MS,
  );
}
export function ulaanbaatarMonthStart(now: Date): Date {
  const local = new Date(now.getTime() + UB_OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - UB_OFFSET_MS,
  );
}

const RECONCILIATION = ["NEEDS_RECONCILIATION", "PAID_AFTER_EXPIRY"];
const ACTIVE = ["PAID", "ASSIGNED", "IN_PROGRESS"] as const;

adminRoutes.get("/summary", async (_req: StaffRequest, res) => {
  const now = new Date();
  const dayStart = ulaanbaatarDayStart(now);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const monthStart = ulaanbaatarMonthStart(now);
  const soon = new Date(now.getTime() + 24 * 3600000);

  const [
    byStatus,
    today,
    unassigned,
    reconciliation,
    pendingPayments,
    paidToday,
    paidMonth,
    roles,
    deactivatedStaff,
    patients,
    attentionUnassigned,
    attentionPayments,
    recent,
  ] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.count({
      where: {
        scheduledFor: { gte: dayStart, lt: dayEnd },
        status: { in: [...ACTIVE, "COMPLETED"] },
      },
    }),
    prisma.order.count({ where: { status: "PAID", assignedNurseId: null } }),
    prisma.payment.count({ where: { failureCode: { in: RECONCILIATION } } }),
    prisma.payment.count({
      where: { status: "PENDING", expiresAt: { gt: now } },
    }),
    prisma.payment.groupBy({
      by: ["mode"],
      where: { status: "PAID", paidAt: { gte: dayStart, lt: dayEnd } },
      _sum: { amountMnt: true },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["mode"],
      where: { status: "PAID", paidAt: { gte: monthStart } },
      _sum: { amountMnt: true },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.user.count({
      where: { deletedAt: { not: null }, role: { not: "CHILD" } },
    }),
    prisma.parent.count(),
    // paid but no nurse yet, earliest visit first
    prisma.order.findMany({
      where: { status: "PAID", assignedNurseId: null },
      orderBy: { scheduledFor: "asc" },
      take: 10,
      select: {
        id: true,
        scheduledFor: true,
        parent: { select: { name: true } },
        items: { select: { service: { select: { name: true } } }, take: 1 },
      },
    }),
    prisma.payment.findMany({
      where: { failureCode: { in: RECONCILIATION } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        orderId: true,
        failureCode: true,
        amountMnt: true,
        mode: true,
        updatedAt: true,
      },
    }),
    prisma.order.findMany({
      where: { status: { not: "DRAFT" } },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        status: true,
        scheduledFor: true,
        updatedAt: true,
        parent: { select: { name: true } },
        assignedNurse: { select: { name: true } },
        items: { select: { service: { select: { name: true } } }, take: 1 },
      },
    }),
  ]);

  // Mock payments are development money: never mixed into revenue
  const money = (rows: typeof paidToday) => {
    const real = rows.filter((r) => r.mode !== "mock");
    const mock = rows.filter((r) => r.mode === "mock");
    const sum = (list: typeof rows) =>
      list.reduce((s, r) => s + (r._sum.amountMnt ?? 0), 0);
    const count = (list: typeof rows) =>
      list.reduce((s, r) => s + r._count._all, 0);
    return {
      amountMnt: sum(real),
      count: count(real),
      mockAmountMnt: sum(mock),
      mockCount: count(mock),
    };
  };
  const role = (name: string) =>
    roles.find((r) => r.role === name)?._count._all ?? 0;

  return ok(
    res,
    {
      generatedAt: now.toISOString(),
      orders: {
        byStatus: Object.fromEntries(
          byStatus.map((r) => [r.status, r._count._all]),
        ),
        today,
        unassignedPaid: unassigned,
      },
      payments: {
        today: money(paidToday),
        month: money(paidMonth),
        pending: pendingPayments,
        needsReconciliation: reconciliation,
      },
      users: {
        customers: role("CHILD"),
        nurses: role("NURSE"),
        medicalAdmins: role("MEDICAL_ADMIN"),
        admins: role("ADMIN"),
        deactivatedStaff,
        patients,
      },
      attention: [
        ...attentionUnassigned.map((o) => ({
          kind: "UNASSIGNED" as const,
          orderId: o.id,
          patientName: o.parent.name,
          service: o.items[0]?.service.name ?? null,
          at: o.scheduledFor?.toISOString() ?? null,
          urgent: !!o.scheduledFor && o.scheduledFor <= soon,
        })),
        ...attentionPayments.map((p) => ({
          kind: "RECONCILIATION" as const,
          orderId: p.orderId,
          code: p.failureCode,
          amountMnt: p.amountMnt,
          isMock: p.mode === "mock",
          at: p.updatedAt.toISOString(),
          urgent: true,
        })),
      ],
      recentOrders: recent.map((o) => ({
        id: o.id,
        status: o.status,
        patientName: o.parent.name,
        service: o.items[0]?.service.name ?? null,
        nurse: o.assignedNurse?.name ?? null,
        scheduledFor: o.scheduledFor?.toISOString() ?? null,
        updatedAt: o.updatedAt.toISOString(),
      })),
    },
    "Админ самбар",
  );
});
