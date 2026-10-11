-- AlterTable
ALTER TABLE "ServiceCatalogItem" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "contentVersion" TEXT,
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "RedFlagQuestion" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT;

-- CreateTable
CREATE TABLE "ContentPublication" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlobCleanupJob" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageDriver" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlobCleanupJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentPublication_kind_version_key" ON "ContentPublication"("kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "BlobCleanupJob_storageKey_key" ON "BlobCleanupJob"("storageKey");
