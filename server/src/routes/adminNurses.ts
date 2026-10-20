// Nurse verification queue for the admin web (spec A-01). Mounted under
// /api/admin, so the super-admin guard in admin.ts already applies.
import { Router, Request } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "../db/db.config";
import { ApiError, ok, validationError } from "../utils/http";
import { SKILL_TAGS } from "../services/nurseProvision";
import {
  DOCUMENT_KINDS,
  RECOMMENDED_EXPERIENCE_YEARS,
  applicationState,
  missingItems,
  ubDate,
  ubEndOfDay,
} from "../services/nurseApplication";
import { sendDocument } from "./nurseApplication";

interface StaffRequest extends Request {
  user?: { userId: string; role: string };
}

export const adminNurses = Router();

const FILTERS = ["SUBMITTED", "VERIFIED", "REJECTED", "SUSPENDED", "DRAFT"] as const;
type Filter = (typeof FILTERS)[number];

const whereFor = (f: Filter): Prisma.NurseProfileWhereInput => {
  if (f === "SUBMITTED") return { status: "PENDING", submittedAt: { not: null } };
  if (f === "DRAFT") return { status: "PENDING", submittedAt: null };
  return { status: f };
};

const include = {
  user: { select: { name: true, phone: true, email: true, deletedAt: true } },
  documents: { select: { kind: true, createdAt: true } },
} as const;

type Row = Prisma.NurseProfileGetPayload<{ include: typeof include }>;

function serialize(p: Row, now: Date) {
  const docs = new Map(p.documents.map((d) => [d.kind, d.createdAt.toISOString()]));
  return {
    id: p.userId,
    state: applicationState(p),
    name: p.user.name,
    phone: p.user.phone,
    email: p.user.email,
    accountActive: p.user.deletedAt === null,
    licenseNo: p.licenseNo,
    licenseExpiresAt: p.licenseExpiresAt ? ubDate(p.licenseExpiresAt) : null,
    licenseExpired: !!p.licenseExpiresAt && p.licenseExpiresAt <= now,
    employer: p.employer,
    experienceYears: p.experienceYears,
    experienceBelowRecommended:
      p.experienceYears !== null && p.experienceYears < RECOMMENDED_EXPERIENCE_YEARS,
    skillTags: p.skillTags,
    isActive: p.isActive,
    submittedAt: p.submittedAt?.toISOString() ?? null,
    reviewNote: p.reviewNote,
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    documents: Object.fromEntries(DOCUMENT_KINDS.map((k) => [k, docs.get(k) ?? null])),
    missing: missingItems(p, p.user.name, now),
  };
}

// GET /api/admin/nurses?status=SUBMITTED|VERIFIED|REJECTED|SUSPENDED|DRAFT
adminNurses.get("/", async (req: StaffRequest, res) => {
  const status = String(req.query.status ?? "SUBMITTED");
  if (!(FILTERS as readonly string[]).includes(status))
    throw new ApiError(400, "VALIDATION_ERROR", "Төлөв буруу", { status: FILTERS.join(", ") });
  const filter = status as Filter;
  const now = new Date();
  const [rows, ...counts] = await Promise.all([
    prisma.nurseProfile.findMany({
      where: { ...whereFor(filter), user: { role: "NURSE" } },
      include,
      // the queue is first come first served; other lists newest first
      orderBy: filter === "SUBMITTED" ? { submittedAt: "asc" } : { updatedAt: "desc" },
      take: 200,
    }),
    ...FILTERS.map((f) =>
      prisma.nurseProfile.count({ where: { ...whereFor(f), user: { role: "NURSE" } } }),
    ),
  ]);
  return ok(
    res,
    {
      nurses: rows.map((r) => serialize(r, now)),
      counts: Object.fromEntries(FILTERS.map((f, i) => [f, counts[i]])),
    },
    "Сувилагчид",
  );
});

const loadNurse = async (id: string) => {
  const p = await prisma.nurseProfile.findUnique({ where: { userId: id }, include });
  if (!p) throw new ApiError(404, "NURSE_NOT_FOUND", "Сувилагч олдсонгүй");
  return p;
};

// GET /api/admin/nurses/:id: details + review history
adminNurses.get("/:id", async (req: StaffRequest, res) => {
  const p = await loadNurse(String(req.params.id));
  const events = await prisma.nurseReviewEvent.findMany({
    where: { nurseId: p.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(events.map((e) => e.actorId))] } },
    select: { id: true, name: true },
  });
  const actorName = new Map(actors.map((a) => [a.id, a.name]));
  return ok(
    res,
    {
      nurse: serialize(p, new Date()),
      history: events.map((e) => ({
        action: e.action,
        note: e.note,
        actor: e.actorId === p.userId ? "Сувилагч" : (actorName.get(e.actorId) ?? null),
        at: e.createdAt.toISOString(),
      })),
    },
    "Сувилагч",
  );
});

// GET /api/admin/nurses/:id/documents/:kind: the image itself (never a public URL)
adminNurses.get("/:id/documents/:kind", async (req: StaffRequest, res) => {
  await sendDocument(res, String(req.params.id), String(req.params.kind));
});

