// Nurse-side visit flow for the nurse app (docs/nurse-app-api-proposal.md).
// Every route is scoped to orders assigned to the signed-in nurse; anything
// else answers 404. State changes carry the order `version` (optimistic lock).
import { Router, Request } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "../db/db.config";
import { authenticateToken } from "../middlwares/auth";
import { ApiError, ok, validationError } from "../utils/http";
import { orderInclude, serializeOrder } from "../services/orders";
import { getStorage } from "../services/storage";
import { notifyOrderStatus } from "../services/push";

interface NurseRequest extends Request {
  user?: { userId: string; role: string };
}
type Tx = Prisma.TransactionClient;
type LockedOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export const nurseOrders = Router();
/** Signed-in NURSE, role and account state read from the database on every request. */
export const requireNurse = async (
  req: NurseRequest,
  _res: unknown,
  next: () => void,
) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { role: true, deletedAt: true },
  });
  // Same answer as requireRole: a deactivated or removed account ends the app session (401).
  if (!user || user.deletedAt)
    throw new ApiError(
      401,
      "ACCOUNT_DISABLED",
      "Бүртгэл идэвхгүй байна. Админд хандана уу",
    );
  if (user.role !== "NURSE")
    throw new ApiError(403, "FORBIDDEN", "Сувилагчийн эрх шаардлагатай");
  next();
};
nurseOrders.use(authenticateToken);
nurseOrders.use(requireNurse);

/** Check-in needs the nurse within this distance of the booked address (spec slide 70). */
export const CHECKIN_MAX_DISTANCE_M = 200;
/** ... and within this many minutes of the booked start (spec slide 70). */
export const CHECKIN_WINDOW_MIN = 30;
export const SIGNATURE_MAX_CHARS = 140_000; // about 100 KB of PNG
export const REJECT_REASONS = [
  "NO_REFERRAL",
  "MED_EXPIRED",
  "NAME_MISMATCH",
  "FIRST_DOSE",
] as const;

const ACTIVE = ["ASSIGNED", "EN_ROUTE", "IN_PROGRESS"] as const;
const isActive = (status: string) =>
  (ACTIVE as readonly string[]).includes(status);

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

const version = z.number().int().positive();
const lockOnly = z.object({ version }).strict();
const checkinBody = z
  .object({
    version,
    method: z.literal("GEO"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    checklist: z
      .object({
        identified: z.literal(true),
        hygiene: z.literal(true),
        medicationChecked: z.literal(true),
      })
      .strict(),
  })
  .strict();
export const vitalsSchema = z
  .object({
    systolic: z.number().int().min(50).max(260),
    diastolic: z.number().int().min(30).max(160),
    pulse: z.number().int().min(20).max(220),
    temperatureC: z.number().min(30).max(43),
    spo2: z.number().int().min(50).max(100),
  })
  .partial()
  .strict()
  .refine(
    (v) =>
      v.systolic === undefined ||
      v.diastolic === undefined ||
      v.diastolic < v.systolic,
    { message: "Дээд даралт доод даралтаас их байх ёстой", path: ["diastolic"] },
  );
const MED_KEYS = ["patient", "medicine", "dose", "route", "time"] as const;
const medicationChecksSchema = z
  .object({
    patient: z.boolean(),
    medicine: z.boolean(),
    dose: z.boolean(),
    route: z.boolean(),
    time: z.boolean(),
  })
  .strict();
const recordBody = z
  .object({
    vitals: vitalsSchema,
    procedures: z.array(z.string().trim().min(1).max(40)).max(20),
    medicationChecks: medicationChecksSchema,
    note: z.string().max(2000),
  })
  .partial()
  .strict();
const finishBody = z
  .object({
    version,
    signerName: z.string().trim().min(2).max(80),
    signature: z
      .string()
      .max(SIGNATURE_MAX_CHARS)
      .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/),
  })
  .strict();
const rejectBody = z
  .object({
    version,
    reason: z.enum(REJECT_REASONS),
    comment: z.string().trim().max(500).optional(),
  })
  .strict();
const incidentBody = z
  .object({ version, description: z.string().trim().min(3).max(1000) })
  .strict();

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const p = schema.safeParse(body);
  if (!p.success) throw validationError(p.error);
  return p.data;
}

async function loadOwned(tx: Tx, id: string, nurseId: string) {
  await tx.$executeRaw`SELECT 1 FROM "Order" WHERE "id"=${id} FOR UPDATE`;
  const order = await tx.order.findFirst({
    where: { id, assignedNurseId: nurseId },
    include: orderInclude,
  });
  if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Захиалга олдсонгүй");
  return order;
}

