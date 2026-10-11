import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../db/db.config";
import { metadataSchema } from "./serviceMetadata";
const approval = z
  .object({
    version: z.string().regex(/^[A-Z0-9_.-]{3,80}$/),
    approvedBy: z.string().trim().min(3).max(200),
    approvedAt: z.iso
      .datetime()
      .refine(
        (v) => Date.parse(v) <= Date.now(),
        "Approval cannot be in the future",
      ),
  })
  .strict();
const service = z
  .object({
    code: z.string().regex(/^S(0[1-9]|10)$/),
    name: z.string().trim().min(2).max(200),
    description: z.string().max(3000).nullable(),
    category: z.enum(["GROUP_A", "GROUP_B", "GROUP_C", "GROUP_D"]),
    priceMnt: z.number().int().min(0).max(100000000),
    durationMin: z.number().int().min(1).max(240),
    requiresReferral: z.boolean(),
    questionnaire: z.string().min(3).max(80),
    sortOrder: z.number().int().min(0),
    metadata: metadataSchema,
  })
  .strict();
const catalog = approval.extend({
  kind: z.literal("catalog"),
  services: z
    .array(service)
    .length(10)
    .refine(
      (rows) =>
        new Set(rows.map((r) => r.code)).size === 10 &&
        new Set(rows.map((r) => r.category)).size === 4,
      "Requires S01–S10 and four groups",
    ),
});
const questionnaire = approval.extend({
  kind: z.literal("questionnaire"),
  questions: z
    .array(
      z
        .object({
          code: z.string().regex(/^RF[1-6]$/),
          text: z.string().trim().min(5).max(2000),
          sortOrder: z.number().int().min(0),
        })
        .strict(),
    )
    .length(6)
    .refine(
      (q) =>
        new Set(q.map((r) => r.code)).size === 6 &&
        new Set(q.map((r) => r.sortOrder)).size === 6,
      "Six unique questions and positions required",
    ),
});
const zones = approval
  .extend({
    kind: z.literal("availability"),
    zones: z
      .array(
        z
          .object({
            id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
            name: z.string().min(2).max(200),
            isActive: z.boolean(),
            minLat: z.number().min(-90).max(90),
            maxLat: z.number().min(-90).max(90),
            minLng: z.number().min(-180).max(180),
            maxLng: z.number().min(-180).max(180),
          })
          .strict()
          .refine((z) => z.minLat < z.maxLat && z.minLng < z.maxLng),
      )
      .min(1)
      .max(100),
    slots: z
      .array(
        z
          .object({
            zoneId: z.string(),
            startsAt: z.iso.datetime({ offset: true }),
            endsAt: z.iso.datetime({ offset: true }),
            capacity: z.number().int().min(1).max(100),
          })
          .strict()
          .refine(
            (s) =>
              Date.parse(s.endsAt) > Date.parse(s.startsAt) &&
              Date.parse(s.startsAt) > Date.now(),
          ),
      )
      .min(1)
      .max(10000),
  })
  .refine(
    (d) =>
      new Set(d.zones.map((z) => z.id)).size === d.zones.length &&
      d.slots.every((s) => d.zones.some((z) => z.id === s.zoneId)) &&
      new Set(d.slots.map((s) => s.zoneId + ":" + Date.parse(s.startsAt)))
        .size === d.slots.length,
    "Duplicate or unknown zones/slots",
  );
export const publicationSchema = z.discriminatedUnion("kind", [
  catalog,
  questionnaire,
  zones,
]);
export async function importContent(input: unknown, apply = false) {
  const body = publicationSchema.parse(input);
  if (body.kind === "catalog")
    for (const row of body.services) {
      if (
        (["S03", "S06"].includes(row.code) ? 120 : 60) !==
          row.metadata.formConfig.windowMin ||
        !row.metadata.formConfig.approved ||
        row.category !== row.metadata.group ||
        row.requiresReferral !==
          ["required", "discharge"].includes(row.metadata.formConfig.referral)
      )
        throw new Error("Approved config, matching group/referral required");
    }
  const digest = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  const report = {
    kind: body.kind,
    version: body.version,
    digest,
    apply,
    count:
      body.kind === "catalog"
        ? body.services.length
        : body.kind === "questionnaire"
          ? body.questions.length
          : body.slots.length,
  };
  if (!apply) return report;
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('otoch-content-publication'))`;
      const previous = await tx.contentPublication.findUnique({
        where: { kind_version: { kind: body.kind, version: body.version } },
      });
      if (previous) {
        if (previous.digest !== digest)
          throw new Error("Version already published with different content");
        return;
      }
      if (body.kind === "questionnaire") {
        if (
          await tx.redFlagQuestion.count({
            where: { questionnaire: body.version },
          })
        )
          throw new Error(
            "Questionnaire identifier already exists; publish a new version",
          );
        await tx.redFlagQuestion.createMany({
          data: body.questions.map((q) => ({
            ...q,
            questionnaire: body.version,
            isFixture: false,
            approvedBy: body.approvedBy,
            approvedAt: new Date(body.approvedAt),
          })),
        });
      } else if (body.kind === "catalog") {
        for (const row of body.services) {
          const approved = await tx.contentPublication.findUnique({
            where: {
              kind_version: {
                kind: "questionnaire",
                version: row.questionnaire,
              },
            },
          });
          if (!approved)
            throw new Error(
              "Publish the approved questionnaire before catalog",
            );
          const data = {
            ...row,
            metadata: row.metadata as Prisma.InputJsonValue,
            contentVersion: body.version,
            isFixture: false,
            isActive: true,
            approvedBy: body.approvedBy,
            approvedAt: new Date(body.approvedAt),
          };
          await tx.serviceCatalogItem.upsert({
            where: { code: row.code },
            create: data,
            update: data,
          });
        }
        // A new catalog requires explicit review/consent and a fresh questionnaire for each editable draft.
        await tx.order.updateMany({
          where: { status: "DRAFT" },
          data: {
            redFlagStatus: "NOT_ANSWERED",
            redFlagAnsweredAt: null,
            version: { increment: 1 },
          },
        });
      } else {
        for (const zone of body.zones)
          await tx.serviceZone.upsert({
            where: { id: zone.id },
            create: zone,
            update: zone,
          });
        for (const slot of body.slots) {
          const startsAt = new Date(slot.startsAt),
            endsAt = new Date(slot.endsAt);
          const same = await tx.availabilitySlot.findFirst({
            where: { zoneId: slot.zoneId, startsAt },
          });
          if (same) {
            if (
              same.endsAt.getTime() !== endsAt.getTime() ||
              same.capacity !== slot.capacity
            )
              throw new Error("Existing slots are immutable; use a new slot");
            continue;
          }
          const overlap = await tx.availabilitySlot.findFirst({
            where: {
              zoneId: slot.zoneId,
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          });
          if (overlap)
            throw new Error("Overlapping slots in one zone are not allowed");
          await tx.availabilitySlot.create({
            data: { ...slot, startsAt, endsAt },
          });
        }
      }
      await tx.contentPublication.create({
        data: {
          kind: body.kind,
          version: body.version,
          digest,
          payload: body as Prisma.InputJsonValue,
          approvedBy: body.approvedBy,
          approvedAt: new Date(body.approvedAt),
        },
      });
    },
    { timeout: 60000 },
  );
  return report;
}