const approveSchema = z
  .object({
    // the admin checks these against the licence register and may correct them
    licenseNo: z.string().trim().min(1, "Дугаар оруулна уу").max(40),
    licenseExpiresAt: z.string().refine((v) => ubEndOfDay(v) !== null, "Огноо ОООО-СС-ӨӨ хэлбэртэй"),
    skillTags: z.array(z.enum(SKILL_TAGS)).min(1, "Хамгийн багадаа нэг ур чадвар сонгоно уу"),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

const reasonSchema = z
  .object({ reason: z.string().trim().min(5, "Шалтгааныг тодорхой бичнэ үү").max(500) })
  .strict();

const NURSE_BUSY = ["ASSIGNED", "EN_ROUTE", "IN_PROGRESS"] as const;

// POST /api/admin/nurses/:id/approve: SUBMITTED → VERIFIED, or SUSPENDED → VERIFIED again
adminNurses.post("/:id/approve", async (req: StaffRequest, res) => {
  const parsed = approveSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  const p = await loadNurse(String(req.params.id));
  const state = applicationState(p);
  if (state !== "SUBMITTED" && state !== "SUSPENDED")
    throw new ApiError(
      409,
      "INVALID_STATUS",
      state === "VERIFIED" ? "Аль хэдийн баталгаажсан" : "Сувилагч өргөдлөө илгээгээгүй байна",
    );
  if (p.user.deletedAt) throw new ApiError(409, "ACCOUNT_DISABLED", "Данс идэвхгүй байна");
  const now = new Date();
  const expires = ubEndOfDay(parsed.data.licenseExpiresAt)!;
  if (expires <= now)
    throw new ApiError(409, "INVALID_STATUS", "Зөвшөөрлийн хугацаа дууссан байна", {
      licenseExpiresAt: "Ирээдүйн огноо",
    });
  const missingDocs = DOCUMENT_KINDS.filter((k) => !p.documents.some((d) => d.kind === k));
  if (missingDocs.length > 0)
    throw new ApiError(409, "APPLICATION_INCOMPLETE", "Баримтын зураг дутуу байна");
  await prisma.$transaction([
    prisma.nurseProfile.update({
      where: { userId: p.userId },
      data: {
        status: "VERIFIED",
        licenseNo: parsed.data.licenseNo,
        licenseExpiresAt: expires,
        skillTags: parsed.data.skillTags,
        reviewNote: null,
        reviewedAt: now,
        reviewedById: req.user!.userId,
      },
    }),
    prisma.nurseReviewEvent.create({
      data: {
        nurseId: p.userId,
        actorId: req.user!.userId,
        action: "APPROVED",
        note: parsed.data.note || null,
      },
    }),
  ]);
  return ok(res, { nurse: serialize(await loadNurse(p.userId), now) }, "Сувилагч баталгаажлаа");
});

// POST /api/admin/nurses/:id/reject: SUBMITTED → REJECTED, the reason goes to the nurse
adminNurses.post("/:id/reject", async (req: StaffRequest, res) => {
  const parsed = reasonSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  const p = await loadNurse(String(req.params.id));
  if (applicationState(p) !== "SUBMITTED")
    throw new ApiError(409, "INVALID_STATUS", "Зөвхөн илгээсэн өргөдлийг татгалзана");
  const now = new Date();
  await prisma.$transaction([
    prisma.nurseProfile.update({
      where: { userId: p.userId },
      data: {
        status: "REJECTED",
        isActive: false,
        reviewNote: parsed.data.reason,
        reviewedAt: now,
        reviewedById: req.user!.userId,
      },
    }),
    prisma.nurseReviewEvent.create({
      data: { nurseId: p.userId, actorId: req.user!.userId, action: "REJECTED", note: parsed.data.reason },
    }),
  ]);
  return ok(res, { nurse: serialize(await loadNurse(p.userId), now) }, "Өргөдөл татгалзлаа");
});

// POST /api/admin/nurses/:id/suspend: VERIFIED → SUSPENDED (no new offers)
adminNurses.post("/:id/suspend", async (req: StaffRequest, res) => {
  const parsed = reasonSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  const p = await loadNurse(String(req.params.id));
  if (applicationState(p) !== "VERIFIED")
    throw new ApiError(409, "INVALID_STATUS", "Зөвхөн баталгаажсан сувилагчийг түдгэлзүүлнэ");
  // Visits already accepted stay with the nurse; the admin reassigns them if needed.
  const busy = await prisma.order.count({
    where: { assignedNurseId: p.userId, status: { in: [...NURSE_BUSY] } },
  });
  const now = new Date();
  await prisma.$transaction([
    prisma.nurseProfile.update({
      where: { userId: p.userId },
      data: {
        status: "SUSPENDED",
        isActive: false,
        reviewNote: parsed.data.reason,
        reviewedAt: now,
        reviewedById: req.user!.userId,
      },
    }),
    prisma.nurseReviewEvent.create({
      data: { nurseId: p.userId, actorId: req.user!.userId, action: "SUSPENDED", note: parsed.data.reason },
    }),
  ]);
  return ok(
    res,
    { nurse: serialize(await loadNurse(p.userId), now), activeOrders: busy },
    busy > 0
      ? `Түдгэлзүүллээ. Хүлээн авсан ${busy} дуудлага хэвээр байна`
      : "Сувилагчийг түдгэлзүүллээ",
  );
});
