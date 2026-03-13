-- Mint2Metal Full Schema
-- Paste this entire file into the Supabase SQL Editor and click "Run"

-- Enums
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'INDIA_USER', 'INTERNATIONAL_USER', 'CUSTODY_VERIFIER', 'MINT_EXECUTOR', 'TREASURY_ADMIN', 'API_INTEGRATOR', 'ORACLE_SUBMITTER');
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'IN_REVIEW', 'VERIFIED', 'REJECTED');
CREATE TYPE "OrderType" AS ENUM ('BUY', 'SELL');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'SETTLED', 'REJECTED');
CREATE TYPE "LoanStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REPAID', 'REJECTED', 'CLOSED');
CREATE TYPE "RedemptionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'SHIPPED', 'COMPLETED', 'REJECTED');
CREATE TYPE "AMLStatus" AS ENUM ('CLEARED', 'FLAGGED', 'BLOCKED');
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXECUTED', 'FAILED');
CREATE TYPE "AnchorTransactionStatus" AS ENUM ('incomplete', 'pending_user_transfer_start', 'pending_external', 'pending_anchor', 'completed', 'error');

-- Tables
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "UserRole" NOT NULL,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "country" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "amlStatus" "AMLStatus" NOT NULL DEFAULT 'CLEARED',
    "googleId" TEXT,
    "amlDocument" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

CREATE TABLE "KYC" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "documentRef" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "kycLevel" TEXT,
    "kycRejectedReason" TEXT,
    "kycVerifiedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KYC_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "quantityGrams" DOUBLE PRECISION NOT NULL,
    "priceLocked" DOUBLE PRECISION NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "isTestnet" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoanRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collateralGrams" DOUBLE PRECISION NOT NULL,
    "requestedAmount" DOUBLE PRECISION NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoanRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RedemptionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantityGrams" DOUBLE PRECISION NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RedemptionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

CREATE TABLE "OraclePriceSubmission" (
    "id" TEXT NOT NULL,
    "submitter" TEXT NOT NULL,
    "pricePerGram" DOUBLE PRECISION NOT NULL,
    "rawPrice" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "rejectedReason" TEXT,
    "txHash" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OraclePriceSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OracleStatus" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "currentPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "submitterCount" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'Median Oracle',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OracleStatus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chain" TEXT NOT NULL DEFAULT 'Stellar',
    "walletType" TEXT NOT NULL DEFAULT 'EXTERNAL',
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastConnected" TIMESTAMP(3),
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

CREATE TABLE "CommodityAsset" (
    "id" TEXT NOT NULL,
    "commodityType" TEXT NOT NULL DEFAULT 'XAG',
    "issuerId" TEXT,
    "weightGrams" DOUBLE PRECISION NOT NULL,
    "purity" DOUBLE PRECISION NOT NULL,
    "location" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "mint" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CommodityAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementBatch" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "commodityType" TEXT NOT NULL DEFAULT 'XAG',
    "vaultId" TEXT NOT NULL,
    "totalGrams" DOUBLE PRECISION NOT NULL,
    "porHash" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettlementBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SettlementBatch_batchId_key" ON "SettlementBatch"("batchId");

CREATE TABLE "DSTMint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "mintedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "commodityAssetId" TEXT,
    "settlementBatchId" TEXT,
    CONSTRAINT "DSTMint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "reference" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Kyc" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "kycRejectedReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationSource" TEXT,
    "verifiedBy" TEXT,
    CONSTRAINT "Kyc_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommodityPrice" (
    "id" TEXT NOT NULL,
    "commodityType" TEXT NOT NULL DEFAULT 'XAG',
    "price" DOUBLE PRECISION NOT NULL,
    "pricePerGram" DOUBLE PRECISION NOT NULL,
    "currency" TEXT,
    "setBy" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommodityPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceLock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commodityAssetId" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "lockedPrice" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedForMint" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PriceLock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantityGrams" DOUBLE PRECISION NOT NULL,
    "weightGrams" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "pricePerGram" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION,
    "dealerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "executedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeIntentId" TEXT,
    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SystemSettings_key_key" ON "SystemSettings"("key");

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" TEXT[],
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

CREATE TABLE "VaultReceipt" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "vaultName" TEXT,
    "commodityType" TEXT NOT NULL DEFAULT 'XAG',
    "gramsSecured" DOUBLE PRECISION NOT NULL,
    "verifierId" TEXT NOT NULL,
    "signature" TEXT,
    "ipfsCid" TEXT,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VaultReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VaultReceipt_receiptId_key" ON "VaultReceipt"("receiptId");

CREATE TABLE "AnchorTransaction" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "stellarAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "AnchorTransactionStatus" NOT NULL DEFAULT 'incomplete',
    "amount" DOUBLE PRECISION,
    "amountExpected" DOUBLE PRECISION,
    "assetCode" TEXT NOT NULL DEFAULT 'XAG',
    "bankReference" TEXT,
    "externalId" TEXT,
    "message" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnchorTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnchorTransaction_transactionId_key" ON "AnchorTransaction"("transactionId");
CREATE UNIQUE INDEX "AnchorTransaction_bankReference_key" ON "AnchorTransaction"("bankReference");

-- Foreign Keys
ALTER TABLE "KYC" ADD CONSTRAINT "KYC_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoanRequest" ADD CONSTRAINT "LoanRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RedemptionRequest" ADD CONSTRAINT "RedemptionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DSTMint" ADD CONSTRAINT "DSTMint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DSTMint" ADD CONSTRAINT "DSTMint_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DSTMint" ADD CONSTRAINT "DSTMint_commodityAssetId_fkey" FOREIGN KEY ("commodityAssetId") REFERENCES "CommodityAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DSTMint" ADD CONSTRAINT "DSTMint_settlementBatchId_fkey" FOREIGN KEY ("settlementBatchId") REFERENCES "SettlementBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Kyc" ADD CONSTRAINT "Kyc_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriceLock" ADD CONSTRAINT "PriceLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriceLock" ADD CONSTRAINT "PriceLock_commodityAssetId_fkey" FOREIGN KEY ("commodityAssetId") REFERENCES "CommodityAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TradeIntent" ADD CONSTRAINT "TradeIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_tradeIntentId_fkey" FOREIGN KEY ("tradeIntentId") REFERENCES "TradeIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VaultReceipt" ADD CONSTRAINT "VaultReceipt_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