function assertVersion(order: LockedOrder, expected: number) {
  if (order.version !== expected)
    throw new ApiError(
      409,
      "VERSION_CONFLICT",
      "Мэдээлэл шинэчлэгдсэн. Дахин ачаална уу",
    );
}

function assertFrom(order: LockedOrder, from: readonly string[]) {
  if (!from.includes(order.status))
    throw new ApiError(
      409,
      "INVALID_STATUS",
      "Энэ төлөвт үйлдэл хийх боломжгүй",
    );
}

const assertNotFlagged = (order: LockedOrder) => {
  if (order.redFlagStatus === "FLAGGED")
    throw new ApiError(
      409,
      "INVALID_STATUS",
      "Энэ төлөвт үйлдэл хийх боломжгүй",
    );
};

/** Runs one version-locked status change for the nurse and returns the order. */
async function transition(
  req: NurseRequest,
  opts: {
    expected: number;
    from: readonly string[];
    to: LockedOrder["status"];
    event: string;
    metadata?: Prisma.InputJsonValue;
    guard?: (order: LockedOrder, tx: Tx) => void | Promise<void>;
    write?: (order: LockedOrder, tx: Tx) => Promise<unknown>;
  },
) {
  const nurseId = req.user!.userId;
  const updated = await prisma.$transaction(async (tx) => {
    const order = await loadOwned(tx, req.params.id as string, nurseId);
    assertVersion(order, opts.expected);
    assertFrom(order, opts.from);
    await opts.guard?.(order, tx);
    await opts.write?.(order, tx);
    await tx.order.update({
      where: { id: order.id },
      data: { version: { increment: 1 }, status: opts.to, eta: null },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: opts.event,
        actorId: nurseId,
        fromStatus: order.status,
        toStatus: opts.to,
        metadata: opts.metadata,
      },
    });
    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });
  });
  // the customer hears about it after the commit (never blocks the nurse)
  void notifyOrderStatus(updated);
  return updated;
}

const view = (order: LockedOrder) => ({
  ...serializeOrder(order),
  // A nurse sees only the average (GET /api/nurse/me), not who rated what
  rating: null,
  canRate: false,
  patientName: order.parent.name,
  // Phone for the "call" button; only while the visit is still ahead of or in progress.
  patientContact: isActive(order.status) ? order.parent.emergencyContact : null,
});

const serializeRecord = (
  r: Prisma.VisitRecordGetPayload<object> | null,
) =>
  r
    ? {
        checkinAt: r.checkinAt?.toISOString() ?? null,
        checkinDistanceM: r.checkinDistanceM,
        vitals: r.vitals,
        procedures: r.procedures ?? [],
        medicationChecks: r.medicationChecks,
        note: r.note,
        signed: r.signedAt !== null,
        signedAt: r.signedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
      }
    : null;

nurseOrders.get("/:id", async (req: NurseRequest, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, assignedNurseId: req.user!.userId },
    include: orderInclude,
  });
  if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Захиалга олдсонгүй");
  return ok(res, { order: view(order) }, "Захиалга");
});

nurseOrders.post("/:id/en-route", async (req: NurseRequest, res) => {
  const body = parse(lockOnly, req.body);
  const order = await transition(req, {
    expected: body.version,
    from: ["ASSIGNED"],
    to: "EN_ROUTE",
    event: "EN_ROUTE",
    guard: assertNotFlagged,
  });
  return ok(res, { order: view(order) }, "Замдаа гарлаа");
});

/**
 * ⚑ How long the nurse waits at the address after the booked start before
 * reporting a no-show. The spec (slide 25) gives the outcome (no refund), not
 * the wait; 15 minutes matches the arrival window (±15 min).
 */
