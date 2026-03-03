/**
 * create-oracle-tables.ts
 * Directly creates the OraclePriceSubmission and OracleStatus tables
 * in PostgreSQL, bypassing Prisma migrate (which is running silently).
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('Creating OraclePriceSubmission table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "OraclePriceSubmission" (
        "id"             TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
        "submitter"      TEXT         NOT NULL,
        "pricePerGram"   DOUBLE PRECISION NOT NULL,
        "rawPrice"       DOUBLE PRECISION NOT NULL,
        "source"         TEXT         NOT NULL,
        "accepted"       BOOLEAN      NOT NULL,
        "rejectedReason" TEXT,
        "txHash"         TEXT,
        "submittedAt"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "OraclePriceSubmission_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('✅ OraclePriceSubmission created (or already exists)');

    console.log('Creating OracleStatus table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "OracleStatus" (
        "id"             TEXT             NOT NULL DEFAULT 'singleton',
        "currentPrice"   DOUBLE PRECISION NOT NULL DEFAULT 0,
        "lastUpdatedAt"  TIMESTAMPTZ      NOT NULL DEFAULT now(),
        "isPaused"       BOOLEAN          NOT NULL DEFAULT false,
        "submitterCount" INTEGER          NOT NULL DEFAULT 1,
        "source"         TEXT             NOT NULL DEFAULT 'Median Oracle',
        "updatedAt"      TIMESTAMPTZ      NOT NULL DEFAULT now(),
        CONSTRAINT "OracleStatus_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('✅ OracleStatus created (or already exists)');

    // Verify
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('OraclePriceSubmission', 'OracleStatus');
    `);
    console.log('Tables verified in DB:', res.rows.map((r: any) => r.table_name));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
