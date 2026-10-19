-- CreateEnum
CREATE TYPE "NurseStatus" AS ENUM ('PENDING', 'VERIFIED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "NurseProfile" (
    "userId" TEXT NOT NULL,
    "status" "NurseStatus" NOT NULL DEFAULT 'PENDING',
    "licenseNo" TEXT,
    "licenseExpiresAt" TIMESTAMP(3),
    "skillTags" TEXT[],
    "zoneIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NurseProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "OrderOffer" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "wave" INTEGER NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderOffer_nurseId_status_expiresAt_idx" ON "OrderOffer"("nurseId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "OrderOffer_orderId_status_idx" ON "OrderOffer"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrderOffer_orderId_nurseId_key" ON "OrderOffer"("orderId", "nurseId");

-- AddForeignKey
ALTER TABLE "NurseProfile" ADD CONSTRAINT "NurseProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderOffer" ADD CONSTRAINT "OrderOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderOffer" ADD CONSTRAINT "OrderOffer_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

