import { Router, Request } from "express";
import { z } from "zod";
import prisma from "../db/db.config";
import { authenticateToken } from "../middlwares/auth";
import { ApiError, ok, validationError } from "../utils/http";
import { audit } from "../services/audit";
import { can } from "../services/permissions";
import { orderInclude, serializeOrder } from "../services/orders";
import { recordEarning } from "../services/payouts";
import { notifyAssignedNurse, notifyOrderStatus } from "../services/push";
interface StaffRequest extends Request {
  user?: { userId: string; role: string; adminRole?: string | null };
}
export const staffOrders = Router();
staffOrders.use(authenticateToken);
staffOrders.use(async (req: StaffRequest, _res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { role: true, adminRole: true, deletedAt: true },
  });
  if (
    !user ||
    user.deletedAt ||
    // NURSE: the OTOCH Nurse app (own orders only); ADMIN: the admin web,
    // every back-office role may see orders (spec slide 109)
    !(user.role === "NURSE" || (user.role === "ADMIN" && can(user.adminRole, "orders.view")))
  )
    throw new ApiError(403, "FORBIDDEN", "Staff эрх шаардлагатай");
  req.user!.role = user.role;
  req.user!.adminRole = user.adminRole;
  next();
});
const scope = (req: StaffRequest) =>
  req.user!.role === "NURSE" ? { assignedNurseId: req.user!.userId } : {};
