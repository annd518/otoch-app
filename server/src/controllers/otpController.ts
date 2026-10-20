import { Request, Response } from "express";
import { createHash, randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../db/db.config";
import { ApiError, ok, validationError } from "../utils/http";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const phoneSchema = z.string().regex(/^\+976\d{8}$/);
const requestSchema = z.object({ phone: phoneSchema });
const verifySchema = z.object({
  phone: phoneSchema,
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
  name: z.string().trim().min(2).max(100).optional(),
  // "nurse": the nurse app. Signs in an existing NURSE account only, unless
  // `register` is set: then an unknown phone becomes a NURSE account with an
  // unsent application (PENDING). It gets no order until an admin verifies it.
  app: z.enum(["client", "nurse"]).optional(),
  register: z.boolean().optional(),
});
const tokenSchema = z.object({ refreshToken: z.string().min(32).max(256) });
const secret = () => {
  if (!process.env.JWT_SECRET)
    throw new ApiError(503, "SERVICE_UNAVAILABLE", "Нэвтрэлт түр боломжгүй");
  return process.env.JWT_SECRET;
};
async function session(user: {
  id: string;
  name: string;
  email: string;
  role: string;
}) {
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    secret(),
    { expiresIn: "15m" },
  );
  const refreshToken = randomBytes(48).toString("hex");
  await prisma.refreshSession.create({
    data: {
      userId: user.id,
      tokenHash: hash(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 86400000),
    },
  });
  return { token, refreshToken, user };
}
/**
 * Fixed-code test accounts for store review and staging testers, who cannot
 * receive SMS: OTP_TEST_ACCOUNTS="+97699000001:483920,+97699000002:715306".
 * Off unless set. Listed numbers never get an SMS; the code is never returned
 * or logged. Trivial codes (000000, 123456, ...) are ignored.
 */
