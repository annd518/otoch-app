// Customer ratings of nurses (spec SCR-C16, slide 71): after a finished visit
// the customer gives 1-5 stars, optional tags and a comment. The nurse's
// average is shown to the nurse and the admin, and dispatch asks better rated
// nurses first when the workload is equal.
import type { PrismaClient } from "@prisma/client";
import { logError } from "../utils/logger";
import { sendToUsers } from "./push";

/** Tags the customer may pick (spec SCR-C16 chips). */
export const RATING_TAGS = {
  ON_TIME: "Цагтаа",
  KIND: "Эелдэг",
  PROFESSIONAL: "Мэргэжлийн",
} as const;
export type RatingTag = keyof typeof RATING_TAGS;
export const RATING_TAG_CODES = Object.keys(RATING_TAGS) as RatingTag[];

/** The rating reminder goes this long after the visit ends (spec slide 71). */
export const RATING_REQUEST_DELAY_MS = 10 * 60000;
/** No reminder for visits that ended longer ago than this (e.g. after downtime). */
export const RATING_REQUEST_MAX_AGE_MS = 24 * 3600000;

export interface RatingSummary {
  average: number | null; // one decimal; null = no ratings yet
  count: number;
}

/** Average stars and count per nurse. Nurses without ratings get {null, 0}. */
export async function ratingSummaries(
  db: Pick<PrismaClient, "nurseRating">,
  nurseIds: string[],
): Promise<Map<string, RatingSummary>> {
  const out = new Map<string, RatingSummary>(
    nurseIds.map((id) => [id, { average: null, count: 0 }]),
  );
  if (nurseIds.length === 0) return out;
  const rows = await db.nurseRating.groupBy({
    by: ["nurseId"],
    where: { nurseId: { in: nurseIds } },
    _avg: { stars: true },
    _count: { _all: true },
  });
  for (const r of rows)
    out.set(r.nurseId, {
      average: r._avg.stars === null ? null : Math.round(r._avg.stars * 10) / 10,
      count: r._count._all,
    });
  return out;
}

/**
 * Asks the customer to rate a visit once, 10 minutes after it ended.
 * Runs with dispatch; RATING_REQUEST events keep it to one push per order.
 */
export async function runRatingReminders(prisma: PrismaClient, now: Date = new Date()) {
  const orders = await prisma.order.findMany({
    where: {
      status: "COMPLETED",
      assignedNurseId: { not: null },
      rating: null,
      events: {
        some: {
          toStatus: "COMPLETED",
          createdAt: {
            lte: new Date(now.getTime() - RATING_REQUEST_DELAY_MS),
            gt: new Date(now.getTime() - RATING_REQUEST_MAX_AGE_MS),
          },
        },
        none: { type: "RATING_REQUEST" },
      },
    },
    select: { id: true, childId: true },
    take: 100,
  });
  for (const o of orders) {
    try {
      await prisma.orderEvent.create({ data: { orderId: o.id, type: "RATING_REQUEST" } });
      await sendToUsers([o.childId], "client", {
        title: "Үйлчилгээг үнэлнэ үү",
        body: "Сувилагчийн үйлчилгээ танд хэр таалагдсан бэ? Үнэлгээ өгөхөд хэдхэн секунд болно.",
        data: { type: "ORDER", orderId: o.id },
      });
    } catch (err) {
      logError("ratings.reminder", err);
    }
  }
  return { reminded: orders.length };
}
