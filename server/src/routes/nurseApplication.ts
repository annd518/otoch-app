// The nurse's own application (spec N-01): details + four document photos, then
// "send". An admin reviews it in the admin web (routes/adminNurses.ts).
import { Router, Request, Response } from "express";
import { createHash, randomUUID } from "node:crypto";
import type { UploadedFile } from "express-fileupload";
import { z } from "zod";
import prisma from "../db/db.config";
import { authenticateToken } from "../middlwares/auth";
import { ApiError, ok, validationError } from "../utils/http";
import { detectDocumentType, getStorage } from "../services/storage";
import { UB_DISTRICTS } from "../services/ubDistricts";
import {
  DOCUMENT_KINDS,
  applicationState,
  isEditable,
  missingItems,
  ubDate,
  ubEndOfDay,
  type DocumentKind,
} from "../services/nurseApplication";
import { requireNurse } from "./nurseOrders";

interface NurseRequest extends Request {
  user?: { userId: string; role: string };
}

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

export const nurseApplication = Router();
nurseApplication.use(authenticateToken);
nurseApplication.use(requireNurse);

export function requireStorage() {
  const storage = getStorage();
  if (!storage)
    throw new ApiError(
      503,
      "STORAGE_UNAVAILABLE",
      "Файл хадгалах сан тохируулагдаагүй байна. Түр хүлээнэ үү",
    );
  return storage;
}

/** Streams one stored document; used by the nurse and by the admin. */
export async function sendDocument(res: Response, nurseId: string, kind: string) {
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind))
    throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Баримт олдсонгүй");
  const doc = await prisma.nurseDocument.findUnique({
    where: { nurseId_kind: { nurseId, kind: kind as DocumentKind } },
  });
  if (!doc) throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Баримт олдсонгүй");
  const storage = requireStorage();
  if (storage.driver !== doc.storageDriver)
    throw new ApiError(503, "STORAGE_UNAVAILABLE", "Файл хадгалсан сан одоо ашиглах боломжгүй");
  const data = await storage.get(doc.storageKey);
  if (!data) throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Баримт олдсонгүй");
  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Length", String(data.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  res.status(200).end(data);
}

const loadProfile = async (userId: string) => {
  // Accounts made before applications existed may have no profile yet.
  await prisma.nurseProfile.upsert({
    where: { userId },
    create: { userId, skillTags: [], zoneIds: [] },
    update: {},
  });
  return prisma.nurseProfile.findUniqueOrThrow({
    where: { userId },
    include: {
      documents: { select: { kind: true, createdAt: true } },
      user: { select: { name: true, phone: true } },
    },
  });
};

type LoadedProfile = Awaited<ReturnType<typeof loadProfile>>;

export function serializeApplication(p: LoadedProfile, now = new Date()) {
  const docs = new Map(p.documents.map((d) => [d.kind, d.createdAt.toISOString()]));
  return {
    state: applicationState(p),
    editable: isEditable(p),
    name: p.user.name,
    phone: p.user.phone,
    licenseNo: p.licenseNo,
    licenseExpiresAt: p.licenseExpiresAt ? ubDate(p.licenseExpiresAt) : null,
    employer: p.employer,
    experienceYears: p.experienceYears,
    submittedAt: p.submittedAt?.toISOString() ?? null,
    reviewNote: p.reviewNote,
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    districts: p.districts,
    documents: Object.fromEntries(DOCUMENT_KINDS.map((k) => [k, docs.get(k) ?? null])),
    missing: missingItems(p, p.user.name, now),
  };
}

const assertEditable = (p: LoadedProfile) => {
  if (!isEditable(p))
    throw new ApiError(
      409,
      "APPLICATION_LOCKED",
      applicationState(p) === "SUBMITTED"
        ? "Өргөдөл админд илгээгдсэн. Шийдвэр гартал өөрчлөх боломжгүй"
        : "Баталгаажсан бүртгэлийг өөрчлөхийн тулд админд хандана уу",
    );
};

// GET /api/nurse/application
nurseApplication.get("/", async (req: NurseRequest, res) => {
  const p = await loadProfile(req.user!.userId);
  return ok(res, { application: serializeApplication(p) }, "Бүртгэлийн өргөдөл");
});

/** One or more Ulaanbaatar districts, no duplicates (kept in the list order). */
export const districtsSchema = z
  .array(z.enum(UB_DISTRICTS))
  .min(1, "Хамгийн багадаа нэг дүүрэг сонгоно уу")
  .transform((v) => UB_DISTRICTS.filter((d) => v.includes(d)));

const detailsSchema = z
  .object({
    name: z.string().trim().min(2, "Нэр хамгийн багадаа 2 тэмдэгт").max(100).optional(),
    licenseNo: z.string().trim().min(1, "Дугаар оруулна уу").max(40).optional(),
    licenseExpiresAt: z
      .string()
      .refine((v) => ubEndOfDay(v) !== null, "Огноо ОООО-СС-ӨӨ хэлбэртэй")
      .optional(),
    employer: z.string().trim().min(2, "Ажлын газар оруулна уу").max(200).optional(),
    experienceYears: z.number().int().min(0).max(60).optional(),
    districts: districtsSchema.optional(),
  })
  .strict();