const TRIVIAL_CODES = new Set(["123456", "654321", "012345", "123123"]);
export function testAccountCode(phone: string): string | null {
  const raw = process.env.OTP_TEST_ACCOUNTS;
  if (!raw) return null;
  for (const entry of raw.split(",")) {
    const [p, c] = entry.trim().split(":");
    if (p !== phone || !c || !/^\d{6}$/.test(c)) continue;
    if (/^(\d)\1{5}$/.test(c) || TRIVIAL_CODES.has(c)) return null;
    return c;
  }
  return null;
}
export async function requestOtp(req: Request, res: Response) {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) throw validationError(parsed.error);
  const { phone } = parsed.data;
  const fixed = testAccountCode(phone);
  const mock =
    !fixed &&
    process.env.SMS_DRIVER === "mock" &&
    process.env.NODE_ENV !== "production";
  const url = process.env.SMS_WEBHOOK_URL;
  if (
    !fixed &&
    !mock &&
    (!url?.startsWith("https://") || !process.env.SMS_WEBHOOK_TOKEN)
  )
    throw new ApiError(
      503,
      "SMS_UNAVAILABLE",
      "SMS үйлчилгээ хараахан тохируулагдаагүй байна",
    );
  const ipHash = hash(req.ip ?? "unknown");
  const now = new Date(),
    code = fixed ?? String(randomInt(0, 1000000)).padStart(6, "0");
  const row = await prisma.$transaction(async (tx) => {
    // Rate counts and challenge issuance must be atomic across server processes.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ipHash}))`;
    const last = await tx.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });
    if (last && last.lockedUntil && last.lockedUntil.getTime() > now.getTime())
      throw new ApiError(
        429,
        "OTP_LOCKED",
        "15 минутын дараа дахин оролдоно уу",
      );
    const phoneCount = await tx.otpChallenge.count({
      where: { phone, createdAt: { gt: new Date(now.getTime() - 600000) } },
    });
    const ipCount = await tx.otpChallenge.count({
      where: { ipHash, createdAt: { gt: new Date(now.getTime() - 3600000) } },
    });
    if (
      phoneCount >= 3 ||
      ipCount >= 20 ||
      (last && now.getTime() - last.createdAt.getTime() < 60000)
    )
      throw new ApiError(
        429,
        "OTP_RATE_LIMIT",
        "Код дахин илгээх хугацаа болоогүй байна",
      );
    await tx.otpChallenge.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: now },
    });
    return tx.otpChallenge.create({
      data: {
        // same clock as the rate-limit window above (not the database default),
        // so the counts never mix two clocks
        createdAt: now,
        phone,
        ipHash,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(now.getTime() + 300000),
      },
    });
  });
  if (!mock && !fixed) {
    try {
      const response = await fetch(url!, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: phone,
          message: `OTOCH нэвтрэх код: ${code}. 5 минут хүчинтэй.`,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("delivery");
    } catch {
      await prisma.otpChallenge.update({
        where: { id: row.id },
        data: { consumedAt: now },
      });
      throw new ApiError(
        503,
        "SMS_UNAVAILABLE",
        "Код илгээж чадсангүй. Дараа дахин оролдоно уу",
      );
    }
  }
  // Mock code is exposed ONLY with two explicit dev flags; never written to logs.
  return ok(
    res,
    {
      challengeId: row.id,
      expiresAt: row.expiresAt.toISOString(),
      resendAfterSeconds: 60,
      isMock: mock,
      ...(mock && process.env.EXPOSE_TEST_OTP === "true"
        ? { testCode: code }
        : {}),
    },
    "Баталгаажуулах код илгээгдлээ",
  );
}
export async function verifyOtp(req: Request, res: Response) {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) throw validationError(parsed.error);
  const { phone, challengeId, code, name, app, register } = parsed.data;
  if (register && (app !== "nurse" || !name))
    throw new ApiError(400, "VALIDATION_ERROR", "Бүртгүүлэхэд нэрээ оруулна уу", {
      name: "Шаардлагатай",
    });
  secret();
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;
    const challenge = await tx.otpChallenge.findFirst({
      where: { id: challengeId, phone },
    });
    if (challenge?.lockedUntil && challenge.lockedUntil.getTime() > Date.now())
      return "locked" as const;
    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt.getTime() <= Date.now()
    )
      return "invalid" as const;
    if (challenge.attempts >= 3) return "locked" as const;
    if (!(await bcrypt.compare(code, challenge.codeHash))) {
      await tx.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: { increment: 1 },
          ...(challenge.attempts >= 2
            ? { lockedUntil: new Date(Date.now() + 15 * 60000) }
            : {}),
        },
      });
      return challenge.attempts >= 2
        ? ("locked" as const)
        : ("invalid" as const);
    }
    await tx.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    let user = await tx.user.findUnique({ where: { phone } });
    if (app === "nurse") {
      if (!user && register)
        user = await tx.user.create({
          data: {
            phone,
            email: `${phone.slice(1)}@nurse.otoch.invalid`,
            name: name!,
            password: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
            role: "NURSE",
            nurseProfile: { create: { skillTags: [], zoneIds: [] } },
          },
        });
      // The phone is proven by the code, so saying why is not an enumeration leak.
      if (register && user && !user.deletedAt && user.role !== "NURSE")
        return "phone_taken" as const;
      // Same answer for unknown phone, deleted account and wrong role: no enumeration.
      if (!user || user.deletedAt || user.role !== "NURSE")
        return "invalid" as const;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };
    }
    if (!user)
      user = await tx.user.create({
        data: {
          phone,
          email: `${phone.slice(1)}@phone.otoch.invalid`,
          name: name ?? "Хэрэглэгч",
          password: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
          role: "CHILD",
        },
      });
    if (user.deletedAt || user.role !== "CHILD") return "invalid" as const;
    if (name)
      user = await tx.user.update({ where: { id: user.id }, data: { name } });
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  });
  if (result === "phone_taken")
    throw new ApiError(
      409,
      "PHONE_TAKEN",
      "Энэ дугаар өөр төрлийн бүртгэлтэй. Сувилагчаар өөр дугаараар бүртгүүлнэ үү",
    );
  if (typeof result === "string")
    throw new ApiError(
      result === "locked" ? 429 : 400,
      result === "locked" ? "OTP_LOCKED" : "OTP_INVALID",
      result === "locked"
        ? "15 минутын дараа дахин оролдоно уу"
        : "Код буруу эсвэл хугацаа дууссан байна",
    );
  return ok(res, await session(result), "Амжилттай нэвтэрлээ");
}
export async function refreshSession(req: Request, res: Response) {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) throw validationError(parsed.error);
  const row = await prisma.refreshSession.findUnique({
    where: { tokenHash: hash(parsed.data.refreshToken) },
    include: { user: true },
  });
  if (
    !row ||
    row.revokedAt ||
    row.expiresAt.getTime() <= Date.now() ||
    row.user.deletedAt
  )
    throw new ApiError(401, "UNAUTHENTICATED", "Дахин нэвтэрнэ үү");
  const claimed = await prisma.refreshSession.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (claimed.count !== 1)
    throw new ApiError(401, "UNAUTHENTICATED", "Дахин нэвтэрнэ үү");
  return ok(
    res,
    await session({
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: row.user.role,
    }),
    "Нэвтрэлт шинэчлэгдлээ",
  );
}
export async function logoutSession(req: Request, res: Response) {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) throw validationError(parsed.error);
  await prisma.refreshSession.updateMany({
    where: { tokenHash: hash(parsed.data.refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return ok(res, null, "Гарлаа");
}
