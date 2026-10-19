import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";

export const SKILL_TAGS = ["INJ", "IV", "WOUND", "CATH", "NG", "CARE"] as const;

export const provisionSchema = z.object({
  phone: z.string().regex(/^\+976\d{8}$/, "Утас +976XXXXXXXX хэлбэртэй"),
  name: z.string().trim().min(2).max(100),
  // Verification (spec slide 35). Without `verified` the nurse stays PENDING and is
  // never offered an order.
  verified: z.boolean().optional(),
  licenseNo: z.string().trim().min(1).max(40).optional(),
  licenseExpiresAt: z.date().optional(),
  skillTags: z.array(z.enum(SKILL_TAGS)).optional(),
  zoneIds: z.array(z.string().min(1)).optional(),
});
export type ProvisionInput = z.input<typeof provisionSchema>;

export type ProvisionResult =
  | { status: "created" | "updated" | "unchanged"; id: string; phone: string; verified: boolean }
  | { status: "refused"; reason: string };

/**
 * Creates the NURSE account a phone + OTP sign-in needs (the nurse app never
 * creates users) together with its NurseProfile. Idempotent per phone; never
 * changes the role of an existing account. The password is random and unknown:
 * the account signs in by OTP only. Marking a nurse `verified` is the admin's
 * attestation that the licence was checked against the register (slide 35) and
 * needs a licence number and a future expiry date.
 */
export async function provisionNurse(
  prisma: PrismaClient,
  input: ProvisionInput,
  now: Date = new Date(),
): Promise<ProvisionResult> {
  const data = provisionSchema.parse(input);
  if (data.verified && (!data.licenseNo || !data.licenseExpiresAt))
    return { status: "refused", reason: "Баталгаажуулахад зөвшөөрлийн № ба хугацаа хэрэгтэй" };
  if (data.verified && data.licenseExpiresAt! <= now)
    return { status: "refused", reason: "Зөвшөөрлийн хугацаа дууссан байна" };

  const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
  if (existing?.deletedAt) return { status: "refused", reason: "Устгагдсан данс" };
  if (existing && existing.role !== "NURSE")
    return { status: "refused", reason: `Энэ дугаар ${existing.role} эрхтэй данстай` };

  const touchesProfile =
    data.verified !== undefined ||
    data.licenseNo !== undefined ||
    data.licenseExpiresAt !== undefined ||
    data.skillTags !== undefined ||
    data.zoneIds !== undefined;
  const profileData = {
    ...(data.verified !== undefined && { status: data.verified ? ("VERIFIED" as const) : ("PENDING" as const) }),
    ...(data.licenseNo !== undefined && { licenseNo: data.licenseNo }),
    ...(data.licenseExpiresAt !== undefined && { licenseExpiresAt: data.licenseExpiresAt }),
    ...(data.skillTags !== undefined && { skillTags: data.skillTags }),
    ...(data.zoneIds !== undefined && { zoneIds: data.zoneIds }),
  };

  const user =
    existing ??
    (await prisma.user.create({
      data: {
        phone: data.phone,
        name: data.name,
        email: `${data.phone.slice(1)}@nurse.otoch.invalid`,
        password: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
        role: "NURSE",
      },
    }));
  const profile = await prisma.nurseProfile.findUnique({ where: { userId: user.id } });
  let changed = !existing;
  if (!profile) {
    await prisma.nurseProfile.create({ data: { userId: user.id, skillTags: [], zoneIds: [], ...profileData } });
    changed = true;
  } else if (touchesProfile) {
    await prisma.nurseProfile.update({ where: { userId: user.id }, data: profileData });
    changed = true;
  }
  const final = await prisma.nurseProfile.findUniqueOrThrow({ where: { userId: user.id } });
  return {
    status: !existing ? "created" : changed ? "updated" : "unchanged",
    id: user.id,
    phone: data.phone,
    verified: final.status === "VERIFIED",
  };
}
