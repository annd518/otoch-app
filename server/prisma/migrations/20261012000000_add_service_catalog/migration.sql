-- CreateTable
CREATE TABLE "ServiceCatalogItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "priceMnt" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "requiresReferral" BOOLEAN NOT NULL DEFAULT false,
    "questionnaire" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFixture" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCatalogItem_code_key" ON "ServiceCatalogItem"("code");

-- CreateIndex
CREATE INDEX "ServiceCatalogItem_isActive_category_sortOrder_idx" ON "ServiceCatalogItem"("isActive", "category", "sortOrder");

