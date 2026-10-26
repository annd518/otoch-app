-- The zone travel fee part of an earning and the nurse's % of it (admin setting)
-- AlterTable
ALTER TABLE "PayoutEntry" ADD COLUMN     "travelFeeMnt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "travelFeeNursePct" INTEGER;


ALTER TABLE "PayoutEntry" ADD CONSTRAINT "PayoutEntry_travelFee_check" CHECK ("travelFeeMnt" >= 0 AND "travelFeeMnt" <= "grossMnt" AND ("travelFeeNursePct" IS NULL OR "travelFeeNursePct" BETWEEN 0 AND 100));
