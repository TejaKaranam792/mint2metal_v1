-- CreateEnum
CREATE TYPE "Role" AS ENUM('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AMLStatus" AS ENUM('PENDING', 'CLEARED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "KYCStatus" AS ENUM('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MintStatus" AS ENUM('REQUESTED', 'APPROVED', 'MINTED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM('ACTIVE', 'REPAID', 'LIQUIDATED');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM('PENDING', 'APPROVED', 'FULFILLED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "amlStatus" TEXT,
    "amlDocument" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KYC" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "documentRef" TEXT,
    "verifiedAt" TIMESTAMP(3),
    CONSTRAINT "KYC_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KYC_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vault" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "custodian" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SilverAsset" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "weightGrams" REAL NOT NULL,
    "purity" REAL NOT NULL,
    "custodyRef" TEXT NOT NULL,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SilverAsset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SilverAsset_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DSTMint" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "silverAssetId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL,
    "mintedAt" TIMESTAMP(3),
    CONSTRAINT "DSTMint_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DSTMint_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DSTMint_silverAssetId_fkey" FOREIGN KEY ("silverAssetId") REFERENCES "SilverAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collateral" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "interestRate" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "silverAssetId" TEXT,
    "quantity" REAL NOT NULL,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),
    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Redemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Redemption_silverAssetId_fkey" FOREIGN KEY ("silverAssetId") REFERENCES "SilverAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "KYC_userId_key" ON "KYC"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DSTMint_silverAssetId_key" ON "DSTMint"("silverAssetId");
