import { Router } from "express";
import { requireApiKey } from "../middleware/auth.middleware";
import { getCurrentSilverPrice, getVaultInventory, lockPriceForUser } from "../services/silver.service";
import { sorobanService } from "../services/soroban.service";
import { prisma } from "../prisma";

const router = Router();

// ================================================================
// MINT2METAL — B2B PARTNER API
// All endpoints require:  x-api-key: m2m_<your_secret>
// Permissions:
//   READ_ONLY  → price, vault, portfolio queries
//   TRADE      → buy, sell, price-lock, order management
//   FULL_ACCESS → all of the above
// ================================================================

const hasPermission = (apiKey: any, ...perms: string[]) =>
  apiKey.permissions.includes("FULL_ACCESS") ||
  perms.some((p) => apiKey.permissions.includes(p));

// ----------------------------------------------------------------
// 1. MARKET DATA
// ----------------------------------------------------------------

/**
 * GET /b2b/silver-price
 * Returns the current admin-set M2M price per gram of silver.
 */
router.get("/silver-price", requireApiKey, async (req: any, res) => {
  if (!hasPermission(req.apiKey, "READ_ONLY", "TRADE"))
    return res.status(403).json({ error: "Missing READ_ONLY permission" });
  try {
    const price = await getCurrentSilverPrice();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: price
        ? {
          pricePerGram: price.pricePerGram,
          currency: price.currency || "M2M",
          setAt: price.setAt,
        }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /b2b/vault-status
 * Returns full vault inventory: total assets, weight, and individual items.
 */
router.get("/vault-status", requireApiKey, async (req: any, res) => {
  if (!hasPermission(req.apiKey, "READ_ONLY", "TRADE"))
    return res.status(403).json({ error: "Missing READ_ONLY permission" });
  try {
    const inventory = await getVaultInventory();
    res.json({ success: true, timestamp: new Date().toISOString(), data: inventory });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /b2b/treasury-balance
 * Returns the Stellar on-chain treasury balance.
 */
router.get("/treasury-balance", requireApiKey, async (req: any, res) => {
  if (!hasPermission(req.apiKey, "READ_ONLY", "TRADE"))
    return res.status(403).json({ error: "Missing READ_ONLY permission" });
  try {
    const treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY;
    if (!treasuryPublicKey)
      return res.status(500).json({ success: false, error: "Treasury public key not configured" });
    const balance = await sorobanService.getBalance(treasuryPublicKey);
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        network: process.env.STELLAR_NETWORK || "testnet",
        account: treasuryPublicKey,
        balance,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ----------------------------------------------------------------
// 2. TRADING — BUY SILVER
// ----------------------------------------------------------------

/**
 * POST /b2b/buy
 * Place a buy order for silver. Creates an Order in PENDING status.
 *
 * Body: { quantityGrams: number }
 * Response: { orderId, quantityGrams, priceLocked, totalCost, status }
 */
router.post("/buy", requireApiKey, async (req: any, res) => {
  if (!hasPermission(req.apiKey, "TRADE"))
    return res.status(403).json({ error: "Missing TRADE permission" });

  const { quantityGrams } = req.body;
  if (!quantityGrams || isNaN(Number(quantityGrams)) || Number(quantityGrams) <= 0)
    return res.status(400).json({ error: "quantityGrams must be a positive number" });

  try {
    const userId = req.apiKey.userId;

    // Fetch current price
    const price = await getCurrentSilverPrice();
    if (!price)
      return res.status(503).json({ error: "Silver price not yet set by admin. Try again shortly." });

    const qty = Number(quantityGrams);
    const totalCost = qty * price.pricePerGram;

    // Create the order
    const order = await prisma.order.create({
      data: {
        userId,
        type: "BUY",
        quantityGrams: qty,
        priceLocked: price.pricePerGram,
        status: "PENDING",
        isTestnet: true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        type: "BUY",
        quantityGrams: order.quantityGrams,
        priceLocked: order.priceLocked,
        currency: price.currency || "M2M",
        totalCost: parseFloat(totalCost.toFixed(4)),
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (err: any) {
    console.error("B2B /buy error:", err);
    res.status(500).json({ success: false, error: "Failed to create buy order" });
  }
});

// ----------------------------------------------------------------
// 3. TRADING — SELL SILVER
// ----------------------------------------------------------------

/**
 * POST /b2b/sell
 * Place a sell order. User must have sufficient DST balance.
 *
 * Body: { quantityGrams: number }
 */
router.post("/sell", requireApiKey, async (req: any, res) => {
  if (!hasPermission(req.apiKey, "TRADE"))
    return res.status(403).json({ error: "Missing TRADE permission" });

  const { quantityGrams } = req.body;
  if (!quantityGrams || isNaN(Number(quantityGrams)) || Number(quantityGrams) <= 0)
    return res.status(400).json({ error: "quantityGrams must be a positive number" });

  try {
    const userId = req.apiKey.userId;

    // Check wallet balance
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet)
      return res.status(400).json({ error: "No wallet linked to this account" });

    const qty = Number(quantityGrams);
    if (wallet.balance < qty)
      return res.status(400).json({
        error: `Insufficient balance. You have ${wallet.balance} DST but tried to sell ${qty}.`,
      });

    // Fetch current price
    const price = await getCurrentSilverPrice();
    if (!price)
      return res.status(503).json({ error: "Silver price not set" });

    const order = await prisma.order.create({
      data: {
        userId,
        type: "SELL",
        quantityGrams: qty,
        priceLocked: price.pricePerGram,
        status: "PENDING",
        isTestnet: true,
      },
    });

    const totalValue = qty * price.pricePerGram;

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        type: "SELL",
        quantityGrams: order.quantityGrams,
        priceLocked: order.priceLocked,
        currency: price.currency || "M2M",
        totalValue: parseFloat(totalValue.toFixed(4)),
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (err: any) {
    console.error("B2B /sell error:", err);
    res.status(500).json({ success: false, error: "Failed to create sell order" });
  }
});

// ----------------------------------------------------------------
// 4. ORDER MANAGEMENT
// ----------------------------------------------------------------

/**
 * GET /b2b/orders
 * List all orders for this API key's user.
 * Optional: ?type=BUY|SELL&status=PENDING|SETTLED|REJECTED&limit=20
 */
router.get("/orders", requireApiKey, async (req: any, res) => {
  if (!hasPermission(req.apiKey, "READ_ONLY", "TRADE"))
    return res.status(403).json({ error: "Missing READ_ONLY permission" });

  try {
    const userId = req.apiKey.userId;
    const { type, status, limit } = req.query as Record<string, string>;

    const orders = await prisma.order.findMany({
      where: {
        userId,
        ...(type ? { type: type as any } : {}),
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(parseInt(limit || "50"), 100),
    });

    res.json({
      success: true,
      count: orders.length,
      data: orders.map((o) => ({
        orderId: o.id,
        type: o.type,
        quantityGrams: o.quantityGrams,
        priceLocked: o.priceLocked,
        status: o.status,
        createdAt: o.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /b2b/orders/:id
 * Get a specific order by ID.
 */
router.get("/orders/:id", requireApiKey, async (req: any, res) => {
  if (!hasPermission(req.apiKey, "READ_ONLY", "TRADE"))
    return res.status(403).json({ error: "Missing READ_ONLY permission" });

  try {
    const userId = req.apiKey.userId;
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!order)
      return res.status(404).json({ error: "Order not found" });

    const price = await getCurrentSilverPrice();
    res.json({
      success: true,
      data: {
        orderId: order.id,
        type: order.type,
        quantityGrams: order.quantityGrams,
        priceLocked: order.priceLocked,
        currentPricePerGram: price?.pricePerGram || null,
        estimatedCurrentValue: price ? order.quantityGrams * price.pricePerGram : null,
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ----------------------------------------------------------------
// 5. PRICE LOCK
// ----------------------------------------------------------------

/**
 * POST /b2b/price-lock
 * Lock the current silver price for up to 60 minutes.
 * The locked price is guaranteed for order execution within that window.
 *
 * Body: { lockDurationMinutes?: number (default 15, max 60) }
 */
router.post("/price-lock", requireApiKey, async (req: any, res) => {
  if (!hasPermission(req.apiKey, "TRADE"))
    return res.status(403).json({ error: "Missing TRADE permission" });

  try {
    const userId = req.apiKey.userId;
    const lockDuration = Math.min(parseInt(req.body.lockDurationMinutes || "15"), 60);

    const price = await getCurrentSilverPrice();
    if (!price)
      return res.status(503).json({ error: "Silver price not set" });

    const expiresAt = new Date(Date.now() + lockDuration * 60 * 1000);

    const lock = await prisma.priceLock.create({
      data: {
        userId,
        price: price.pricePerGram,
        lockedPrice: price.pricePerGram,
        expiresAt,
        status: "ACTIVE",
      },
    });

    res.status(201).json({
      success: true,
      data: {
        lockId: lock.id,
        lockedPrice: lock.lockedPrice,
        currency: price.currency || "M2M",
        lockedAt: lock.lockedAt,
        expiresAt: lock.expiresAt,
        validForMinutes: lockDuration,
      },
    });
  } catch (err: any) {
    console.error("B2B /price-lock error:", err);
    res.status(500).json({ success: false, error: "Failed to lock price" });
  }
});

// ----------------------------------------------------------------
// 6. PORTFOLIO / ACCOUNT
// ----------------------------------------------------------------

/**
 * GET /b2b/portfolio
 * Returns the account's wallet balance, orders summary, and current DST value.
 */
router.get("/portfolio", requireApiKey, async (req: any, res) => {
  if (!hasPermission(req.apiKey, "READ_ONLY", "TRADE"))
    return res.status(403).json({ error: "Missing READ_ONLY permission" });

  try {
    const userId = req.apiKey.userId;

    const [wallet, orders, price] = await Promise.all([
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      getCurrentSilverPrice(),
    ]);

    const balance = wallet?.balance ?? 0;
    const estimatedValue = price ? balance * price.pricePerGram : null;

    const totalBought = orders
      .filter((o) => o.type === "BUY" && o.status === "SETTLED")
      .reduce((sum, o) => sum + o.quantityGrams, 0);

    const totalSold = orders
      .filter((o) => o.type === "SELL" && o.status === "SETTLED")
      .reduce((sum, o) => sum + o.quantityGrams, 0);

    res.json({
      success: true,
      data: {
        wallet: wallet
          ? {
            address: wallet.address,
            dstBalance: balance,
            estimatedValueM2M: estimatedValue,
            chain: wallet.chain,
          }
          : null,
        pricePerGram: price?.pricePerGram || null,
        currency: price?.currency || "M2M",
        summary: {
          totalBoughtGrams: totalBought,
          totalSoldGrams: totalSold,
          netHoldings: totalBought - totalSold,
          pendingOrders: orders.filter((o) => o.status === "PENDING").length,
        },
        recentOrders: orders.map((o) => ({
          orderId: o.id,
          type: o.type,
          quantityGrams: o.quantityGrams,
          status: o.status,
          createdAt: o.createdAt,
        })),
      },
    });
  } catch (err: any) {
    console.error("B2B /portfolio error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ----------------------------------------------------------------
// 7. REDEMPTION REQUESTS
// ----------------------------------------------------------------

/**
 * POST /b2b/redeem
 * Submit a redemption request to convert DST tokens back to physical silver.
 *
 * Body: { quantityGrams: number, deliveryAddress: string }
 */
router.post("/redeem", requireApiKey, async (req: any, res) => {
  if (!hasPermission(req.apiKey, "TRADE"))
    return res.status(403).json({ error: "Missing TRADE permission" });

  const { quantityGrams, deliveryAddress } = req.body;
  if (!quantityGrams || !deliveryAddress)
    return res.status(400).json({ error: "quantityGrams and deliveryAddress are required" });

  try {
    const userId = req.apiKey.userId;
    const qty = Number(quantityGrams);

    // Check balance
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < qty)
      return res.status(400).json({
        error: `Insufficient DST balance. Have: ${wallet?.balance ?? 0}, requested: ${qty}`,
      });

    const redemption = await prisma.redemption.create({
      data: {
        userId,
        quantity: qty,
        address: deliveryAddress,
        status: "REQUESTED",
      },
    });

    res.status(201).json({
      success: true,
      data: {
        redemptionId: redemption.id,
        quantityGrams: redemption.quantity,
        deliveryAddress: redemption.address,
        status: redemption.status,
        requestedAt: redemption.requestedAt,
        message: "Redemption request submitted. Our team will process it within 3-5 business days.",
      },
    });
  } catch (err: any) {
    console.error("B2B /redeem error:", err);
    res.status(500).json({ success: false, error: "Failed to submit redemption" });
  }
});

export default router;
