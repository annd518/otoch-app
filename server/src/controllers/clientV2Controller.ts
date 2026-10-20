import { serviceConfig } from "../services/serviceMetadata";
import { recordPdf } from "../services/recordPdf";
import { Request, Response, Router } from "express";
import prisma from "../db/db.config";
import { ApiError, ok, validationError } from "../utils/http";
import { z } from "zod";
import { authenticateToken } from "../middlwares/auth";
import { requireRole } from "../middlwares/rbac";
interface AuthRequest extends Request {
  user?: { userId: string };
}
const query = z.object({
  zoneId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceCode: z.string().min(1),
});
export const clientV2Routes = Router();
clientV2Routes.use(authenticateToken, requireRole(["CHILD"]));
clientV2Routes.put("/profile", async (req: AuthRequest, res: Response) => {
  const parsed = z
    .object({ name: z.string().trim().min(2).max(100) })
    .safeParse(req.body);
  if (!parsed.success) throw validationError(parsed.error);
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { name: parsed.data.name },
    select: { id: true, name: true, email: true, role: true },
  });
  return ok(res, { user }, "Профайл хадгалагдлаа");
});
clientV2Routes.get("/zones", async (_req, res) => {
  const zones = await prisma.serviceZone.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return ok(res, { zones }, "Үйлчлэх бүс");
});
clientV2Routes.get("/availability", async (req, res) => {
  const parsed = query.safeParse(req.query);
  if (!parsed.success) throw validationError(parsed.error);
  const { zoneId, date, serviceCode } = parsed.data;
  const dateStart = new Date(`${date}T00:00:00+08:00`);
  if (
    !Number.isFinite(dateStart.getTime()) ||
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ulaanbaatar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dateStart) !== date
  )
    throw new ApiError(400, "VALIDATION_ERROR", "Огноо буруу байна");
  const service = await prisma.serviceCatalogItem.findFirst({
    where: { code: serviceCode, isActive: true },
  });
  if (!service) throw new ApiError(404, "NOT_FOUND", "Үйлчилгээ олдсонгүй");
  const slots = await prisma.availabilitySlot.findMany({
    where: {
      zoneId,
      zone: { isActive: true },
      startsAt: {
        gte: new Date(
          Math.max(Date.parse(`${date}T00:00:00+08:00`), Date.now() + 7200000),
        ),
        lt: new Date(`${date}T23:59:59+08:00`),
      },
    },
    orderBy: { startsAt: "asc" },
  });
  const windowMin = /^S\d{2}$/.test(serviceCode)
    ? serviceConfig(service).windowMin
    : 60;
  const available = [];
  for (const s of slots) {
    if ((s.endsAt.getTime() - s.startsAt.getTime()) / 60000 < windowMin)
      continue;
    const booked = await prisma.order.count({
      where: {
        zoneId,
        scheduledFor: s.startsAt,
        status: { in: ["AWAITING_PAYMENT", "PAID", "ASSIGNED", "IN_PROGRESS"] },
      },
    });
    if (booked < s.capacity)
      available.push({
        id: s.id,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        available: true,
      });
  }
  return ok(res, { slots: available }, "Сул цаг");
});
// Signed nurse records are shared with the booking owner only after completion.
// Signing is not a medical-admin approval; never expose signature images or draft notes.
const completedNurseRecords = (userId: string) =>
  prisma.visitRecord.findMany({
    where: {
      signedAt: { not: null },
      order: { childId: userId, status: "COMPLETED" },
    },
    select: {
      orderId: true,
      signedAt: true,
      note: true,
      vitals: true,
      procedures: true,
      order: {
        select: {
          parent: { select: { name: true } },
          assignedNurse: { select: { name: true } },
        },
      },
    },
    orderBy: { signedAt: "desc" },
    take: 100,
  });
