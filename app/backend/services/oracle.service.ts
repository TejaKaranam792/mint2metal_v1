/**
 * oracle.service.ts
 *
 * Off-chain oracle service for Mint2Metal.
 * Fetches XAG/USD silver price from two independent APIs,
 * computes the median, and submits to the OracleAggregator Soroban contract.
 *
 * Price sources:
 *   1. goldprice.org  — free, no API key required
 *   2. freegoldprice.org API — free hourly, no key required
 */

import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  rpc as SorobanRpc,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
  Contract,
} from "@stellar/stellar-sdk";
import { prisma } from "../prisma";
import https from "https";
import http from "http";

// ─── Config ──────────────────────────────────────────────────────────────────

const ORACLE_CONTRACT_ID = process.env.ORACLE_CONTRACT_ID ?? "";
const ORACLE_SUBMITTER_SECRET = process.env.ORACLE_SUBMITTER_SECRET ?? "";
const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET;

// Troy ounce → gram conversion
const TROY_OZ_TO_GRAM = 31.1035;
// Scale factor for on-chain price (6 decimal places)
const SCALE = 1_000_000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PriceSource {
  name: string;
  pricePerOz: number;
  pricePerGram: number;
  fetchedAt: number; // Unix epoch ms
}

export interface OracleCycleResult {
  success: boolean;
  medianPricePerGram: number;
  sources: PriceSource[];
  txHash?: string;
  error?: string;
  timestamp: number;
}

// ─── Price Fetching ───────────────────────────────────────────────────────────

/**
 * Fetch XAG/USD from goldprice.org (free, no auth required).
 * endpoint: https://data-asg.goldprice.org/dbXRates/USD
 * Response: { items: [{ xagPrice: 30.5, ... }] }
 */
export async function fetchMetalsLivePrice(): Promise<PriceSource> {
  const data: any = await httpsGet("https://data-asg.goldprice.org/dbXRates/USD", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Mint2Metal Oracle)",
      "Referer": "https://goldprice.org/",
    },
    timeoutMs: 10000,
  });

  // Response shape: { items: [{ xagPrice: 30.5, ... }] }
  const xagPrice = data?.items?.[0]?.xagPrice ?? data?.xagPrice;
  const pricePerOz = parseFloat(xagPrice);

  if (isNaN(pricePerOz) || pricePerOz <= 0) {
    throw new Error(`goldprice.org: invalid price data: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return {
    name: "goldprice.org",
    pricePerOz,
    pricePerGram: pricePerOz / TROY_OZ_TO_GRAM,
    fetchedAt: Date.now(),
  };
}

/**
 * Fetch XAG/USD from freegoldprice.org hourly API as secondary source.
 * Fallback: open.er-api.com (returns XAG rate relative to USD base).
 */
export async function fetchSecondaryPrice(): Promise<PriceSource> {
  // Secondary source: Yahoo Finance Silver Futures (SI=F)
  try {
    const data: any = await httpsGet(
      "https://query1.finance.yahoo.com/v8/finance/chart/SI=F",
      { headers: { "User-Agent": "Mozilla/5.0" }, timeoutMs: 10000 }
    );

    // Yahoo structure: { chart: { result: [{ meta: { regularMarketPrice: 32.50 } }] } }
    const pricePerOz = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (typeof pricePerOz !== "number" || pricePerOz <= 0) {
      throw new Error(`Yahoo Finance structured changed or no price returned`);
    }

    return {
      name: "yahoo.finance",
      pricePerOz,
      pricePerGram: pricePerOz / TROY_OZ_TO_GRAM,
      fetchedAt: Date.now(),
    };
  } catch (err: any) {
    throw new Error(`Yahoo Finance failed: ${err.message}`);
  }
}

// ─── Median Computation ──────────────────────────────────────────────────────

export function computeMedian(values: number[]): number {
  if (values.length === 0) throw new Error("Cannot compute median of empty array");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

// ─── Soroban Submission ──────────────────────────────────────────────────────

/**
 * Submit the median price to the OracleAggregator Soroban contract.
 * `pricePerGram` is in USD (float). We scale by SCALE before submitting.
 */
export async function submitPriceToContract(
  pricePerGram: number,
  timestamp: number
): Promise<string> {
  if (!ORACLE_CONTRACT_ID) {
    throw new Error("ORACLE_CONTRACT_ID not set in environment");
  }
  if (!ORACLE_SUBMITTER_SECRET) {
    throw new Error("ORACLE_SUBMITTER_SECRET not set in environment");
  }

  const submitter = Keypair.fromSecret(ORACLE_SUBMITTER_SECRET);
  const server = new SorobanRpc.Server(SOROBAN_RPC_URL);

  const account = await server.getAccount(submitter.publicKey());
  const contract = new Contract(ORACLE_CONTRACT_ID);

  // Scale price: e.g. $0.968/gram → 968000
  const priceMicroUsd = BigInt(Math.round(pricePerGram * SCALE));
  const timestampU64 = BigInt(Math.floor(timestamp / 1000)); // convert ms → seconds

  const operation = contract.call(
    "submit_price",
    new Address(submitter.publicKey()).toScVal(),
    nativeToScVal(priceMicroUsd, { type: "i128" }),
    nativeToScVal(timestampU64, { type: "u64" })
  );

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const preparedTx = await server.prepareTransaction(tx);
  preparedTx.sign(submitter);

  const response = await server.sendTransaction(preparedTx);

  if (response.status === "ERROR") {
    throw new Error(`Soroban tx error: ${JSON.stringify(response.errorResult)}`);
  }

  // Poll for confirmation
  const txHash = response.hash;
  let attempts = 0;
  while (attempts < 10) {
    await sleep(2000);
    const status = await server.getTransaction(txHash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return txHash;
    }
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Soroban tx failed: ${txHash}`);
    }
    attempts++;
  }

  throw new Error(`Soroban tx timed out after polling: ${txHash}`);
}

