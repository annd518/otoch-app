// Audit log page of the admin web (spec A-11, slide 109). Mounted under
// /api/admin, behind the admin guard. Read only: audit rows are never edited.
import { Router } from "express";
import { z } from "zod";
import prisma from "../db/db.config";
import { ok, validationError } from "../utils/http";
import { allow } from "../services/permissions";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditAction, type AuditEntity } from "../services/audit";

export const adminAudit = Router();

const PAGE = 50;
const query = z.object({
  entity: z.enum(Object.keys(AUDIT_ENTITIES) as [AuditEntity, ...AuditEntity[]]).optional(),
  action: z.enum(Object.keys(AUDIT_ACTIONS) as [AuditAction, ...AuditAction[]]).optional(),
  actorId: z.string().min(1).max(100).optional(),
  // records whose id contains this (order №, nurse id, ...)
  entityId: z.string().trim().min(3).max(100).optional(),
  cursor: z.string().max(100).optional(),
});

// GET /api/admin/audit?entity=&action=&actorId=&entityId=&cursor=
adminAudit.get("/audit", allow("audit.view"), async (req, res) => {
  const q = query.safeParse(req.query);
  if (!q.success) throw validationError(q.error);
  const { entity, action, actorId, entityId, cursor } = q.data;
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(entity && { entity }),
      ...(action && { action }),
      ...(actorId && { actorId }),
      ...(entityId && { entityId: { contains: entityId, mode: "insensitive" as const } }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, PAGE);
  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(page.map((r) => r.actorId))] } },
    select: { id: true, name: true, role: true },
  });
  const byId = new Map(actors.map((a) => [a.id, a]));
  return ok(
    res,
    {
      entries: page.map((r) => ({
        id: r.id,
        at: r.createdAt.toISOString(),
        actor: byId.get(r.actorId)?.name ?? (r.actorId === "SYSTEM" ? "Систем" : null),
        actorId: r.actorId,
        action: r.action,
        actionLabel: AUDIT_ACTIONS[r.action as AuditAction] ?? r.action,
        entity: r.entity,
        entityLabel: AUDIT_ENTITIES[r.entity as AuditEntity] ?? r.entity,
        entityId: r.entityId,
        before: r.before,
        after: r.after,
      })),
      nextCursor: rows.length > PAGE ? page[PAGE - 1].id : null,
      // for the filter menus
      actions: AUDIT_ACTIONS,
      entities: AUDIT_ENTITIES,
    },
    "Аудит лог",
  );
});
