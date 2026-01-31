import express from "express";
import { z } from "zod";
import { walletService } from "../services/wallet.service";
import { getUserFromToken } from "../services/auth.service";
import { generalRateLimit as rateLimit } from "../middleware/rate-limit.middleware";

const router = express.Router();

// Apply rate limiting to wallet operations
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
const transferSchema = z.object({
  toAddress: z.string().min(1, "Recipient address is required"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be a positive number"
  )
});

// ---------- Routes ----------

// Get wallet info and balance
router.get("/info", requireAuth, async (req, res) => {
  try {
    const walletInfo = await walletService.getWalletInfo(req.user.id);

    if (!walletInfo) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    res.json(walletInfo);
  } catch (error: any) {
    console.error("Get wallet info error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get wallet balance only
router.get("/balance", requireAuth, async (req, res) => {
  try {
    const balance = await walletService.getWalletBalance(req.user.id);
    res.json({ balance });
  } catch (error: any) {
    console.error("Get wallet balance error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Transfer tokens
router.post("/transfer", requireAuth, async (req, res) => {
  try {
    const { toAddress, amount } = transferSchema.parse(req.body);

    const txHash = await walletService.transferTokens(req.user.id, toAddress, amount);

    res.json({
      success: true,
      txHash,
      message: "Transfer initiated successfully"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input",
        details: error.issues,
      });
    }
    console.error("Transfer error:", error);
    res.status(400).json({ error: error.message || "Transfer failed" });
  }
});

// Get transaction history
router.get("/transactions", requireAuth, async (req, res) => {
  try {
    const transactions = await walletService.getWalletTransactions(req.user.id);
    res.json({ transactions });
  } catch (error: any) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Check if user has wallet
router.get("/exists", requireAuth, async (req, res) => {
  try {
    const hasWallet = await walletService.userHasWallet(req.user.id);
    res.json({ hasWallet });
  } catch (error: any) {
    console.error("Check wallet exists error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Create wallet for user (if they don't have one)
router.post("/create", requireAuth, async (req, res) => {
  try {
    // Check if user already has a wallet
    const hasWallet = await walletService.userHasWallet(req.user.id);
    if (hasWallet) {
      return res.status(400).json({ error: "User already has a wallet" });
    }

    const { address } = await walletService.createWallet(req.user.id);

    res.status(201).json({
      success: true,
      address,
      message: "Wallet created successfully"
    });
  } catch (error: any) {
    console.error("Create wallet error:", error);
    res.status(400).json({ error: error.message || "Failed to create wallet" });
  }
});

// Connect external wallet (Freighter)
router.post("/connect-external", requireAuth, async (req, res) => {
  try {
    const { address, network } = req.body;

    if (!address || !network) {
      return res.status(400).json({ error: "address and network are required" });
    }

    await walletService.connectExternalWallet(req.user.id, address, network);

    res.json({
      success: true,
      message: "External wallet connected successfully"
    });
  } catch (error: any) {
    console.error("Connect external wallet error:", error);
    res.status(400).json({ error: error.message || "Failed to connect external wallet" });
  }
});

// Get wallet info
router.get("/info", requireAuth, async (req, res) => {
  try {
    const walletInfo = await walletService.getWalletInfo(req.user.id);

    if (!walletInfo) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    res.json(walletInfo);
  } catch (error: any) {
    console.error("Get wallet info error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Disconnect external wallet
router.post("/disconnect-external", requireAuth, async (req, res) => {
  try {
    await walletService.disconnectExternalWallet(req.user.id);

    res.json({
      success: true,
      message: "External wallet disconnected successfully"
    });
  } catch (error: any) {
    console.error("Disconnect external wallet error:", error);
    res.status(400).json({ error: error.message || "Failed to disconnect external wallet" });
  }
});

export default router;
