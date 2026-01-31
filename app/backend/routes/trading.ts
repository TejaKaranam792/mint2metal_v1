import express from "express";
import { z } from "zod";
import { tradingService, TradeType } from "../services/trading.service";
import { getUserFromToken } from "../services/auth.service";
import { generalRateLimit as rateLimit } from "../middleware/rate-limit.middleware";

const router = express.Router();

// Apply rate limiting to trading operations
router.use(rateLimit);

// Middleware to get user from token
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or missing authentication token" });
  }
};

// ---------- Schemas ----------
const submitIntentSchema = z.object({
  type: z.enum([TradeType.BUY, TradeType.SELL]),
  amount: z.number().positive("Amount must be positive"),
  price: z.number().positive("Price must be positive"),
  estimatedTokens: z.number().positive("Estimated tokens must be positive")
});

const executeTradeSchema = z.object({
  intentId: z.string().min(1, "Intent ID is required")
});

const cancelIntentSchema = z.object({
  intentId: z.string().min(1, "Intent ID is required")
});

// ---------- Routes ----------

// Submit trade intent
router.post("/intent", requireAuth, async (req, res) => {
  try {
    const { type, amount, price, estimatedTokens } = submitIntentSchema.parse(req.body);

    // Validate trade
    await tradingService.validateTrade(req.user.id, amount, type);

    const intent = await tradingService.submitTradeIntent(
      req.user.id,
      type,
      amount,
      price,
      estimatedTokens
    );

    res.status(201).json({
      success: true,
      intent,
      message: "Trade intent submitted successfully"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input",
        details: error.issues,
      });
    }
    console.error("Submit trade intent error:", error);
    res.status(400).json({ error: error.message || "Failed to submit trade intent" });
  }
});

// Execute trade (admin only)
router.post("/execute", requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { intentId } = executeTradeSchema.parse(req.body);

    // Note: In a real implementation, you'd get the admin keypair securely
    const trade = await tradingService.executeTrade(intentId, null as any); // Placeholder

    res.json({
      success: true,
      trade,
      message: "Trade executed successfully"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input",
        details: error.issues,
      });
    }
    console.error("Execute trade error:", error);
    res.status(400).json({ error: error.message || "Failed to execute trade" });
  }
});

// Cancel trade intent
router.post("/cancel", requireAuth, async (req, res) => {
  try {
    const { intentId } = cancelIntentSchema.parse(req.body);

    await tradingService.cancelTradeIntent(intentId, req.user.id);

    res.json({
      success: true,
      message: "Trade intent cancelled successfully"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input",
        details: error.issues,
      });
    }
    console.error("Cancel trade intent error:", error);
    res.status(400).json({ error: error.message || "Failed to cancel trade intent" });
  }
});

// Get user's trade history
router.get("/history", requireAuth, async (req, res) => {
  try {
    const trades = await tradingService.getUserTrades(req.user.id);
    res.json({ trades });
  } catch (error: any) {
    console.error("Get trade history error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get pending trade intents (user's own or all for admin)
router.get("/intents", requireAuth, async (req, res) => {
  try {
    const userId = req.user.role === 'ADMIN' ? undefined : req.user.id;
    const intents = await tradingService.getPendingIntents(userId);
    res.json({ intents });
  } catch (error: any) {
    console.error("Get pending intents error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Validate trade (pre-submission check)
router.post("/validate", requireAuth, async (req, res) => {
  try {
    const { type, amount } = req.body;

    if (!type || !amount) {
      return res.status(400).json({ error: "type and amount are required" });
    }

    const result = await tradingService.validateTrade(req.user.id, amount, type);
    res.json(result);
  } catch (error: any) {
    console.error("Validate trade error:", error);
    res.status(400).json({ error: error.message || "Trade validation failed" });
  }
});

export default router;