// PUT /api/nurse/application: save details (a draft or a rejected application)
nurseApplication.put("/", async (req: NurseRequest, res) => {
  const parsed = detailsSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  const userId = req.user!.userId;
  assertEditable(await loadProfile(userId));
  const { name, licenseExpiresAt, ...rest } = parsed.data;
  await prisma.$transaction(async (tx) => {
    if (name !== undefined) await tx.user.update({ where: { id: userId }, data: { name } });
    await tx.nurseProfile.update({
      where: { userId },
      data: {
        ...rest,
        ...(licenseExpiresAt !== undefined && { licenseExpiresAt: ubEndOfDay(licenseExpiresAt) }),
      },
    });
  });
  return ok(res, { application: serializeApplication(await loadProfile(userId)) }, "Хадгалагдлаа");
});

// POST /api/nurse/application/documents (multipart: file, kind). Replaces that kind.
nurseApplication.post("/documents", async (req: NurseRequest, res) => {
  const userId = req.user!.userId;
  assertEditable(await loadProfile(userId));
  const kind = String(req.body?.kind ?? "");
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind))
    throw new ApiError(400, "VALIDATION_ERROR", "Баримтын төрөл буруу", {
      kind: DOCUMENT_KINDS.join(", "),
    });
  const raw = req.files?.file;
  if (!raw || Array.isArray(raw))
    throw new ApiError(400, "VALIDATION_ERROR", "Нэг зураг сонгоно уу", { file: "Шаардлагатай" });
  const file = raw as UploadedFile;
  if (file.truncated || file.size > MAX_DOCUMENT_BYTES)
    throw new ApiError(413, "FILE_TOO_LARGE", "Файл 10 MB-аас их байна");
  const mimeType = detectDocumentType(file.data);
  if (!mimeType)
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Зөвхөн JPEG, PNG зураг эсвэл PDF файл илгээнэ");
  const storage = requireStorage();

  const storageKey = `nurses/${userId}/${randomUUID()}.${EXT[mimeType]}`;
  // Registered first: a blob whose row never commits is removed by the cleanup job.
  await prisma.blobCleanupJob.create({ data: { storageKey, storageDriver: storage.driver } });
  try {
    await storage.put(storageKey, file.data);
  } catch {
    throw new ApiError(503, "STORAGE_UNAVAILABLE", "Зураг хадгалах үйлчилгээ түр боломжгүй байна");
  }
  const data = {
    storageDriver: storage.driver,
    storageKey,
    mimeType,
    sizeBytes: file.data.length,
    sha256: createHash("sha256").update(file.data).digest("hex"),
  };
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "NurseProfile" WHERE "userId" = ${userId} FOR UPDATE`;
    const current = await tx.nurseProfile.findUniqueOrThrow({ where: { userId } });
    if (!isEditable(current))
      throw new ApiError(409, "APPLICATION_LOCKED", "Өргөдлийг одоо өөрчлөх боломжгүй");
    const where = { nurseId_kind: { nurseId: userId, kind: kind as DocumentKind } };
    const old = await tx.nurseDocument.findUnique({ where });
    if (old) {
      await tx.nurseDocument.delete({ where });
      // the replaced image is no longer referenced; the cleanup job removes it
      await tx.blobCleanupJob.upsert({
        where: { storageKey: old.storageKey },
        create: { storageKey: old.storageKey, storageDriver: old.storageDriver },
        update: { completedAt: null },
      });
    }
    await tx.nurseDocument.create({ data: { nurseId: userId, kind: kind as DocumentKind, ...data } });
  });
  return ok(
    res,
    { application: serializeApplication(await loadProfile(userId)) },
    "Зураг хадгалагдлаа",
    201,
  );
});

// GET /api/nurse/application/documents/:kind: the nurse's own image
nurseApplication.get("/documents/:kind", async (req: NurseRequest, res) => {
  await sendDocument(res, req.user!.userId, String(req.params.kind));
});

// POST /api/nurse/application/submit: send to the admin
nurseApplication.post("/submit", async (req: NurseRequest, res) => {
  const userId = req.user!.userId;
  const now = new Date();
  const p = await loadProfile(userId);
  assertEditable(p);
  const missing = missingItems(p, p.user.name, now);
  if (missing.length > 0)
    throw new ApiError(409, "APPLICATION_INCOMPLETE", `Дутуу: ${missing.join(", ")}`);
  await prisma.$transaction([
    prisma.nurseProfile.update({
      where: { userId },
      // the earlier rejection reason stays in the review history
      data: { status: "PENDING", submittedAt: now, isActive: false, reviewNote: null },
    }),
    prisma.nurseReviewEvent.create({ data: { nurseId: userId, actorId: userId, action: "SUBMITTED" } }),
  ]);
  return ok(
    res,
    { application: serializeApplication(await loadProfile(userId)) },
    "Өргөдөл админд илгээгдлээ",
  );
});