// ─── Oracle Cycle ────────────────────────────────────────────────────────────

/**
 * Run a full oracle cycle:
 * 1. Fetch prices from both sources
 * 2. Compute median
 * 3. Submit to Soroban contract
 * 4. Persist to DB
 */
export async function runOracleCycle(): Promise<OracleCycleResult> {
  const timestamp = Date.now();
  const sources: PriceSource[] = [];
  const errors: string[] = [];

  // Fetch from source 1
  try {
    const s1 = await fetchMetalsLivePrice();
    sources.push(s1);
    console.log(
      `[Oracle] metals.live: $${s1.pricePerGram.toFixed(4)}/g ($${s1.pricePerOz.toFixed(2)}/oz)`
    );
  } catch (err: any) {
    errors.push(`metals.live: ${err.message}`);
    console.error(`[Oracle] metals.live failed:`, err.message);
  }

  // Fetch from source 2
  try {
    const s2 = await fetchSecondaryPrice();
    sources.push(s2);
    console.log(
      `[Oracle] ${s2.name}: $${s2.pricePerGram.toFixed(4)}/g ($${s2.pricePerOz.toFixed(2)}/oz)`
    );
  } catch (err: any) {
    errors.push(`secondary: ${err.message}`);
    console.error(`[Oracle] Secondary source failed:`, err.message);
  }

  if (sources.length === 0) {
    // ── Dev-mode fallback: use static price from env if set ──────────────────
    const devPrice = parseFloat(process.env.ORACLE_DEV_PRICE_USD ?? "");
    if (!isNaN(devPrice) && devPrice > 0) {
      console.warn(
        `[Oracle] ⚠️  All live APIs failed. Using ORACLE_DEV_PRICE_USD=${devPrice} (dev mode).`
      );
      const pricePerGram = devPrice / TROY_OZ_TO_GRAM;
      // Skip on-chain submission in dev mode, just update DB status
      const submitterPubkey = ORACLE_SUBMITTER_SECRET
        ? Keypair.fromSecret(ORACLE_SUBMITTER_SECRET).publicKey()
        : "dev-mode";
      await persistSubmission({
        submitter: submitterPubkey,
        pricePerGram,
        rawPrice: devPrice,
        source: "ORACLE_DEV_PRICE_USD (dev fallback)",
        accepted: true,
        timestamp: new Date(timestamp),
      });
      await updateOracleStatus(pricePerGram, timestamp, false);
      return {
        success: true,
        medianPricePerGram: pricePerGram,
        sources: [{ name: "dev-static", pricePerOz: devPrice, pricePerGram, fetchedAt: timestamp }],
        timestamp,
      };
    }

    const errorMsg = `All oracle sources failed: ${errors.join("; ")}`;
    console.error(`[Oracle] ${errorMsg}`);

    // Record failure in DB
    await persistSubmission({
      submitter: ORACLE_SUBMITTER_SECRET
        ? Keypair.fromSecret(ORACLE_SUBMITTER_SECRET).publicKey()
        : "unknown",
      pricePerGram: 0,
      rawPrice: 0,
      source: "failed",
      accepted: false,
      rejectedReason: errorMsg,
      timestamp: new Date(timestamp),
    });

    return { success: false, medianPricePerGram: 0, sources, error: errorMsg, timestamp };
  }

  // Compute median from all successful sources
  const prices = sources.map((s) => s.pricePerGram);
  const medianPricePerGram = computeMedian(prices);
  console.log(`[Oracle] Median price: $${medianPricePerGram.toFixed(4)}/g`);

  // Submit to Soroban
  let txHash: string | undefined;
  let submitError: string | undefined;

  if (ORACLE_CONTRACT_ID && ORACLE_SUBMITTER_SECRET) {
    try {
      txHash = await submitPriceToContract(medianPricePerGram, timestamp);
      console.log(`[Oracle] Price submitted. TxHash: ${txHash}`);
    } catch (err: any) {
      submitError = err.message;
      console.error(`[Oracle] Soroban submission failed:`, err.message);
    }
  } else {
    console.warn(
      "[Oracle] ORACLE_CONTRACT_ID or ORACLE_SUBMITTER_SECRET not set — skipping on-chain submission"
    );
    submitError = "Oracle not configured — simulated submission";
  }

  const accepted = !submitError;
  const submitterPubkey = ORACLE_SUBMITTER_SECRET
    ? Keypair.fromSecret(ORACLE_SUBMITTER_SECRET).publicKey()
    : "not_configured";

  // Persist to DB
  await persistSubmission({
    submitter: submitterPubkey,
    pricePerGram: medianPricePerGram,
    rawPrice: prices[0] ?? medianPricePerGram,
    source: sources.map((s) => s.name).join("+"),
    accepted,
    rejectedReason: submitError,
    txHash,
    timestamp: new Date(timestamp),
  });

  // Update OracleStatus singleton in DB for fast API reads
  if (accepted) {
    await updateOracleStatus(medianPricePerGram, timestamp, false);
  }

  if (submitError && !txHash) {
    return {
      success: false,
      medianPricePerGram,
      sources,
      error: submitError,
      timestamp,
    };
  }

  return {
    success: true,
    medianPricePerGram,
    sources,
    txHash,
    timestamp,
  };
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

interface SubmissionRecord {
  submitter: string;
  pricePerGram: number;
  rawPrice: number;
  source: string;
  accepted: boolean;
  rejectedReason?: string;
  txHash?: string;
  timestamp: Date;
}

async function persistSubmission(record: SubmissionRecord): Promise<void> {
  try {
    await (prisma as any).oraclePriceSubmission.create({
      data: {
        submitter: record.submitter,
        pricePerGram: record.pricePerGram,
        rawPrice: record.rawPrice,
        source: record.source,
        accepted: record.accepted,
        rejectedReason: record.rejectedReason ?? null,
        txHash: record.txHash ?? null,
        submittedAt: record.timestamp,
      },
    });
  } catch (err) {
    console.error("[Oracle] Failed to persist submission to DB:", err);
  }
}

async function updateOracleStatus(
  pricePerGram: number,
  timestampMs: number,
  isPaused: boolean
): Promise<void> {
  try {
    await (prisma as any).oracleStatus.upsert({
      where: { id: "singleton" },
      update: {
        currentPrice: pricePerGram,
        lastUpdatedAt: new Date(timestampMs),
        isPaused,
        source: "Median Oracle",
      },
      create: {
        id: "singleton",
        currentPrice: pricePerGram,
        lastUpdatedAt: new Date(timestampMs),
        isPaused,
        source: "Median Oracle",
        submitterCount: 1,
      },
    });
  } catch (err) {
    console.error("[Oracle] Failed to update OracleStatus in DB:", err);
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make an HTTPS GET request using Node's built-in `https` module.
 * Returns parsed JSON. Throws on non-200 or parse error.
 */
function httpsGet(
  url: string,
  opts: { headers?: Record<string, string>; timeoutMs?: number } = {}
): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        "Accept": "application/json",
        ...opts.headers,
      },
    };

    const req = (lib as typeof https).request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if ((res.statusCode ?? 0) >= 400) {
          reject(new Error(`HTTP ${res.statusCode} from ${parsed.hostname}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Invalid JSON from ${parsed.hostname}: ${body.slice(0, 100)}`));
        }
      });
    });

    req.on("error", (e) => reject(new Error(`HTTPS request failed (${parsed.hostname}): ${e.message}`)));

    if (opts.timeoutMs) {
      req.setTimeout(opts.timeoutMs, () => {
        req.destroy();
        reject(new Error(`HTTPS timeout after ${opts.timeoutMs}ms (${parsed.hostname})`));
      });
    }

    req.end();
  });
}

