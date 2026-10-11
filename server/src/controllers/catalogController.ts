import { CATALOG_V2 } from "../data/catalogV2";
import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../db/db.config";
import { ok, validationError } from "../utils/http";
import { getCatalogVersion } from "../services/catalog";

const querySchema = z.object({
  category: z
    .string()
    .trim()
    .regex(/^[A-Z_]{2,40}$/, "Ангиллын код буруу байна")
    .optional(),
});

// GET /api/catalog/services — contract: docs/l1-1-api.md §2
export const listCatalogServices = async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) throw validationError(parsed.error);

  const items = await prisma.serviceCatalogItem.findMany({
    where: {
      isActive: true,
      ...(parsed.data.category && { category: parsed.data.category }),
    },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  // Whole-catalog version (independent of the category filter); orders are validated against it
  const catalogVersion = await getCatalogVersion();

  const services = items.map((i) => ({
    id: i.id,
    code: i.code,
    name: i.name,
    description: i.description,
    category: i.category,
    priceMnt: i.priceMnt,
    durationMin: i.durationMin,
    requiresReferral: i.requiresReferral,
    redFlagQuestionnaire: i.questionnaire,
    isActive: i.isActive,
    isFixture: i.isFixture,
    ...(() => {
      const meta = CATALOG_V2.find((s) => s.code === i.code);
      return meta
        ? {
            group: meta.group,
            includes: meta.includes,
            preparation: meta.preparation,
            nurseSupplies: meta.nurseSupplies,
            exclusions: meta.exclusions,
            formConfig: meta.formConfig,
            sortOrder: meta.sortOrder,
          }
        : {};
    })(),
  }));

  return ok(
    res,
    {
      catalogVersion,
      currency: "MNT",
      containsFixtures: services.some((s) => s.isFixture),
      services,
    },
    "Каталог",
  );
};
