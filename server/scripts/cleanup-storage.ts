import { cleanupBlobs } from "../src/services/blobCleanup";
import prisma from "../src/db/db.config";
void cleanupBlobs()
  .then((result) => console.log(JSON.stringify(result)))
  .catch(() => {
    console.error("Storage cleanup failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
