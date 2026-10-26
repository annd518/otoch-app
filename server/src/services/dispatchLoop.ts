import prisma from "../db/db.config";
import { runDispatchCycle } from "./dispatch";
import { runUnassignedSweep } from "./unassignedSweep";
import { runRatingReminders } from "./ratings";

/**
 * Runs dispatch every DISPATCH_INTERVAL_MS (default 15 s; 0 turns it off).
 * Several API instances may run it: each order is row-locked per cycle.
 */
export function startDispatchLoop(): void {
  const raw = process.env.DISPATCH_INTERVAL_MS;
  const interval = raw === undefined || raw === "" ? 15_000 : Number(raw);
  if (!Number.isFinite(interval) || interval <= 0) return;
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    runDispatchCycle(prisma)
      .then(() => runUnassignedSweep(prisma))
      .then(() => runRatingReminders(prisma))
      .catch(() => console.error("Dispatch cycle failed"))
      .finally(() => {
        running = false;
      });
  }, interval);
  timer.unref();
}
