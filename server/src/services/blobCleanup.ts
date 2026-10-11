import prisma from "../db/db.config";
import { getStorage } from "./storage";
export async function cleanupBlobs() {
  const storage = getStorage();
  if (!storage) throw new Error("Storage is not configured");
  const jobs = await prisma.blobCleanupJob.findMany({
    where: {
      completedAt: null,
      storageDriver: storage.driver,
      createdAt: { lt: new Date(Date.now() - 10 * 60000) },
    },
    take: 100,
    orderBy: { createdAt: "asc" },
  });
  let removed = 0,
    failed = 0;
  for (const job of jobs) {
    // Never remove a blob linked to an ACTIVE record, including a response lost after commit.
    if (
      await prisma.attachment.count({
        where: { storageKey: job.storageKey, status: "ACTIVE" },
      })
    ) {
      await prisma.blobCleanupJob.update({
        where: { id: job.id },
        data: { completedAt: new Date() },
      });
      continue;
    }
    try {
      await storage.remove(job.storageKey);
      await prisma.blobCleanupJob.update({
        where: { id: job.id },
        data: { completedAt: new Date(), attempts: { increment: 1 } },
      });
      removed++;
    } catch {
      await prisma.blobCleanupJob.update({
        where: { id: job.id },
        data: { attempts: { increment: 1 } },
      });
      failed++;
    }
  }
  return { removed, failed };
}