clientV2Routes.get("/records", async (req: AuthRequest, res: Response) => {
  res.setHeader("Cache-Control", "private, no-store");
  // Legacy clinician-approved notes and separately labeled signed nurse records.
  const visits = await prisma.visit.findMany({
    where: {
      Parent: { children: { some: { id: req.user!.userId } } },
      status: { in: ["APPROVED", "COMPLETED"] },
      approvedAt: { not: null },
      vitals: { isNot: null },
    },
    include: { vitals: true, Parent: { select: { name: true } } },
    orderBy: { scheduledFor: "desc" },
    take: 100,
  });
  return ok(
    res,
    {
      records: [
        ...visits.map((v) => ({
          id: v.id,
          patientName: v.Parent.name,
          at: v.scheduledFor.toISOString(),
          notes: v.vitals?.notes ?? v.notes,
          vitals: v.vitals,
          pdfAvailable: true,
          source: "legacy" as const,
        })),
        ...(await completedNurseRecords(req.user!.userId)).map((r) => ({
          id: `order:${r.orderId}`,
          orderId: r.orderId,
          source: "nurse" as const,
          patientName: r.order.parent.name,
          at: r.signedAt!.toISOString(),
          notes: r.note,
          vitals: r.vitals,
          procedures: r.procedures,
          nurseName: r.order.assignedNurse?.name ?? null,
          pdfAvailable: true,
        })),
      ]
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, 100),
    },
    "Тэмдэглэл",
  );
});
clientV2Routes.get(
  "/records/:id/pdf",
  async (req: AuthRequest, res: Response) => {
    if (req.params.id.startsWith("order:")) {
      const record = await prisma.visitRecord.findFirst({
        where: {
          orderId: req.params.id.slice(6),
          signedAt: { not: null },
          order: { childId: req.user!.userId, status: "COMPLETED" },
        },
        select: {
          signedAt: true,
          note: true,
          vitals: true,
          procedures: true,
          order: {
            select: {
              parent: { select: { name: true } },
              assignedNurse: { select: { name: true } },
            },
          },
        },
      });
      if (!record) throw new ApiError(404, "NOT_FOUND", "Тэмдэглэл олдсонгүй");
      const labels: Record<string, string> = {
        systolic: "Дээд даралт",
        diastolic: "Доод даралт",
        pulse: "Судасны цохилт",
        temperatureC: "Халуун",
        spo2: "Хүчилтөрөгч",
      };
      const lines = [
        "ОТОЧ · Сувилагчийн эргэлтийн тэмдэглэл",
        record.order.parent.name,
        `Гарын үсгээр баталгаажсан: ${record.signedAt!.toISOString()}`,
        `Сувилагч: ${record.order.assignedNurse?.name ?? "Мэдээлэлгүй"}`,
        record.note ?? "Бичгэн тэмдэглэл ороогүй",
        ...Object.entries((record.vitals ?? {}) as Record<string, unknown>).map(
          ([k, v]) => `${labels[k] ?? k}: ${v}`,
        ),
        `Ажилбар: ${(record.procedures as string[]).join(", ")}`,
        "Энэ нь эмчийн онош, эмнэлгийн админы баталгаа биш.",
      ];
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="otoch-nurse-record.pdf"',
      );
      return res.send(Buffer.from(await recordPdf(lines)));
    }
    const visit = await prisma.visit.findFirst({
      where: {
        id: req.params.id,
        Parent: { children: { some: { id: req.user!.userId } } },
        status: { in: ["APPROVED", "COMPLETED"] },
        approvedAt: { not: null },
        vitals: { isNot: null },
      },
      include: { vitals: true, Parent: { select: { name: true } } },
    });
    if (!visit) throw new ApiError(404, "NOT_FOUND", "Тэмдэглэл олдсонгүй");
    const lines = [
      "OTOCH · Сувилахуйн тэмдэглэл",
      visit.Parent.name,
      visit.scheduledFor.toISOString(),
      visit.vitals?.notes ?? visit.notes ?? "Бичгэн тэмдэглэл ороогүй",
      ...Object.entries(visit.vitals ?? {})
        .filter(
          ([k, v]) =>
            [
              "bp",
              "sugar",
              "pulse",
              "oxygen",
              "temperature",
              "medicines",
            ].includes(k) && v !== null,
        )
        .map(
          ([k, v]) =>
            `${({ bp: "Даралт", sugar: "Сахар", pulse: "Судасны цохилт", oxygen: "Хүчилтөрөгч", temperature: "Халуун", medicines: "Эм" } as Record<string, string>)[k]}: ${v}`,
        ),
    ];
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="otoch-record.pdf"',
    );
    return res.send(Buffer.from(await recordPdf(lines)));
  },
);
clientV2Routes.post(
  "/account/deletion-request",
  async (req: AuthRequest, res: Response) => {
    // Preserve clinical/payment retention records. No irreversible deletion here.
    const request = await prisma.accountDeletionRequest.upsert({
      where: { userId: req.user!.userId },
      create: { userId: req.user!.userId },
      update: {},
    });
    return ok(
      res,
      { id: request.id, status: request.status },
      "Данс устгах хүсэлт бүртгэгдлээ. Хадгалалтын шаардлагын дагуу шийдвэрлэнэ.",
    );
  },
);
