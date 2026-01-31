-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('ORDERED', 'CONFIRMED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LockStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'USED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogisticsStatus" AS ENUM ('PENDING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'FAILED');

-- AlterEnum
ALTER TYPE "RedemptionStatus" ADD VALUE 'DISPATCHED';

-- AlterTable
ALTER TABLE "SilverAsset" ADD COLUMN     "purchaseOrderId" TEXT;

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "dealerName" TEXT NOT NULL,
    "dealerApiKey" TEXT,
    "weightGrams" DOUBLE PRECISION NOT NULL,
    "pricePerGram" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "PurchaseStatus" NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "serialNumbers" TEXT,
    "assayReports" TEXT,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceLock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "silverAssetId" TEXT NOT NULL,
    "lockedPrice" DOUBLE PRECISION NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "LockStatus" NOT NULL,
    "usedForMint" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PriceLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogisticsOrder" (
    "id" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "carrierName" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "weightGrams" DOUBLE PRECISION NOT NULL,
    "status" "LogisticsStatus" NOT NULL,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "estimatedDelivery" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "LogisticsOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsOrder_redemptionId_key" ON "LogisticsOrder"("redemptionId");

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsOrder_trackingNumber_key" ON "LogisticsOrder"("trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_key_key" ON "SystemSettings"("key");

-- AddForeignKey
ALTER TABLE "SilverAsset" ADD CONSTRAINT "SilverAsset_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceLock" ADD CONSTRAINT "PriceLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceLock" ADD CONSTRAINT "PriceLock_silverAssetId_fkey" FOREIGN KEY ("silverAssetId") REFERENCES "SilverAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsOrder" ADD CONSTRAINT "LogisticsOrder_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "Redemption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
