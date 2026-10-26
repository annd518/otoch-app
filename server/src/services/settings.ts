// Business rules an admin may change in the admin web (spec slide 103,
// "settings"). Each has the spec's value as its default; a row in Setting
// overrides it. Values are read through a short cache so a busy dispatch loop
// does not query them every time.
import type { Prisma, PrismaClient } from "@prisma/client";

export interface SettingDef {
  label: string;
  hint: string;
  unit: "%" | "цаг" | "мин" | "сек" | "сувилагч" | "₮";
  default: number;
  min: number;
  max: number;
}

// ⚑ Defaults are the spec's values (slides 25, 70, 103). The lawyer still has
// to confirm the cancellation fee; changing it here does not confirm it.
export const SETTING_DEFS = {
  commissionPct: {
    label: "Компанийн шимтгэл",
    hint: "Үйлчилгээний үнээс компанид үлдэх хувь. Үлдсэн нь сувилагчид олгогдоно (spec: 30%).",
    unit: "%",
    default: 30,
    min: 0,
    max: 100,
  },
  cancelFreeHours: {
    label: "Үнэгүй цуцлах хугацаа",
    hint: "Товлосон цагаас өмнө энэ хугацаанаас эрт цуцалбал 100% буцаана (spec: 2 цаг).",
    unit: "цаг",
    default: 2,
    min: 0,
    max: 72,
  },
  cancelFeePct: {
    label: "Оройтсон цуцлалтын хураамж",
    hint: "Үнэгүй хугацаа өнгөрсний дараа цуцалбал суутгах хувь (spec: 30%, ⚑ хуульч батлах).",
    unit: "%",
    default: 30,
    min: 0,
    max: 100,
  },
  noShowWaitMin: {
    label: "No-show хүлээх хугацаа",
    hint: "Товлосон цагаас хойш сувилагч хүлээсний дараа «Үйлчлүүлэгч байхгүй» бүртгэх боломжтой болно.",
    unit: "мин",
    default: 15,
    min: 0,
    max: 120,
  },
  offerTtlSec: {
    label: "Дуудлагын саналд хариулах хугацаа",
    hint: "Сувилагч санал хүлээн авах хугацаа; дуусахад дараагийн сувилагчдад очно (spec: 120 сек).",
    unit: "сек",
    default: 120,
    min: 30,
    max: 900,
  },
  waveSize: {
    label: "Нэг давалгааны сувилагчийн тоо",
    hint: "Нэг дуудлагыг зэрэг санал болгох сувилагчийн тоо (spec: 3).",
    unit: "сувилагч",
    default: 3,
    min: 1,
    max: 20,
  },
  // ⚑ Travel fee per zone tier (spec slide 103: zone_fees {1: 0, 2: 5000,
  // 3: 10000}). Not approved, so 0 until the business sets them; with 0 the
  // price is the list price as before.
  zoneFee1Mnt: {
    label: "Унааны зардал: 1-р бүс",
    hint: "Төвийн бүсийн захиалгад нэмэх дүн (spec: 0₮).",
    unit: "₮",
    default: 0,
    min: 0,
    max: 1_000_000,
  },
  zoneFee2Mnt: {
    label: "Унааны зардал: 2-р бүс",
    hint: "Дунд бүсийн захиалгад нэмэх дүн (spec: 5,000₮, ⚑ батлагдаагүй).",
    unit: "₮",
    default: 0,
    min: 0,
    max: 1_000_000,
  },
  zoneFee3Mnt: {
    label: "Унааны зардал: 3-р бүс",
    hint: "Алслагдсан бүсийн захиалгад нэмэх дүн (spec: 10,000₮, ⚑ батлагдаагүй).",
    unit: "₮",
    default: 0,
    min: 0,
    max: 1_000_000,
  },
  travelFeeNursePct: {
    label: "Унааны зардлаас сувилагчид олгох хувь",
    hint: "Үйлчлүүлэгчийн төлсөн унааны зардлын энэ хувь сувилагчид, үлдсэн нь компанид. Үйлчилгээний шимтгэлээс тусдаа (анхдагч 70%).",
    unit: "%",
    default: 70,
    min: 0,
    max: 100,
  },
  noNurseNoticeMin: {
    label: "«Сувилагч хайсаар байна» мэдэгдэл",
    hint: "Сувилагч хайж эхэлснээс хойш энэ хугацаанд олдоогүй бол үйлчлүүлэгчид мэдэгдэнэ (spec: 30 мин).",
    unit: "мин",
    default: 30,
    min: 5,
    max: 720,
  },
} as const satisfies Record<string, SettingDef>;

export type SettingKey = keyof typeof SETTING_DEFS;
export type Settings = Record<SettingKey, number>;
export const SETTING_KEYS = Object.keys(SETTING_DEFS) as SettingKey[];

export const DEFAULT_SETTINGS: Settings = Object.fromEntries(
  SETTING_KEYS.map((k) => [k, SETTING_DEFS[k].default]),
) as Settings;

const CACHE_MS = 15_000;
let cache: { at: number; value: Settings } | null = null;

type Db = Pick<PrismaClient, "setting"> | Pick<Prisma.TransactionClient, "setting">;

/** Current settings: stored values over the defaults. Cached for 15 s. */
export async function getSettings(db: Db, now = Date.now()): Promise<Settings> {
  if (cache && now - cache.at < CACHE_MS) return cache.value;
  const rows = await (db as Pick<PrismaClient, "setting">).setting.findMany();
  const value = { ...DEFAULT_SETTINGS };
  for (const r of rows)
    if ((SETTING_KEYS as string[]).includes(r.key)) value[r.key as SettingKey] = r.value;
  cache = { at: now, value };
  return value;
}

/** After a change in this process (other instances pick it up within 15 s). */
export function invalidateSettings() {
  cache = null;
}

/** The nurse's share of the price, from the company's commission. */
export const nurseSharePercent = (s: Settings) => 100 - s.commissionPct;
