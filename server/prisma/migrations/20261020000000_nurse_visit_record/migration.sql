-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'EN_ROUTE';
ALTER TYPE "OrderStatus" ADD VALUE 'REFUSED';
ALTER TYPE "OrderStatus" ADD VALUE 'INCIDENT';

-- CreateTable
CREATE TABLE "VisitRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "checkinAt" TIMESTAMP(3),
    "checkinMethod" TEXT,
    "checkinLat" DOUBLE PRECISION,
    "checkinLng" DOUBLE PRECISION,
    "checkinDistanceM" INTEGER,
    "checklist" JSONB,
    "vitals" JSONB,
    "procedures" JSONB,
    "medicationChecks" JSONB,
    "note" TEXT,
    "signerName" TEXT,
    "signature" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitRecord_orderId_key" ON "VisitRecord"("orderId");

-- AddForeignKey
ALTER TABLE "VisitRecord" ADD CONSTRAINT "VisitRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

