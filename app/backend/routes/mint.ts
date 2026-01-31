import express from "express";
import { z } from "zod";
import { approveMint, executeMint, markMinted, initiateMintIntent } from "../services/mint.service";
import { getUserFromToken } from "../services/auth.service";

const router = express.Router();

// ---------- Schemas ----------
const mintApproveSchema = z.object({
  walletId: z.string().uuid(),
  silverAssetId: z.string().uuid(),
});

const mintExecuteSchema = z.object({
  mintId: z.string().uuid(),
  adminSecret: z.string().min(1),
});

const mintFinalizeSchema = z.object({
  mintId: z.string().uuid(),
  txHash: z.string().min(1),
});

const mintIntentSchema = z.object({
  requestedGrams: z.number().positive(),
});

// ---------- Routes ----------
router.post("/approve", async (req, res) => {
  try {
    const { walletId, silverAssetId } = mintApproveSchema.parse(req.body);
    const mint = await approveMint(walletId, silverAssetId);
    res.json(mint);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input",
        details: error.issues, // ✅ TS-correct
      });
    }

    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/execute", async (req, res) => {
  try {
    const { mintId, adminSecret } = mintExecuteSchema.parse(req.body);
    const minted = await executeMint(mintId, adminSecret);
    res.json(minted);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input",
        details: error.issues, // ✅ TS-correct
      });
    }

    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/finalize", async (req, res) => {
  try {
    const { mintId, txHash } = mintFinalizeSchema.parse(req.body);
    const minted = await markMinted(mintId, txHash);
    res.json(minted);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input",
        details: error.issues, // ✅ TS-correct
      });
    }

    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// New route for mint intent (frontend integration)
router.post("/initiate-intent", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { requestedGrams } = mintIntentSchema.parse(req.body);
    const result = await initiateMintIntent(user.id, requestedGrams);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input",
        details: error.issues,
      });
    }

    console.error("Mint intent error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

export default router;
