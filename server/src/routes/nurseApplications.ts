// "Join as a nurse" requests from the nurse app (docs/nurse-app-plan.md). Nurse accounts are
// never created here: an admin checks the licence and documents (spec slide 35), then
// creates the account (POST /api/admin/staff or `npm run nurse:provision`).
import { createHash } from "node:crypto";
import { Router, Request } from "express";
import { z } from "zod";
import prisma from "../db/db.config";
import { authenticateToken } from "../middlwares/auth";
import { requireRole } from "../middlwares/rbac";
import { ApiError, ok, validationError } from "../utils/http";

export const APPLICATION_CONSENT_VERSION = "NURSE_APPLICATION_V1";
/** Most applications one network address may send per hour. */
export const MAX_PER_IP_PER_HOUR = 5;
/** Most applications one phone number may create per day. */
export const MAX_PER_PHONE_PER_DAY = 2;

const applicationSchema = z
  .object({
    name: z.string().trim().min(2, "Нэрээ бүтнээр бичнэ үү").max(100),
    phone: z.string().regex(/^\+976\d{8}$/, "Утас +976XXXXXXXX хэлбэртэй"),
    licenseNo: z.string().trim().min(1, "Зөвшөөрлийн дугаар оруулна уу").max(40),
    experienceYears: z.number().int().min(0).max(60),
    // The three statements the nurse ticks on the form (the app sends true for each).
    declarations: z
      .object({
        license: z.literal(true),
        experience: z.literal(true),
        scope: z.literal(true),
      })
      .strict(),
  })
  .strict();

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export const nurseApplicationsPublic = Router();

// POST /api/nurse-applications (no sign-in). Same answer whether or not the phone already
// has an account or a pending request, so the form cannot be used to probe who is a nurse.
nurseApplicationsPublic.post("/", async (req: Request, res) => {
  const p = applicationSchema.safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const { name, phone, licenseNo, experienceYears } = p.data;
  const received = () =>
    ok(
      res,
      { received: true },
      "Өргөдөл хүлээн авлаа",
      202,
    );

  const [account, open] = await Promise.all([
    prisma.user.findUnique({ where: { phone }, select: { id: true } }),
    prisma.nurseApplication.findFirst({
      where: { phone, status: { in: ["NEW", "CONTACTED"] } },
      select: { id: true },
    }),
  ]);
  if (account || open) return received();

  const ipHash = hash(req.ip ?? "unknown");
  const now = Date.now();
  const [fromIp, fromPhone] = await Promise.all([
    prisma.nurseApplication.count({
      where: { ipHash, createdAt: { gt: new Date(now - 3_600_000) } },
    }),
    prisma.nurseApplication.count({
      where: { phone, createdAt: { gt: new Date(now - 86_400_000) } },
    }),
  ]);
  if (fromIp >= MAX_PER_IP_PER_HOUR || fromPhone >= MAX_PER_PHONE_PER_DAY)
    throw new ApiError(
      429,
      "APPLICATION_RATE_LIMIT",
      "Өргөдлийг хэт олон илгээлээ. Түр хүлээгээд дахин оролдоно уу",
    );

  await prisma.nurseApplication.create({
    data: {
      name,
      phone,
      licenseNo,
      experienceYears,
      consentVersion: APPLICATION_CONSENT_VERSION,
      ipHash,
    },
  });
  return received();
});

// ---- Admin: read and triage the requests ---------------------------------------------

export const nurseApplicationsAdmin = Router();
nurseApplicationsAdmin.use(authenticateToken);
nurseApplicationsAdmin.use(requireRole(["ADMIN"]));

const select = {
  id: true,
  name: true,
  phone: true,
  licenseNo: true,
  experienceYears: true,
  status: true,
  note: true,
  createdAt: true,
} as const;

nurseApplicationsAdmin.get("/", async (req: Request, res) => {
  const q = z
    .object({ status: z.enum(["NEW", "CONTACTED", "APPROVED", "REJECTED"]).optional() })
    .safeParse(req.query);
  if (!q.success) throw validationError(q.error);
  const applications = await prisma.nurseApplication.findMany({
    where: q.data.status ? { status: q.data.status } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    select,
  });
  return ok(res, { applications }, "Сувилагчийн өргөдлүүд");
});

nurseApplicationsAdmin.patch("/:id", async (req: Request, res) => {
  const p = z
    .object({
      status: z.enum(["NEW", "CONTACTED", "APPROVED", "REJECTED"]).optional(),
      note: z.string().trim().max(500).nullable().optional(),
    })
    .strict()
    .refine((v) => v.status !== undefined || v.note !== undefined, {
      message: "Өөрчлөх зүйл алга",
    })
    .safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const id = String(req.params.id);
  const exists = await prisma.nurseApplication.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new ApiError(404, "APPLICATION_NOT_FOUND", "Өргөдөл олдсонгүй");
  const application = await prisma.nurseApplication.update({
    where: { id },
    data: {
      ...(p.data.status !== undefined && { status: p.data.status }),
      ...(p.data.note !== undefined && { note: p.data.note }),
    },
    select,
  });
  return ok(res, { application }, "Хадгалагдлаа");
});
