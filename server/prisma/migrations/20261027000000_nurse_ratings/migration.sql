-- Customer ratings of finished visits (spec SCR-C16)
-- CreateTable
CREATE TABLE "NurseRating" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NurseRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NurseRating_orderId_key" ON "NurseRating"("orderId");

-- CreateIndex
CREATE INDEX "NurseRating_nurseId_createdAt_idx" ON "NurseRating"("nurseId", "createdAt");

-- AddForeignKey
ALTER TABLE "NurseRating" ADD CONSTRAINT "NurseRating_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurseRating" ADD CONSTRAINT "NurseRating_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 1-5 stars only
ALTER TABLE "NurseRating" ADD CONSTRAINT "NurseRating_stars_check" CHECK ("stars" BETWEEN 1 AND 5);
