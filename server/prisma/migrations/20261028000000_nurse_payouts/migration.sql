-- Nurse earnings ledger and admin-recorded payouts (spec slide 98)
-- AlterTable
ALTER TABLE "NurseProfile" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNo" TEXT,
ADD COLUMN     "bankName" TEXT;

-- CreateTable
CREATE TABLE "PayoutEntry" (
    "id" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "grossMnt" INTEGER NOT NULL,
    "commissionPct" INTEGER NOT NULL,
    "commissionMnt" INTEGER NOT NULL,
    "netMnt" INTEGER NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL,
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "totalMnt" INTEGER NOT NULL,
    "visits" INTEGER NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutEntry_orderId_key" ON "PayoutEntry"("orderId");

-- CreateIndex
CREATE INDEX "PayoutEntry_nurseId_earnedAt_idx" ON "PayoutEntry"("nurseId", "earnedAt");

-- CreateIndex
CREATE INDEX "PayoutEntry_nurseId_payoutId_idx" ON "PayoutEntry"("nurseId", "payoutId");

-- CreateIndex
CREATE INDEX "Payout_nurseId_paidAt_idx" ON "Payout"("nurseId", "paidAt");

-- AddForeignKey
ALTER TABLE "PayoutEntry" ADD CONSTRAINT "PayoutEntry_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutEntry" ADD CONSTRAINT "PayoutEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutEntry" ADD CONSTRAINT "PayoutEntry_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- money rows stay consistent
ALTER TABLE "PayoutEntry" ADD CONSTRAINT "PayoutEntry_amounts_check" CHECK ("grossMnt" >= 0 AND "netMnt" >= 0 AND "commissionMnt" >= 0 AND "grossMnt" = "netMnt" + "commissionMnt" AND "commissionPct" BETWEEN 0 AND 100);
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_total_check" CHECK ("totalMnt" >= 0 AND "visits" > 0);
