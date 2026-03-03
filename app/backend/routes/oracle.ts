/**
 * oracle.ts route
 *
 * Backend API endpoints for the OracleAggregator price feed.
 *   GET  /api/oracle/price         — current live price
 *   GET  /api/oracle/status        — full oracle health
 *   GET  /api/oracle/history       — recent submissions (admin)
 *   POST /api/oracle/emergency-pause — pause oracle (admin)
 *   POST /api/oracle/unpause        — unpause oracle (admin)
 */

import { Router } from "express";
import { getUserFromToken } from "../services/auth.service";
import { prisma } from "../prisma";
import { readOraclePriceFromContract, runOracleCycle } from "../services/oracle.service";
import { getSchedulerHealth } from "../services/oracle-scheduler.service";

const router = Router();

const TROY_OZ_TO_GRAM = 31.1035;

// ─── Middleware ───────────────────────────────────────────────────────────────

const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (user.role !== "ADMIN")
      return res.status(403).json({ error: "Admin access required" });
    req.user = user;
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── GET /api/oracle/price ────────────────────────────────────────────────────
// Public endpoint — returns current oracle price in a clean format.

router.get("/price", async (req, res) => {
  try {
    // Try DB singleton first (fast path — updated by scheduler)
    const dbStatus = await (prisma as any).oracleStatus.findUnique({
      where: { id: "singleton" },
    });

    if (dbStatus && dbStatus.currentPrice > 0) {
      const ageMs = Date.now() - new Date(dbStatus.lastUpdatedAt).getTime();
      const isStale = ageMs > 3_600_000; // 1 hour
      return res.json({
        pricePerGram: dbStatus.currentPrice,
        pricePerOz: +(dbStatus.currentPrice * TROY_OZ_TO_GRAM).toFixed(4),
        lastUpdatedAt: dbStatus.lastUpdatedAt,
        lastUpdatedAgo: formatAgo(ageMs),
        isPaused: dbStatus.isPaused,
        isStale,
        source: dbStatus.source ?? "Median Oracle",
        currency: "USD",
      });
    }

    // Fallback: read directly from Soroban contract
    const contractPrice = await readOraclePriceFromContract();
    if (contractPrice) {
      return res.json({
        pricePerGram: contractPrice.pricePerGram,
        pricePerOz: +(contractPrice.pricePerGram * TROY_OZ_TO_GRAM).toFixed(4),
        lastUpdatedAt: new Date(contractPrice.timestamp).toISOString(),
        lastUpdatedAgo: formatAgo(Date.now() - contractPrice.timestamp),
        isPaused: contractPrice.isPaused,
        isStale: contractPrice.isStale,
        source: "Soroban Contract (direct)",
        currency: "USD",
      });
    }

    // No price available
    return res.status(503).json({
      error: "Oracle price not yet available. Scheduler may not have run yet.",
      isPaused: false,
      isStale: true,
    });
  } catch (err: any) {
    console.error("[OracleRoute] GET /price error:", err.message);
    res.status(500).json({ error: "Failed to fetch oracle price" });
  }
});

// ─── GET /api/oracle/status ────────────────────────────────────────────────────
// Public endpoint — full oracle health status.

