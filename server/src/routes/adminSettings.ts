// Admin web: business settings and catalog prices (spec A-08 "Каталог, үнэ",
// slide 103 settings). Mounted under /api/admin, behind the super-admin guard.
// Every change is written to AuditLog with the before/after values.
import { Router, Request } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "../db/db.config";
import { ApiError, ok, validationError } from "../utils/http";
import {
  SETTING_DEFS,
  SETTING_KEYS,
  getSettings,
  invalidateSettings,
  type SettingKey,
} from "../services/settings";

interface StaffRequest extends Request {
  user?: { userId: string; role: string };
}

export const adminSettings = Router();

async function auditTrail(entity: "setting" | "service") {
  const rows = await prisma.auditLog.findMany({
    where: { entity },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } },
    select: { id: true, name: true },
  });
  const name = new Map(actors.map((a) => [a.id, a.name]));
  return rows.map((r) => ({
    entityId: r.entityId,
    actor: name.get(r.actorId) ?? null,
    before: r.before,
    after: r.after,
    at: r.createdAt.toISOString(),
  }));
}

// GET /api/admin/settings
adminSettings.get("/settings", async (_req, res) => {
  invalidateSettings(); // the admin sees what is stored now
  const [values, rows, audit] = await Promise.all([
    getSettings(prisma),
    prisma.setting.findMany(),
    auditTrail("setting"),
  ]);
  const updated = new Map(rows.map((r) => [r.key, r.updatedAt.toISOString()]));
  return ok(
    res,
    {
      settings: SETTING_KEYS.map((key) => ({
        key,
        ...SETTING_DEFS[key],
        value: values[key],
        updatedAt: updated.get(key) ?? null,
      })),
      audit,
    },
    "Тохиргоо",
  );
});

const settingsSchema = z
  .object({
    values: z
      .record(z.string(), z.number().int())
      .refine((v) => Object.keys(v).length > 0, "Өөрчлөх утга алга"),
  })
  .strict();

// PUT /api/admin/settings {values: {commissionPct: 30, ...}}
adminSettings.put("/settings", async (req: StaffRequest, res) => {
  const p = settingsSchema.safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(p.data.values)) {
    const def = SETTING_DEFS[key as SettingKey];
    if (!def) fields[key] = "Тодорхойгүй тохиргоо";
    else if (value < def.min || value > def.max) fields[key] = `${def.min}–${def.max} хооронд байна`;
  }
  if (Object.keys(fields).length) throw new ApiError(400, "VALIDATION_ERROR", "Утга буруу байна", fields);
  invalidateSettings();
  const current = await getSettings(prisma);
  const changed = Object.entries(p.data.values).filter(([k, v]) => current[k as SettingKey] !== v);
  await prisma.$transaction(
    changed.flatMap(([key, value]) => [
      prisma.setting.upsert({
        where: { key },
        create: { key, value, updatedById: req.user!.userId },
        update: { value, updatedById: req.user!.userId },
      }),
      prisma.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: "SETTING_UPDATED",
          entity: "setting",
          entityId: key,
          before: { value: current[key as SettingKey] },
          after: { value },
        },
      }),
    ]),
  );
  invalidateSettings();
  return ok(res, { changed: changed.map(([k]) => k), settings: await getSettings(prisma) }, "Тохиргоо хадгалагдлаа");
});

const serializeService = (s: Prisma.ServiceCatalogItemGetPayload<object>) => ({
  id: s.id,
  code: s.code,
  name: s.name,
  category: s.category,
  priceMnt: s.priceMnt,
  durationMin: s.durationMin,
  isActive: s.isActive,
  // fictional test row: its price is not approved and production refuses it
  isFixture: s.isFixture,
  approved: !s.isFixture && !!s.approvedAt,
  sortOrder: s.sortOrder,
  updatedAt: s.updatedAt.toISOString(),
});

// GET /api/admin/catalog: every service, active or not
adminSettings.get("/catalog", async (_req, res) => {
  const [rows, audit] = await Promise.all([
    prisma.serviceCatalogItem.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    auditTrail("service"),
  ]);
  return ok(res, { services: rows.map(serializeService), audit }, "Каталог");
});

// Price, on/off and order only. Names, descriptions and clinical content come
// from the approved content import (services/contentImport.ts), not from here.
const catalogSchema = z
  .object({
    priceMnt: z.number().int().min(0).max(100_000_000).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    // the row as the admin saw it: refused if someone changed it meanwhile
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .refine((v) => v.priceMnt !== undefined || v.isActive !== undefined || v.sortOrder !== undefined, {
    message: "Өөрчлөх зүйл алга",
  });

// PATCH /api/admin/catalog/:id
adminSettings.patch("/catalog/:id", async (req: StaffRequest, res) => {
  const p = catalogSchema.safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const id = String(req.params.id);
  const { updatedAt, ...change } = p.data;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "ServiceCatalogItem" WHERE "id" = ${id} FOR UPDATE`;
    const before = await tx.serviceCatalogItem.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "SERVICE_NOT_FOUND", "Үйлчилгээ олдсонгүй");
    if (before.updatedAt.toISOString() !== new Date(updatedAt).toISOString())
      throw new ApiError(409, "VERSION_CONFLICT", "Өөр хүн өөрчилсөн байна. Дахин ачаална уу");
    const after = await tx.serviceCatalogItem.update({ where: { id }, data: change });
    const pick = (s: typeof before) => ({ priceMnt: s.priceMnt, isActive: s.isActive, sortOrder: s.sortOrder });
    await tx.auditLog.create({
      data: {
        actorId: req.user!.userId,
        action: "CATALOG_UPDATED",
        entity: "service",
        entityId: before.code,
        before: pick(before),
        after: pick(after),
      },
    });
    return after;
  });
  return ok(res, { service: serializeService(updated) }, "Үйлчилгээ шинэчлэгдлээ");
});