export const NO_SHOW_WAIT_MIN = 15;
const noShowBody = z
  .object({
    version,
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict();

// The nurse is at the address and nobody is there (spec slide 25: NO_SHOW_CLIENT).
nurseOrders.post("/:id/no-show", async (req: NurseRequest, res) => {
  const body = parse(noShowBody, req.body);
  const order = await transition(req, {
    expected: body.version,
    from: ["ASSIGNED", "EN_ROUTE"],
    to: "NO_SHOW",
    event: "NO_SHOW",
    metadata: { lat: body.lat, lng: body.lng },
    guard: (o) => {
      if (o.scheduledFor && Date.now() < o.scheduledFor.getTime() + NO_SHOW_WAIT_MIN * 60_000)
        throw new ApiError(
          422,
          "CHECKIN_TIME_WINDOW",
          `Товлосон цагаас хойш ${NO_SHOW_WAIT_MIN} минут хүлээсний дараа бүртгэнэ`,
        );
      if (o.lat !== null && o.lng !== null) {
        const d = distanceMeters(body, { lat: o.lat, lng: o.lng });
        if (d > CHECKIN_MAX_DISTANCE_M)
          throw new ApiError(
            422,
            "CHECKIN_TOO_FAR",
            `Үйлчлүүлэгчийн хаягаас ${CHECKIN_MAX_DISTANCE_M} м-ийн дотор байж бүртгэнэ`,
          );
      }
    },
  });
  return ok(res, { order: view(order) }, "Үйлчлүүлэгч байхгүй гэж бүртгэлээ");
});

const releaseBody = z
  .object({ version, reason: z.string().trim().min(3, "Шалтгаан бичнэ үү").max(300) })
  .strict();

// The nurse withdraws before the visit (spec slide 25: REASSIGNING): the order
// goes back to dispatch, this nurse is not asked again, the customer pays nothing extra.
nurseOrders.post("/:id/release", async (req: NurseRequest, res) => {
  const body = parse(releaseBody, req.body);
  const nurseId = req.user!.userId;
  const order = await transition(req, {
    expected: body.version,
    from: ["ASSIGNED", "EN_ROUTE"],
    to: "PAID",
    event: "NURSE_RELEASE",
    metadata: { nurseId, reason: body.reason },
    write: async (o, tx) => {
      await tx.order.update({ where: { id: o.id }, data: { assignedNurseId: null } });
      // dispatch skips nurses who already have an offer row for this order
      await tx.orderOffer.upsert({
        where: { orderId_nurseId: { orderId: o.id, nurseId } },
        create: { orderId: o.id, nurseId, wave: 0, status: "DECLINED", expiresAt: new Date(), respondedAt: new Date() },
        update: { status: "DECLINED", respondedAt: new Date() },
      });
    },
  });
  return ok(res, { released: true, orderId: order.id }, "Дуудлагаас гарлаа. Өөр сувилагч руу шилжүүлнэ");
});

nurseOrders.post("/:id/checkin", async (req: NurseRequest, res) => {
  const body = parse(checkinBody, req.body);
  const order = await transition(req, {
    expected: body.version,
    from: ["ASSIGNED", "EN_ROUTE"],
    to: "IN_PROGRESS",
    event: "CHECKIN",
    metadata: { method: body.method },
    guard: (o) => {
      assertNotFlagged(o);
      if (o.scheduledFor) {
        const offsetMin = Math.abs(Date.now() - o.scheduledFor.getTime()) / 60_000;
        if (offsetMin > CHECKIN_WINDOW_MIN)
          throw new ApiError(
            422,
            "CHECKIN_TIME_WINDOW",
            `Товлосон цагаас ${CHECKIN_WINDOW_MIN} минутын дотор л эхлүүлнэ`,
          );
      }
      if (o.lat !== null && o.lng !== null) {
        const d = distanceMeters(body, { lat: o.lat, lng: o.lng });
        if (d > CHECKIN_MAX_DISTANCE_M)
          throw new ApiError(
            422,
            "CHECKIN_TOO_FAR",
            `Үйлчлүүлэгчийн хаягаас ${CHECKIN_MAX_DISTANCE_M} м-ийн дотор очиж эхлүүлнэ`,
          );
      }
    },
    write: (o, tx) => {
      const distance =
        o.lat !== null && o.lng !== null
          ? distanceMeters(body, { lat: o.lat, lng: o.lng })
          : null;
      const data = {
        checkinAt: new Date(),
        checkinMethod: body.method,
        checkinLat: body.lat,
        checkinLng: body.lng,
        checkinDistanceM: distance,
        checklist: body.checklist,
      };
      return tx.visitRecord.upsert({
        where: { orderId: o.id },
        create: { orderId: o.id, nurseId: req.user!.userId, ...data },
        update: data,
      });
    },
  });
  return ok(res, { order: view(order) }, "Эргэлт эхэллээ");
});

nurseOrders.get("/:id/record", async (req: NurseRequest, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, assignedNurseId: req.user!.userId },
    select: { id: true, visitRecord: true },
  });
  if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Захиалга олдсонгүй");
  return ok(res, { record: serializeRecord(order.visitRecord) }, "Тэмдэглэл");
});

