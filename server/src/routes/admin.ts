import { Router, Request } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../db/db.config";
import { authenticateToken } from "../middlwares/auth";
import { ApiError, ok, validationError } from "../utils/http";

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

// ---------------------------------------------------------------------------
// Users and staff (ADMIN only). Customers (CHILD) are listed read-only: their
// accounts are closed through the account deletion flow, not here.

const STAFF_ROLES = ["NURSE", "MEDICAL_ADMIN", "ADMIN"] as const;
const adminOnly = (req: StaffRequest) => {
  if (req.user!.role !== "ADMIN")
    throw new ApiError(403, "FORBIDDEN", "Зөвхөн админ хэрэглэгч удирдана");
};
const passwordSchema = z
  .string()
  .min(10, "Нууц үг хамгийн багадаа 10 тэмдэгт")
  .max(128, "Нууц үг хэт урт");
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+976\d{8}$/, "Утас +976XXXXXXXX хэлбэртэй байна");

const listQuery = z.object({
  group: z.enum(["staff", "customers", "inactive"]).default("staff"),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().max(100).optional(),
});
const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
  deletedAt: true,
  _count: { select: { orders: true } },
} as const;

adminRoutes.get("/users", async (req: StaffRequest, res) => {
  adminOnly(req);
  const p = listQuery.safeParse(req.query);
  if (!p.success) throw validationError(p.error);
  const { group, q, cursor } = p.data;
  const rows = await prisma.user.findMany({
    where: {
      ...(group === "staff" && {
        role: { in: [...STAFF_ROLES] },
        deletedAt: null,
      }),
      ...(group === "customers" && { role: "CHILD" as const, deletedAt: null }),
      ...(group === "inactive" && { deletedAt: { not: null } }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
        ],
      }),
    },
    select: userSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, 50);
  // nurses: how many visits they currently carry
  const nurseIds = page.filter((u) => u.role === "NURSE").map((u) => u.id);
  const busy = nurseIds.length
    ? await prisma.order.groupBy({
        by: ["assignedNurseId"],
        where: {
          assignedNurseId: { in: nurseIds },
          status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        },
        _count: { _all: true },
      })
    : [];
  return ok(
    res,
    {
      users: page.map(({ _count, deletedAt, createdAt, ...u }) => ({
        ...u,
        createdAt: createdAt.toISOString(),
        active: deletedAt === null,
        deactivatedAt: deletedAt?.toISOString() ?? null,
        orders: u.role === "CHILD" ? _count.orders : null,
        activeVisits:
          u.role === "NURSE"
            ? (busy.find((b) => b.assignedNurseId === u.id)?._count._all ?? 0)
            : null,
      })),
      nextCursor: rows.length > 50 ? page[49].id : null,
    },
    "Хэрэглэгчид",
  );
});

const createStaff = z.object({
  name: z.string().trim().min(2, "Нэр хамгийн багадаа 2 тэмдэгт").max(100),
  email: z.string().trim().email("Имэйл хаяг буруу байна").max(200),
  phone: phoneSchema.optional(),
  role: z.enum(STAFF_ROLES),
  password: passwordSchema,
});

// POST /api/admin/staff: the only way to create a nurse / admin account
// (public signup creates customers only). The password is never returned.
adminRoutes.post("/staff", async (req: StaffRequest, res) => {
  adminOnly(req);
  const p = createStaff.safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const { name, email, phone, role, password } = p.data;
  if (
    await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    })
  )
    throw new ApiError(409, "EMAIL_TAKEN", "Энэ имэйлээр бүртгэл байна", {
      email: "Бүртгэлтэй имэйл",
    });
  if (phone && (await prisma.user.findUnique({ where: { phone } })))
    throw new ApiError(409, "PHONE_TAKEN", "Энэ утсаар бүртгэл байна", {
      phone: "Бүртгэлтэй утас",
    });
  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      phone: phone ?? null,
      role,
      password: await bcrypt.hash(password, 10),
    },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });
  return ok(res, { user }, "Ажилтан нэмэгдлээ", 201);
});

const updateUser = z
  .object({
    role: z.enum(STAFF_ROLES).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.role !== undefined || v.active !== undefined, {
    message: "Өөрчлөх зүйл алга",
  });

// PATCH /api/admin/users/:id: change a staff role, deactivate / reactivate.
adminRoutes.patch("/users/:id", async (req: StaffRequest, res) => {
  adminOnly(req);
  const p = updateUser.safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const id = String(req.params.id);
  if (id === req.user!.userId)
    throw new ApiError(
      409,
      "SELF_CHANGE",
      "Өөрийн эрх, төлөвийг өөрчлөх боломжгүй",
    );
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, deletedAt: true },
  });
  if (!target) throw new ApiError(404, "USER_NOT_FOUND", "Хэрэглэгч олдсонгүй");
  if (target.role === "CHILD")
    throw new ApiError(
      409,
      "CUSTOMER_NOT_MANAGED",
      "Захиалагчийн бүртгэлийг энд өөрчлөхгүй",
    );
  const { role, active } = p.data;
  const losesAdmin =
    target.role === "ADMIN" &&
    target.deletedAt === null &&
    ((role !== undefined && role !== "ADMIN") || active === false);
  const deactivating = active === false && target.deletedAt === null;
  const leavesNursing =
    target.role === "NURSE" &&
    (deactivating || (role !== undefined && role !== "NURSE"));

  await prisma.$transaction(async (tx) => {
    if (losesAdmin) {
      const admins = await tx.user.count({
        where: { role: "ADMIN", deletedAt: null },
      });
      if (admins <= 1)
        throw new ApiError(
          409,
          "LAST_ADMIN",
          "Сүүлийн идэвхтэй админыг өөрчлөх боломжгүй",
        );
    }
    if (leavesNursing) {
      const visits = await tx.order.count({
        where: {
          assignedNurseId: id,
          status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        },
      });
      if (visits > 0)
        throw new ApiError(
          409,
          "NURSE_HAS_ACTIVE_ORDERS",
          `Сувилагчид ${visits} идэвхтэй үзлэг байна. Эхлээд өөр сувилагч томилно уу`,
          { activeVisits: String(visits) },
        );
    }
    await tx.user.update({
      where: { id },
      data: {
        ...(role !== undefined && { role }),
        ...(active !== undefined && {
          deletedAt: active ? null : (target.deletedAt ?? new Date()),
        }),
      },
    });
    // a deactivated account loses its sessions at once
    if (deactivating)
      await tx.refreshSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, role: true, deletedAt: true },
  });
  return ok(
    res,
    {
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        active: user.deletedAt === null,
      },
    },
    "Хадгалагдлаа",
  );
});

// POST /api/admin/users/:id/password: set a new password for a staff member
adminRoutes.post("/users/:id/password", async (req: StaffRequest, res) => {
  adminOnly(req);
  const p = z
    .object({ password: passwordSchema })
    .strict()
    .safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const id = String(req.params.id);
  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!target) throw new ApiError(404, "USER_NOT_FOUND", "Хэрэглэгч олдсонгүй");
  if (target.role === "CHILD")
    throw new ApiError(
      409,
      "CUSTOMER_NOT_MANAGED",
      "Захиалагчийн нууц үгийг энд өөрчлөхгүй",
    );
  await prisma.user.update({
    where: { id },
    data: { password: await bcrypt.hash(p.data.password, 10) },
  });
  return ok(res, { updated: true }, "Нууц үг шинэчлэгдлээ");
});
