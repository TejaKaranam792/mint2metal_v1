/*
  Warnings:

  - Changed the type of `status` on the `KYC` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
ALTER TYPE "MintStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "KYC" ADD COLUMN     "riskReasons" TEXT,
ADD COLUMN     "riskScore" INTEGER,
DROP COLUMN "status",
ADD COLUMN     "status" "KYCStatus" NOT NULL;

-- CreateTable
CREATE TABLE "SilverPrice" (
    "id" TEXT NOT NULL,
    "pricePerGram" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "setBy" TEXT NOT NULL,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SilverPrice_pkey" PRIMARY KEY ("id")
);
