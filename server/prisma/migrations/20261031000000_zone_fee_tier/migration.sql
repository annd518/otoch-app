-- Travel fee tier per service zone (spec slide 103 zone_fees)
-- AlterTable
ALTER TABLE "ServiceZone" ADD COLUMN     "feeTier" INTEGER NOT NULL DEFAULT 1;


ALTER TABLE "ServiceZone" ADD CONSTRAINT "ServiceZone_feeTier_check" CHECK ("feeTier" BETWEEN 1 AND 3);
