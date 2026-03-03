import express, { Response } from "express";
import { prisma } from "../prisma";
import { authenticateTokenOrApiKey, AuthenticatedRequest } from "../middleware/auth.middleware";
import { TransparencyService } from "../services/transparency.service";

const router = express.Router();

/**
 * GET /api/v1/supply/:commodity
 * Returns circulating supply vs. vaulted supply.
 */
router.get("/supply/:commodity", authenticateTokenOrApiKey, async (req: AuthenticatedRequest, res: Response) => {
  const { commodity } = req.params;

  try {
    // 1. Get Circulating Supply
    const mints = await prisma.dSTMint.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED" }
    });

    const burns = await prisma.redemption.aggregate({
      _sum: { quantity: true },
      where: { status: "COMPLETED" }
    });

    const circulatingGrams = (mints._sum.amount || 0) - (burns._sum.quantity || 0);

    // 2. Get Vaulted Supply
    const vaults = await (prisma as any).vaultReceipt.aggregate({
      _sum: { gramsSecured: true },
      where: { commodityType: commodity, isUsed: true }
    });

    const vaultedGrams = vaults._sum.gramsSecured || 0;

    res.json({
      commodity,
      circulatingSupply: {
        grams: circulatingGrams,
        tokens: circulatingGrams // 1 gram = 1 token
      },
      vaultedSupply: {
        grams: vaultedGrams
      },
      backingRatio: vaultedGrams > 0 ? (vaultedGrams / circulatingGrams) : 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching supply:", error);
    res.status(500).json({ error: "Failed to fetch supply data" });
  }
});

/**
 * GET /api/v1/vault/reserves
 * Vault reserve verification and PoR hashes.
 */
router.get("/vault/reserves", authenticateTokenOrApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const receipts = await (prisma as any).vaultReceipt.findMany({
      where: { isUsed: true },
      select: {
        receiptId: true,
        vaultId: true,
        commodityType: true,
        gramsSecured: true,
        createdAt: true,
        verifier: {
          select: { id: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    res.json({
      totalReceipts: receipts.length,
      reserves: receipts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching vault reserves:", error);
    res.status(500).json({ error: "Failed to fetch vault reserve data" });
  }
});

/**
 * GET /api/v1/settlements
 * Settlement batch history.
 */
router.get("/settlements", authenticateTokenOrApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const batches = await (prisma as any).settlementBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        _count: {
          select: { mints: true }
        }
      }
    });

    res.json({
      batches,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching settlements:", error);
    res.status(500).json({ error: "Failed to fetch settlement batches" });
  }
});

/**
 * GET /api/v1/collateral/eligibility
 * Loan collateral status and LTV ratios.
 */
router.get("/collateral/eligibility", authenticateTokenOrApiKey, async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    assets: [
      {
        token: "DST",
        commodity: "XAG",
        isEligible: true,
        maxLtvRatio: 0.70, // 70% LTV
        liquidationThreshold: 0.85,
        baseCurrency: "USD"
      }
    ],
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/v1/prices/:commodity
 * Access to verified commodity oracle price feeds.
 */
router.get("/prices/:commodity", authenticateTokenOrApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const latestPrice = await prisma.commodityPrice.findFirst({
      where: { active: true },
      orderBy: { setAt: "desc" }
    });

    if (!latestPrice) {
      return res.status(404).json({ error: "Price feed not found" });
    }

    res.json({
      commodity: req.params.commodity,
      pricePerGram: latestPrice.pricePerGram,
      currency: latestPrice.currency || "USD",
      lastUpdated: latestPrice.setAt.toISOString()
    });
  } catch (error) {
    console.error("Error fetching price:", error);
    res.status(500).json({ error: "Failed to fetch price data" });
  }
});

/**
 * GET /api/v1/transparency/:commodity
 * Returns the full suite of transparency information (Treasury buffer + Circulating) for the public dashboard.
 */
router.get("/transparency/:commodity", authenticateTokenOrApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await TransparencyService.generateReconciliationReport(req.params.commodity);
    let lastPor = await prisma.systemSettings.findUnique({
      where: { key: "LATEST_POR_CID" }
    });

    // Fallback: If no system setting, get CID from latest used vault receipt
    let displayCid = lastPor?.value;
    if (!displayCid) {
      const latestReceipt = await prisma.vaultReceipt.findFirst({
        where: { commodityType: req.params.commodity, isUsed: true, ipfsCid: { not: null } },
        orderBy: { createdAt: 'desc' }
      });
      displayCid = latestReceipt?.ipfsCid || "N/A";
    }

    res.json({
      ...report,
      lastPoR: displayCid
    });
  } catch (error) {
    console.error("Error generating transparency report:", error);
    res.status(500).json({ error: "Failed to generate transparency report" });
  }
});

export default router;
