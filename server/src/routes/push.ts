// The apps register their Expo push token after sign-in and remove it on sign-out.
import { Router, Request } from "express";
import { z } from "zod";
import prisma from "../db/db.config";
import { authenticateToken } from "../middlwares/auth";
import { ApiError, ok, validationError } from "../utils/http";
import { isExpoPushToken } from "../services/push";

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export const pushRoutes = Router();
pushRoutes.use(authenticateToken);

const tokenSchema = z.string().max(200).refine(isExpoPushToken, "Expo push token биш");
const registerSchema = z
  .object({
    token: tokenSchema,
    app: z.enum(["client", "nurse"]),
    platform: z.enum(["ios", "android"]),
  })
  .strict();

// Which account type each app serves
const APP_ROLE = { client: "CHILD", nurse: "NURSE" } as const;

// POST /api/push/devices: this phone gets this account's notifications
pushRoutes.post("/devices", async (req: AuthRequest, res) => {
  const p = registerSchema.safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, deletedAt: true } });
  if (!user || user.deletedAt) throw new ApiError(401, "ACCOUNT_DISABLED", "Бүртгэл идэвхгүй байна");
  if (user.role !== APP_ROLE[p.data.app])
    throw new ApiError(403, "FORBIDDEN", "Энэ аппын бүртгэл биш");
  // One phone, one account: a token signed in with another account moves here.
  await prisma.pushDevice.upsert({
    where: { token: p.data.token },
    create: { ...p.data, userId },
    update: { ...p.data, userId, lastSeenAt: new Date() },
  });
  return ok(res, null, "Мэдэгдэл идэвхжлээ");
});

// DELETE /api/push/devices: sign-out on this phone
pushRoutes.delete("/devices", async (req: AuthRequest, res) => {
  const p = z.object({ token: tokenSchema }).strict().safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  // only the signed-in account's own token
  await prisma.pushDevice.deleteMany({ where: { token: p.data.token, userId: req.user!.userId } });
  return ok(res, null, "Мэдэгдэл унтарлаа");
});
