-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'CONTACTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "NurseApplication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenseNo" TEXT NOT NULL,
    "experienceYears" INTEGER NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "consentVersion" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NurseApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NurseApplication_phone_createdAt_idx" ON "NurseApplication"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "NurseApplication_ipHash_createdAt_idx" ON "NurseApplication"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "NurseApplication_status_createdAt_idx" ON "NurseApplication"("status", "createdAt");

