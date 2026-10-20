-- CreateEnum
CREATE TYPE "NurseDocumentKind" AS ENUM ('LICENSE', 'DIPLOMA', 'ID_CARD', 'PORTRAIT');

-- AlterEnum
ALTER TYPE "NurseStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "NurseProfile" ADD COLUMN     "employer" TEXT,
ADD COLUMN     "experienceYears" INTEGER,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NurseDocument" (
    "id" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "kind" "NurseDocumentKind" NOT NULL,
    "storageDriver" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NurseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NurseReviewEvent" (
    "id" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NurseReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NurseDocument_storageKey_key" ON "NurseDocument"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "NurseDocument_nurseId_kind_key" ON "NurseDocument"("nurseId", "kind");

-- CreateIndex
CREATE INDEX "NurseReviewEvent_nurseId_createdAt_idx" ON "NurseReviewEvent"("nurseId", "createdAt");

-- AddForeignKey
ALTER TABLE "NurseDocument" ADD CONSTRAINT "NurseDocument_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "NurseProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurseReviewEvent" ADD CONSTRAINT "NurseReviewEvent_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "NurseProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