/** A nurse sees only their average (GET /api/nurse/me), never who rated what. */
const view = (req: StaffRequest, order: Parameters<typeof serializeOrder>[0]) => {
  const o = serializeOrder(order);
  return req.user!.role === "NURSE" ? { ...o, rating: null, canRate: false } : o;
};
/** Assigning by hand: Ops and super-admin (spec slide 109). */
const administrator = (req: StaffRequest) => {
  if (req.user!.role !== "ADMIN" || !can(req.user!.adminRole, "orders.manage"))
    throw new ApiError(403, "FORBIDDEN", "Томилох эрх шаардлагатай");
};
const expected = z.object({ version: z.number().int().positive() }).strict();
const assign = expected.extend({ nurseId: z.string().min(1) });
const eta = expected.extend({
  eta: z.iso.datetime({ offset: true }).nullable(),
});
staffOrders.get("/nurses", async (req: StaffRequest, res) => {
  administrator(req);
  return ok(
    res,
    {
      nurses: await prisma.user.findMany({
        where: { role: "NURSE", deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    },
    "Сувилагчид",
  );
});
staffOrders.get("/", async (req: StaffRequest, res) => {
  const p = z.object({ cursor: z.string().optional() }).safeParse(req.query);
  if (!p.success) throw validationError(p.error);
  const rows = await prisma.order.findMany({
    where: scope(req),
    include: orderInclude,
    orderBy: { id: "desc" },
    take: 51,
    ...(p.data.cursor ? { cursor: { id: p.data.cursor }, skip: 1 } : {}),
  });
  return ok(
    res,
    {
      orders: rows
        .slice(0, 50)
        .map((o) => ({
          ...view(req, o),
          patientName: o.parent.name,
          isMock: o.payments?.[0]?.mode === "mock",
        })),
      nextCursor: rows.length > 50 ? rows[49].id : null,
      environment:
        process.env.APP_ENV === "staging-test" ? "staging-test" : "normal",
    },
    "Захиалгууд",
  );
});
staffOrders.get("/:id", async (req: StaffRequest, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, ...scope(req) },
    include: orderInclude,
  });
  if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Захиалга олдсонгүй");
  return ok(
    res,
    { order: { ...view(req, order), patientName: order.parent.name } },
    "Захиалга",
  );
});
for (const action of ["assign", "eta", "start", "complete"] as const)
  staffOrders.post("/:id/" + action, async (req: StaffRequest, res) => {
    const schema =
        action === "assign" ? assign : action === "eta" ? eta : expected,
      p = schema.safeParse(req.body);
    if (!p.success) throw validationError(p.error);
    if (action === "assign") administrator(req);
    else if (req.user!.role !== "NURSE")
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Зөвхөн томилогдсон сувилагч үйлдэл хийнэ",
      );
    const data = p.data as {
      version: number;
      nurseId?: string;
      eta?: string | null;
    };
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "Order" WHERE "id"=${req.params.id} FOR UPDATE`;
      const order = await tx.order.findFirst({
        where: { id: req.params.id, ...scope(req) },
        include: orderInclude,
      });
      if (!order)
        throw new ApiError(404, "ORDER_NOT_FOUND", "Захиалга олдсонгүй");
      if (order.version !== data.version)
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "Мэдээлэл шинэчлэгдсэн. Дахин ачаална уу",
        );
      const allowed =
        action === "assign"
          ? ["PAID", "ASSIGNED"]
          : action === "complete"
            ? ["IN_PROGRESS"]
            : action === "start"
              ? ["ASSIGNED"]
              : ["ASSIGNED", "EN_ROUTE", "IN_PROGRESS"];
      if (!allowed.includes(order.status) || order.redFlagStatus === "FLAGGED")
        throw new ApiError(
          409,
          "INVALID_STATUS",
          "Энэ төлөвт үйлдэл хийх боломжгүй",
        );
      // A visit started through the nurse app has a record that must be signed
      // (POST /api/nurse/orders/:id/finish) before the order can complete.
      if (action === "complete") {
        const record = await tx.visitRecord.findUnique({
          where: { orderId: order.id },
          select: { signedAt: true },
        });
        if (record && !record.signedAt)
          throw new ApiError(
            409,
            "RECORD_REQUIRED",
            "Эргэлтийн тэмдэглэлд гарын үсэг зурсны дараа дуусгана",
          );
      }
      if (
        action === "assign" &&
        !(await tx.user.findFirst({
          where: { id: data.nurseId!, role: "NURSE", deletedAt: null },
        }))
      )
        throw new ApiError(404, "NURSE_NOT_FOUND", "Сувилагч олдсонгүй");
      if (action === "eta" && data.eta && Date.parse(data.eta) <= Date.now())
        throw new ApiError(400, "VALIDATION_ERROR", "Ирээдүйн ETA оруулна уу");
      const next =
        action === "assign"
          ? "ASSIGNED"
          : action === "start"
            ? "IN_PROGRESS"
            : action === "complete"
              ? "COMPLETED"
              : order.status;
      await tx.order.update({
        where: { id: order.id },
        data: {
          version: { increment: 1 },
          status: next,
          ...(action === "assign"
            ? { assignedNurseId: data.nurseId!, eta: null }
            : action === "eta"
              ? { eta: data.eta ? new Date(data.eta) : null }
              : action === "complete"
                ? { eta: null }
                : {}),
        },
      });
      if (next === "COMPLETED") await recordEarning(tx, order.id);
      if (action === "assign")
        await audit(tx, {
          actorId: req.user!.userId,
          action: "ORDER_ASSIGNED",
          entity: "order",
          entityId: order.id,
          before: { status: order.status, nurseId: order.assignedNurseId },
          after: { status: "ASSIGNED", nurseId: data.nurseId! },
        });
      // A hand assignment ends any dispatch offers still open for this order.
      if (action === "assign")
        await tx.orderOffer.updateMany({
          where: { orderId: order.id, status: "PENDING" },
          data: { status: "CANCELLED", respondedAt: new Date() },
        });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: action.toUpperCase(),
          actorId: req.user!.userId,
          fromStatus: order.status,
          toStatus: next,
          metadata:
            action === "assign"
              ? { nurseId: data.nurseId! }
              : action === "eta"
                ? { eta: data.eta ?? null }
                : undefined,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
    });
    if (action !== "eta") void notifyOrderStatus(updated);
    if (action === "assign") void notifyAssignedNurse(data.nurseId!, updated.id);
    return ok(res, { order: view(req, updated) }, "Захиалга шинэчлэгдлээ");
  });
