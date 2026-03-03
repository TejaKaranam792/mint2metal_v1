/**
 * oracle-scheduler.service.ts
 *
 * Cron-based scheduler that periodically invokes the oracle price cycle.
 * Runs every 5 minutes by default. Integrates with node-cron.
 */

import cron, { ScheduledTask } from "node-cron";
import { runOracleCycle, OracleCycleResult } from "./oracle.service";

const CRON_SCHEDULE = process.env.ORACLE_CRON_SCHEDULE ?? "*/5 * * * *"; // every 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10_000; // 10 seconds

let isRunning = false;
let lastResult: OracleCycleResult | null = null;
let consecutiveFailures = 0;
let schedulerTask: ScheduledTask | null = null;

// ─── Core Runner ─────────────────────────────────────────────────────────────

async function runWithRetry(): Promise<void> {
  if (isRunning) {
    console.log("[OracleScheduler] Cycle already in progress, skipping.");
    return;
  }
  isRunning = true;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[OracleScheduler] Starting oracle cycle (attempt ${attempt}/${MAX_RETRIES})...`);
      const result = await runOracleCycle();
      lastResult = result;

      if (result.success) {
        consecutiveFailures = 0;
        console.log(
          `[OracleScheduler] ✅ Cycle completed. Price: $${result.medianPricePerGram.toFixed(4)}/g | TxHash: ${result.txHash ?? "N/A"}`
        );
        break;
      } else {
        console.warn(`[OracleScheduler] ⚠️ Cycle returned failure: ${result.error}`);
        if (attempt < MAX_RETRIES) {
          console.log(`[OracleScheduler] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
          await sleep(RETRY_DELAY_MS);
        } else {
          consecutiveFailures++;
          console.error(
            `[OracleScheduler] ❌ All ${MAX_RETRIES} attempts failed. Consecutive failures: ${consecutiveFailures}`
          );
          notifyOracleFailure(consecutiveFailures, result.error);
        }
      }
    } catch (err: any) {
      console.error(`[OracleScheduler] Unexpected error on attempt ${attempt}:`, err.message);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      } else {
        consecutiveFailures++;
        notifyOracleFailure(consecutiveFailures, err.message);
      }
    }
  }

  isRunning = false;
}

// ─── Monitoring Hook ─────────────────────────────────────────────────────────

function notifyOracleFailure(failureCount: number, reason?: string): void {
  // In production, integrate with PagerDuty / Slack / monitoring service
  console.error(
    `[OracleScheduler] 🚨 ALERT: Oracle has failed ${failureCount} consecutive time(s). Last reason: ${reason ?? "unknown"}`
  );

  if (failureCount >= 3) {
    console.error(
      "[OracleScheduler] 🚨 CRITICAL: Oracle circuit-breaker threshold reached. Manual intervention required!"
    );
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start the oracle price scheduler.
 * Call this once at server startup.
 */
export function startOracleScheduler(): void {
  if (schedulerTask) {
    console.log("[OracleScheduler] Scheduler already running.");
    return;
  }

  console.log(`[OracleScheduler] Starting oracle scheduler (schedule: "${CRON_SCHEDULE}")`);

  // Run immediately on startup
  runWithRetry().catch(console.error);

  // Schedule recurring runs
  schedulerTask = cron.schedule(CRON_SCHEDULE, () => {
    runWithRetry().catch(console.error);
  });

  console.log("[OracleScheduler] Oracle scheduler started successfully.");
}

/**
 * Stop the oracle scheduler.
 */
export function stopOracleScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log("[OracleScheduler] Scheduler stopped.");
  }
}

/**
 * Get the result of the last oracle cycle (for monitoring endpoints).
 */
export function getLastOracleCycleResult(): OracleCycleResult | null {
  return lastResult;
}

/**
 * Get scheduler health info.
 */
export function getSchedulerHealth(): {
  isRunning: boolean;
  consecutiveFailures: number;
  lastResult: OracleCycleResult | null;
  schedule: string;
} {
  return {
    isRunning,
    consecutiveFailures,
    lastResult,
    schedule: CRON_SCHEDULE,
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
