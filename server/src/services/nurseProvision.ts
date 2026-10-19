import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";

export const provisionSchema = z.object({
  phone: z.string().regex(/^\+976\d{8}$/, "Утас +976XXXXXXXX хэлбэртэй"),
  name: z.string().trim().min(2).max(100),
});

export type ProvisionResult =
  | { status: "created" | "unchanged"; id: string; phone: string }
  | { status: "refused"; reason: string };

/**
 * Creates the NURSE account a phone + OTP sign-in needs (the nurse app never
 * creates users). Idempotent per phone; never changes the role of an existing
 * account. The password is random and unknown: this account signs in by OTP only.
 * Verification of the nurse's licence (spec slide 35) is an admin step outside
 * this function.
 */
export async function provisionNurse(
  prisma: PrismaClient,
  input: { phone: string; name: string },
): Promise<ProvisionResult> {
  const { phone, name } = provisionSchema.parse(input);
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    if (existing.deletedAt) return { status: "refused", reason: "Устгагдсан данс" };
    if (existing.role !== "NURSE")
      return { status: "refused", reason: `Энэ дугаар ${existing.role} эрхтэй данстай` };
    return { status: "unchanged", id: existing.id, phone };
  }
  const user = await prisma.user.create({
    data: {
      phone,
      name,
      email: `${phone.slice(1)}@nurse.otoch.invalid`,
      password: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
      role: "NURSE",
    },
  });
  return { status: "created", id: user.id, phone };
}