// Autosave. No version lock: only the assigned nurse writes, and only while in progress.
nurseOrders.put("/:id/record", async (req: NurseRequest, res) => {
  const body = parse(recordBody, req.body);
  const nurseId = req.user!.userId;
  const record = await prisma.$transaction(async (tx) => {
    const order = await loadOwned(tx, req.params.id as string, nurseId);
    assertFrom(order, ["IN_PROGRESS"]);
    const data = {
      ...(body.vitals !== undefined && { vitals: body.vitals }),
      ...(body.procedures !== undefined && { procedures: body.procedures }),
      ...(body.medicationChecks !== undefined && {
        medicationChecks: body.medicationChecks,
      }),
      ...(body.note !== undefined && { note: body.note }),
    };
    return tx.visitRecord.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, nurseId, ...data },
      update: data,
    });
  });
  return ok(res, { record: serializeRecord(record) }, "Хадгалагдлаа");
});

nurseOrders.post("/:id/finish", async (req: NurseRequest, res) => {
  const body = parse(finishBody, req.body);
  const order = await transition(req, {
    expected: body.version,
    from: ["IN_PROGRESS"],
    to: "COMPLETED",
    event: "FINISH",
    guard: async (o, tx) => {
      const record = await tx.visitRecord.findUnique({
        where: { orderId: o.id },
      });
      const fields: Record<string, string> = {};
      const vitals = (record?.vitals ?? {}) as Record<string, unknown>;
      if (Object.keys(vitals).length === 0)
        fields.vitals = "Амин үзүүлэлт оруулна уу";
      const procedures = Array.isArray(record?.procedures)
        ? record.procedures
        : [];
      if (procedures.length === 0)
        fields.procedures = "Хийсэн ажилбараа сонгоно уу";
      const hasMedication =
        (o.bookingForm as { medication?: unknown } | null)?.medication != null;
      if (hasMedication) {
        const checks = (record?.medicationChecks ?? {}) as Record<
          string,
          unknown
        >;
        if (!MED_KEYS.every((k) => checks[k] === true))
          fields.medicationChecks = "Эм, заалтыг 5 зөв дээр шалгана уу";
      }
      if (Object.keys(fields).length > 0)
        throw new ApiError(
          422,
          "RECORD_INCOMPLETE",
          "Тэмдэглэл дутуу байна",
          fields,
        );
    },
    write: (o, tx) =>
      tx.visitRecord.update({
        where: { orderId: o.id },
        data: {
          signerName: body.signerName,
          signature: body.signature,
          signedAt: new Date(),
        },
      }),
  });
  return ok(res, { order: view(order) }, "Эргэлт дууслаа");
});

nurseOrders.post("/:id/reject", async (req: NurseRequest, res) => {
  const body = parse(rejectBody, req.body);
  const order = await transition(req, {
    expected: body.version,
    from: ACTIVE,
    to: "REFUSED",
    event: "REJECT",
    metadata: { reason: body.reason, comment: body.comment ?? null },
  });
  return ok(res, { order: view(order) }, "Татгалзлаа");
});

nurseOrders.post("/:id/incident", async (req: NurseRequest, res) => {
  const body = parse(incidentBody, req.body);
  const order = await transition(req, {
    expected: body.version,
    from: ACTIVE,
    to: "INCIDENT",
    event: "INCIDENT",
    metadata: { description: body.description },
  });
  return ok(res, { order: view(order) }, "Осол бүртгэгдлээ");
});

// The referral photo, for the assigned nurse while the visit is still open.
nurseOrders.get(
  "/:id/attachments/:attachmentId/content",
  async (req: NurseRequest, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, assignedNurseId: req.user!.userId },
      include: orderInclude,
    });
    const attachment = order?.attachments.find(
      (a) => a.id === req.params.attachmentId,
    );
    if (!order || !attachment || !isActive(order.status))
      throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Файл олдсонгүй");
    const storage = getStorage();
    if (!storage || storage.driver !== attachment.storageDriver)
      throw new ApiError(
        503,
        "STORAGE_UNAVAILABLE",
        "Файл хадгалсан сан одоо ашиглах боломжгүй",
      );
    const data = await storage.get(attachment.storageKey);
    if (!data) throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Файл олдсонгүй");
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Length", String(data.length));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    res.status(200).end(data);
  },
);
