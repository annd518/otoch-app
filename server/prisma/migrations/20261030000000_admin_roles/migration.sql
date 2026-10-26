-- Back-office roles (spec slide 109): Super-admin, Ops, Finance, Support
-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'OPS', 'FINANCE', 'SUPPORT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminRole" "AdminRole";


-- every existing admin keeps full rights
UPDATE "User" SET "adminRole" = 'SUPER_ADMIN' WHERE "role" = 'ADMIN';

-- an admin always has a back-office role and nobody else has one
ALTER TABLE "User" ADD CONSTRAINT "User_adminRole_check" CHECK (("role" = 'ADMIN') = ("adminRole" IS NOT NULL));