// ── Legacy compat: keep fetchWithTimeout in case it's referenced elsewhere
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Read current oracle price directly from Soroban contract (source of truth).
 * Falls back to DB OracleStatus if contract read fails.
 */
export async function readOraclePriceFromContract(): Promise<{
  pricePerGram: number;
  pricePerOz: number;
  timestamp: number;
  isStale: boolean;
  isPaused: boolean;
} | null> {
  if (!ORACLE_CONTRACT_ID) return null;

  try {
    const server = new SorobanRpc.Server(SOROBAN_RPC_URL);
    const contract = new Contract(ORACLE_CONTRACT_ID);

    // Use simulation to read without signing
    const dummyKeypair = Keypair.random();
    const account = await server.getAccount(dummyKeypair.publicKey()).catch(() => null);
    if (!account) return null;

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("get_price"))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!SorobanRpc.Api.isSimulationSuccess(sim)) return null;

    const result = scValToNative(sim.result!.retval) as {
      price_micro_usd_per_gram: bigint;
      last_timestamp: bigint;
      is_stale: boolean;
      is_paused: boolean;
    };

    const pricePerGram = Number(result.price_micro_usd_per_gram) / SCALE;
    const pricePerOz = pricePerGram * TROY_OZ_TO_GRAM;
    const timestamp = Number(result.last_timestamp) * 1000; // to ms

    return { pricePerGram, pricePerOz, timestamp, isStale: result.is_stale, isPaused: result.is_paused };
  } catch (err) {
    console.error("[Oracle] Failed to read from contract:", err);
    return null;
  }
}
