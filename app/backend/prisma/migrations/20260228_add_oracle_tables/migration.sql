-- Oracle tables migration
-- Created manually because prisma migrate dev ran silently

CREATE TABLE IF NOT EXISTS "OraclePriceSubmission" (
    "id"             TEXT             NOT NULL DEFAULT gen_random_uuid()::text,
    "submitter"      TEXT             NOT NULL,
    "pricePerGram"   DOUBLE PRECISION NOT NULL,
    "rawPrice"       DOUBLE PRECISION NOT NULL,
    "source"         TEXT             NOT NULL,
    "accepted"       BOOLEAN          NOT NULL,
    "rejectedReason" TEXT,
    "txHash"         TEXT,
    "submittedAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OraclePriceSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OracleStatus" (
    "id"             TEXT             NOT NULL DEFAULT 'singleton',
    "currentPrice"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdatedAt"  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPaused"       BOOLEAN          NOT NULL DEFAULT false,
    "submitterCount" INTEGER          NOT NULL DEFAULT 1,
    "source"         TEXT             NOT NULL DEFAULT 'Median Oracle',
    "updatedAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OracleStatus_pkey" PRIMARY KEY ("id")
);
