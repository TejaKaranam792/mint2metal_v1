import express from "express";
import { z } from "zod";
import { sorobanService } from "../services/soroban.service";
import { getUserFromToken } from "../services/auth.service";

const router = express.Router();

// Middleware to check admin role
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const user = await getUserFromToken(req);
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden - Admin access required" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or missing authentication token" });
  }
};

// ---------- Schemas ----------
const balanceSchema = z.object({
  address: z.string().min(1),
});

const transferSchema = z.object({
  fromSecret: z.string().min(1),
  to: z.string().min(1),
  amount: z.string().min(1),
});

const freezeSchema = z.object({
  adminSecret: z.string().min(1),
  address: z.string().min(1),
  frozen: z.boolean(),
});

const roleSchema = z.object({
  adminSecret: z.string().min(1),
  address: z.string().min(1),
  role: z.enum(["ADMIN", "OPERATOR", "USER"]),
});

const reservesSchema = z.object({
  adminSecret: z.string().min(1),
  proofHash: z.string().min(1),
  totalSilverGrams: z.string().min(1),
});

// ---------- Routes ----------
// Get token balance
router.get("/balance/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const balance = await sorobanService.getBalance(address);
    res.json({ balance });
  } catch (error) {
    console.error("Get balance error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get total supply
router.get("/supply", async (req, res) => {
  try {
    const supply = await sorobanService.getTotalSupply();
    res.json({ totalSupply: supply });
  } catch (error) {
    console.error("Get total supply error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get reserves proof
router.get("/reserves", async (req, res) => {
  try {
    const reserves = await sorobanService.getReservesProof();
    res.json(reserves);
  } catch (error) {
    console.error("Get reserves proof error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Transfer tokens (user operation)
router.post("/transfer", async (req, res) => {
  try {
    const { fromSecret, to, amount } = transferSchema.parse(req.body);

    const txHash = await sorobanService.transferTokens(
      require("stellar-sdk").Keypair.fromSecret(fromSecret),
      to,
      amount
    );

    res.json({ txHash });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input",
        details: error.issues,
      });
    }
    console.error("Transfer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Set freeze status (admin only)
router.post("/freeze", requireAdmin, async (req, res) => {
  try {
    const { adminSecret, address, frozen } = freezeSchema.parse(req.body);

    const txHash = await sorobanService.setFreezeStatus(
      require("stellar-sdk").Keypair.fromSecret(adminSecret),
      address,
      frozen
    );

    res.json({ txHash });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input",
        details: error.issues,
      });
    }
    console.error("Freeze status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Set user role (admin only)
router.post("/role", requireAdmin, async (req, res) => {
  try {
    const { adminSecret, address, role } = roleSchema.parse(req.body);

    const txHash = await sorobanService.setUserRole(
      require("stellar-sdk").Keypair.fromSecret(adminSecret),
      address,
      role as any
    );

    res.json({ txHash });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input",
        details: error.issues,
      });
    }
    console.error("Set role error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Anchor reserves proof (admin only)
router.post("/reserves", requireAdmin, async (req, res) => {
  try {
    const { adminSecret, proofHash, totalSilverGrams } = reservesSchema.parse(req.body);

    const txHash = await sorobanService.anchorReservesProof(
      require("stellar-sdk").Keypair.fromSecret(adminSecret),
      proofHash,
      totalSilverGrams
    );

    res.json({ txHash });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input",
        details: error.issues,
      });
    }
    console.error("Anchor reserves error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
