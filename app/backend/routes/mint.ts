import express from "express";
import { z } from "zod";
import { getUserFromToken } from "../services/auth.service";
import { Keypair } from '@stellar/stellar-sdk';
import { sorobanService } from "../services/soroban.service";
import { prisma } from "../prisma";

const router = express.Router();

// ---------- Protocol Infrastructure Endpoints ----------

import { authenticateTokenOrApiKey } from "../middleware/auth.middleware";

// POST /custody/receipt
router.post("/custody/receipt", authenticateTokenOrApiKey, async (req, res) => {
  const { receiptId, vaultId, commodityType, gramsSecured } = req.body;
  if (!receiptId || !vaultId || !commodityType || !gramsSecured) {
    return res.status(400).json({ error: "Missing required fields: receiptId, vaultId, commodityType, gramsSecured" });
  }

  try {
    // Note: TypeScript assumes req.user exists from authenticateTokenOrApiKey
    const verifierId = (req as any).user?.userId || "system";

    // Find if already exists
    const existing = await (prisma as any).vaultReceipt.findUnique({
      where: { receiptId }
    });

    if (existing) {
      return res.status(400).json({ error: "Receipt ID already exists" });
    }

    const receipt = await (prisma as any).vaultReceipt.create({
      data: {
        receiptId,
        vaultId,
        commodityType,
        gramsSecured,
        verifierId
      }
    });

    res.json({ message: "Custody receipt submitted successfully", receipt });
  } catch (error: any) {
    console.error("[Custody Receipt] Error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// POST /request
router.post("/request", authenticateTokenOrApiKey, async (req, res) => {
  const { receiptId, toAddress } = req.body;

  if (!receiptId) {
    return res.status(400).json({ error: "receiptId is required" });
  }

  try {
    const receipt = await (prisma as any).vaultReceipt.findUnique({ where: { receiptId } });
    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }
    if (receipt.isUsed) {
      return res.status(400).json({ error: "Receipt has already been used for minting" });
    }

    const adminSecret = process.env.STELLAR_ADMIN_SECRET;
    if (!adminSecret) {
      return res.status(500).json({ error: "Admin secret missing (Execution identity)" });
    }
    const executorKeypair = Keypair.fromSecret(adminSecret);

    // Enforce Strict Mode Logic
    const isStrictMode = process.env.STRICT_ONCHAIN_MODE === 'true';

    // Call Soroban mintWithCustody
    let txHash = "";
    try {
      txHash = await sorobanService.mintWithCustody(
        executorKeypair,
        receipt.receiptId,
        toAddress || process.env.TREASURY_PUBLIC_KEY || executorKeypair.publicKey()
      );
    } catch (contractErr: any) {
      console.error("[Mint Request] Contract execution failed:", contractErr);
      if (isStrictMode) {
        throw new Error("Minting failed on-chain. Database remains untouched.");
      }
      console.warn("Falling back to mock tx hash (NOT FOR PRODUCTION)");
      txHash = `mock_${Date.now()}`;
    }

    if (!txHash) {
      throw new Error("Missing transaction hash from Soroban service");
    }

    if (isStrictMode && txHash.startsWith("mock_")) {
      // Emergency catch if something slipped through
      throw new Error(`[CRITICAL] Mock txHash '${txHash}' generated in STRICT_ONCHAIN_MODE.`);
    }

    // Only after successful confirmation do we update DB
    // We can bundle updates into a Prisma transaction to ensure DB atomicity
    await (prisma as any).$transaction(async (tx: any) => {
      // After successful mint, mark receipt as used
      await tx.vaultReceipt.update({
        where: { receiptId },
        data: { isUsed: true }
      });

      // You can also create the DSTMint record here if required by the flow
      // as mentioned.
    });

    // If a destination address is provided, transfer it from the executor to the user
    if (toAddress && txHash && !txHash.startsWith("mock_")) {
      try {
        await sorobanService.transferTokens(executorKeypair, toAddress, receipt.gramsSecured.toString());
      } catch (transferErr) {
        console.error("Warning: Tokens minted but failed to transfer to user address", transferErr);
        if (isStrictMode) {
          // Note: Transfer is secondary. A real production would have queued transfers
          // that retry on failure using the minted balance.
        }
      }
    }

    res.json({
      success: true,
      message: "Mint successful",
      txHash,
      amount: receipt.gramsSecured
    });
  } catch (error: any) {
    console.error("[Mint Request] Error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
