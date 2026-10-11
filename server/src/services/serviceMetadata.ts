import { z } from "zod";
import { CATALOG_V2 } from "../data/catalogV2";
import { ApiError } from "../utils/http";
export const formConfigSchema = z
  .object({
    windowMin: z.union([z.literal(60), z.literal(120)]),
    referral: z.enum(["required", "partial", "discharge", "none"]),
    medicationRequired: z.boolean(),
    firstDoseCheck: z.boolean(),
    familyPresence: z.enum(["optional", "recommended", "required"]),
    attachmentLimit: z.number().int().min(1).max(3),
    approved: z.boolean(),
  })
  .strict();
const texts = z.array(z.string().trim().min(1).max(2000)).max(40);
export const metadataSchema = z
  .object({
    group: z.enum(["GROUP_A", "GROUP_B", "GROUP_C", "GROUP_D"]),
    includes: texts,
    preparation: texts,
    nurseSupplies: texts,
    exclusions: texts,
    formConfig: formConfigSchema,
  })
  .strict();
export function readMetadata(value: unknown) {
  const p = metadataSchema.safeParse(value);
  return p.success ? p.data : null;
}
export function serviceConfig(service: { code: string; metadata: unknown }) {
  const metadata = readMetadata(service.metadata);
  if (!metadata)
    throw new ApiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Үйлчилгээний тохиргоо дутуу байна",
    );
  return metadata.formConfig;
}
export function fixtureCatalogRow(row: (typeof CATALOG_V2)[number]) {
  const {
    group,
    includes,
    preparation,
    nurseSupplies,
    exclusions,
    formConfig,
    ...base
  } = row;
  return {
    ...base,
    isFixture: true,
    contentVersion: "OTOCH_V2_FIXTURE",
    metadata: {
      group,
      includes: [...includes],
      preparation: [...preparation],
      nurseSupplies: [...nurseSupplies],
      exclusions: [...exclusions],
      formConfig: { ...formConfig, approved: false },
    },
  };
}
