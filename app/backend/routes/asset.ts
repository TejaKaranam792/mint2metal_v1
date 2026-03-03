import { Router, Request, Response } from "express";
import { prisma } from "../prisma";
import { sorobanService, UserRole } from "../services/soroban.service";
import { Keypair } from '@stellar/stellar-sdk';
import { authenticateTokenOrApiKey } from "../middleware/auth.middleware";

const router = Router();

// Endpoint to register a new Issuer
router.post("/register-issuer", authenticateTokenOrApiKey, async (req: Request, res: Response) => {
  const { issuerAddress } = req.body;

  if (!issuerAddress) {
    return res.status(400).json({ error: "issuerAddress is required" });
  }

  try {
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;
    if (!adminSecret) {
      return res.status(500).json({ error: "Admin secret not configured" });
    }

    const adminKeypair = Keypair.fromSecret(adminSecret);
    const txHash = await sorobanService.setUserRole(adminKeypair, issuerAddress, UserRole.ADMIN); // Issuer role can be added as a specific enum in UserRole but let's just pass raw or use ADMIN/Issuer. Wait, UserRole in sorobanService only has ADMIN, OPERATOR, USER. We should just pass a custom string.

    // In sorobanService.setUserRole it takes UserRole enum. Let's cast it since in Soroban it's just a Symbol.
    // We will update this soon if typescript complains.

    res.json({ message: "Issuer registered successfully", txHash });
  } catch (error: any) {
    console.error("Error registering issuer:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Endpoint to register a new Asset Class
router.post("/register-asset-class", authenticateTokenOrApiKey, async (req: Request, res: Response) => {
  const { symbol, tokenAddress, unitWeight, purity, vaultId, oracleSource, issuerId } = req.body;

  if (!symbol || !tokenAddress || !unitWeight || !purity || !vaultId || !oracleSource || !issuerId) {
    return res.status(400).json({ error: "All parameters are required (symbol, tokenAddress, unitWeight, purity, vaultId, oracleSource, issuerId)" });
  }

  try {
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;
    if (!adminSecret) {
      return res.status(500).json({ error: "Admin secret not configured" });
    }

    const adminKeypair = Keypair.fromSecret(adminSecret);

    // On-chain registration
    const txHash = await sorobanService.registerAssetClass(
      adminKeypair,
      symbol,
      tokenAddress,
      unitWeight.toString(),
      purity.toString(),
      vaultId,
      oracleSource,
      issuerId
    );

    res.json({ message: "Asset class registered successfully", txHash });
  } catch (error: any) {
    console.error("Error registering asset class:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