router.get("/status", async (req, res) => {
  try {
    const [dbStatus, schedulerHealth] = await Promise.all([
      (prisma as any).oracleStatus.findUnique({ where: { id: "singleton" } }),
      Promise.resolve(getSchedulerHealth()),
    ]);

    const lastSubmission = await (prisma as any).oraclePriceSubmission.findFirst({
      orderBy: { submittedAt: "desc" },
    });

    const acceptedCount = await (prisma as any).oraclePriceSubmission.count({
      where: { accepted: true },
    });

    const rejectedCount = await (prisma as any).oraclePriceSubmission.count({
      where: { accepted: false },
    });

    const ageMs = dbStatus?.lastUpdatedAt
      ? Date.now() - new Date(dbStatus.lastUpdatedAt).getTime()
      : null;

    res.json({
      health: dbStatus?.isPaused
        ? "PAUSED"
        : !dbStatus || ageMs === null || ageMs > 3_600_000
          ? "STALE"
          : schedulerHealth.consecutiveFailures >= 3
            ? "DEGRADED"
            : "HEALTHY",
      currentPrice: dbStatus?.currentPrice ?? 0,
      lastUpdatedAt: dbStatus?.lastUpdatedAt ?? null,
      lastUpdatedAgo: ageMs !== null ? formatAgo(ageMs) : "never",
      isPaused: dbStatus?.isPaused ?? false,
      source: dbStatus?.source ?? "Median Oracle",
      scheduler: {
        isRunning: schedulerHealth.isRunning,
        consecutiveFailures: schedulerHealth.consecutiveFailures,
        schedule: schedulerHealth.schedule,
      },
      stats: {
        totalAccepted: acceptedCount,
        totalRejected: rejectedCount,
        lastSubmission: lastSubmission
          ? {
            submittedAt: lastSubmission.submittedAt,
            accepted: lastSubmission.accepted,
            pricePerGram: lastSubmission.pricePerGram,
            source: lastSubmission.source,
            txHash: lastSubmission.txHash,
          }
          : null,
      },
    });
  } catch (err: any) {
    console.error("[OracleRoute] GET /status error:", err.message);
    res.status(500).json({ error: "Failed to fetch oracle status" });
  }
});

// ─── GET /api/oracle/history ──────────────────────────────────────────────────
// Admin only — returns recent N price submissions.

router.get("/history", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) ?? "50"), 200);
    const submissions = await (prisma as any).oraclePriceSubmission.findMany({
      orderBy: { submittedAt: "desc" },
      take: limit,
    });
    res.json({ submissions, count: submissions.length });
  } catch (err: any) {
    console.error("[OracleRoute] GET /history error:", err.message);
    res.status(500).json({ error: "Failed to fetch oracle history" });
  }
});

// ─── POST /api/oracle/emergency-pause ────────────────────────────────────────
// Admin only — immediately pauses oracle price updates.

router.post("/emergency-pause", requireAdmin, async (req, res) => {
  try {
    await (prisma as any).oracleStatus.upsert({
      where: { id: "singleton" },
      update: { isPaused: true },
      create: {
        id: "singleton",
        currentPrice: 0,
        lastUpdatedAt: new Date(),
        isPaused: true,
        source: "Median Oracle",
        submitterCount: 1,
      },
    });

    console.warn(
      `[OracleRoute] ⚠️ Oracle PAUSED by admin: ${(req as any).user?.email ?? "unknown"}`
    );

    res.json({
      success: true,
      message:
        "Oracle paused. Price submissions are suspended. Use /api/oracle/unpause to resume.",
      pausedAt: new Date().toISOString(),
      pausedBy: (req as any).user?.email ?? "admin",
    });
  } catch (err: any) {
    console.error("[OracleRoute] POST /emergency-pause error:", err.message);
    res.status(500).json({ error: "Failed to pause oracle" });
  }
});

// ─── POST /api/oracle/unpause ─────────────────────────────────────────────────
// Admin only — resumes oracle price updates.

router.post("/unpause", requireAdmin, async (req, res) => {
  try {
    await (prisma as any).oracleStatus.upsert({
      where: { id: "singleton" },
      update: { isPaused: false },
      create: {
        id: "singleton",
        currentPrice: 0,
        lastUpdatedAt: new Date(),
        isPaused: false,
        source: "Median Oracle",
        submitterCount: 1,
      },
    });

    // Trigger one immediate cycle after unpause
    runOracleCycle().catch(console.error);

    res.json({
      success: true,
      message: "Oracle unpaused. Triggering immediate price update.",
    });
  } catch (err: any) {
    console.error("[OracleRoute] POST /unpause error:", err.message);
    res.status(500).json({ error: "Failed to unpause oracle" });
  }
});

// ─── Utility ──────────────────────────────────────────────────────────────────

function formatAgo(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default router;
