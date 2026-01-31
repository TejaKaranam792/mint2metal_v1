import { prisma } from "../prisma";
import { sorobanService } from "./soroban.service";
import { Keypair } from '@stellar/stellar-sdk';
import { AuditService, AuditAction } from "./audit.service";
import { getVaultInventory, checkMintEligibility } from "./silver.service";

export async function approveMint(walletId: string, silverAssetId: string) {
  // Get userId from wallet
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
  });

  if (!wallet) {
    throw new Error("Wallet not found");
  }

  return prisma.dSTMint.create({
    data: {
      userId: wallet.userId,
      walletId,
      silverAssetId,
      amount: 1, // 1g = 1 DST (MVP rule)
      status: "APPROVED",
    },
  });
}

export async function executeMint(mintId: string, adminSecret: string) {
  // Get mint details
  const mint = await prisma.dSTMint.findUnique({
    where: { id: mintId },
    include: { wallet: true, silverAsset: true }
  });

  if (!mint || mint.status !== "APPROVED") {
    throw new Error("Mint not found or not approved");
  }

  if (!mint.silverAsset) {
    throw new Error("Silver asset not found");
  }

  // Get admin keypair
  const adminKeypair = Keypair.fromSecret(adminSecret);

  // Generate reserves proof (simplified for MVP)
  const reservesProof = `vault-${mint.silverAsset.vaultId}-asset-${mint.silverAssetId}`;

  try {
    // Mint tokens on Soroban
    const txHash = await sorobanService.mintTokens(
      adminKeypair,
      mint.wallet.address,
      mint.amount.toString(),
      reservesProof
    );

    // Update mint record
    return prisma.dSTMint.update({
      where: { id: mintId },
      data: {
        status: "MINTED",
        txHash,
        mintedAt: new Date(),
      },
    });
  } catch (error) {
    // Update status to failed
    await prisma.dSTMint.update({
      where: { id: mintId },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

export async function markMinted(mintId: string, txHash: string) {
  return prisma.dSTMint.update({
    where: { id: mintId },
    data: {
      status: "MINTED",
      txHash,
      mintedAt: new Date(),
    },
  });
}

// Full Minting Orchestrator Flow
export async function initiateMintIntent(
  userId: string,
  requestedGrams: number
) {
  // Check user eligibility
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true },
  });

  if (!user || user.kycStatus !== "VERIFIED") {
    throw new Error("User not KYC verified");
  }
  if (user.amlStatus === "BLOCKED" as any) {
    throw new Error("User is blocked");
  }
  if (!user.wallet) {
    // Create a wallet for the user if not exists
    user.wallet = await prisma.wallet.create({
      data: {
        userId,
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', // Test address
      },
    });
  }

  // Check vault inventory
  const inventory = await getVaultInventory();
  if (inventory.totalWeight < requestedGrams) {
    throw new Error("Insufficient silver in vault");
  }

  // Find available silver asset
  const availableAsset = await prisma.silverAsset.findFirst({
    where: {
      mint: null, // Not yet minted
      weightGrams: {
        gte: requestedGrams,
      },
    },
  });

  if (!availableAsset) {
    throw new Error("No suitable silver asset available");
  }

  // Create price lock (simplified for MVP)
  const priceLock = await prisma.priceLock.create({
    data: {
      userId,
      silverAssetId: availableAsset.id,
      price: 7500, // Current silver price
      lockedPrice: 7500, // Current silver price
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    },
  });

  // Create mint intent record
  const mintIntent = await prisma.dSTMint.create({
    data: {
      userId,
      walletId: user.wallet.id,
      silverAssetId: availableAsset.id,
      amount: requestedGrams,
      status: "REQUESTED",
    },
  });

  // Log audit
  await AuditService.logAction(
    userId,
    AuditAction.MINT_REQUESTED,
    mintIntent.id,
    { requestedGrams, priceLockId: priceLock.id },
    undefined,
    undefined
  );

  return {
    mintIntent,
    priceLock,
    estimatedTokens: requestedGrams, // 1:1 ratio
    expiresAt: priceLock.expiresAt,
  };
}

export async function executeFullMintFlow(
  adminId: string,
  mintIntentId: string,
  adminSecret: string
) {
  // Get mint intent
  const mintIntent = await prisma.dSTMint.findUnique({
    where: { id: mintIntentId },
    include: {
      wallet: { include: { user: true } },
      silverAsset: true,
    },
  });

  if (!mintIntent || mintIntent.status !== "REQUESTED") {
    throw new Error("Mint intent not found or not in requested state");
  }

  // Check if price lock is still active
  const priceLock = await prisma.priceLock.findFirst({
    where: {
      userId: mintIntent.wallet.userId,
      silverAssetId: mintIntent.silverAssetId,
      status: "ACTIVE",
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!priceLock) {
    throw new Error("Price lock expired or invalid");
  }

  // Verify vault has the silver
  const vaultCheck = await checkMintEligibility();
  if (!vaultCheck.canMint || vaultCheck.availableGrams < mintIntent.amount) {
    throw new Error("Vault verification failed");
  }

  // Execute minting
  const result = await executeMint(mintIntentId, adminSecret);

  // Mark price lock as used
  await prisma.priceLock.update({
    where: { id: priceLock.id },
    data: { status: "USED", usedForMint: true },
  });

  // Log full flow completion
  await AuditService.logAction(
    adminId,
    AuditAction.ADMIN_ACTION,
    "FULL_MINT_FLOW_COMPLETED",
    {
      mintIntentId,
      userId: mintIntent.wallet.userId,
      amount: mintIntent.amount,
      txHash: result.txHash,
    },
    undefined,
    undefined
  );

  return result;
}

// Ledger Reconciliation
export async function reconcileLedger() {
  // Get all minted DST tokens
  const mintedTokens = await prisma.dSTMint.aggregate({
    where: { status: "MINTED" },
    _sum: { amount: true },
  });

  // Get all burned tokens from redemptions
  const burnedTokens = await prisma.redemption.aggregate({
    where: { status: "FULFILLED" },
    _sum: { quantity: true },
  });

  // Get current total supply from Soroban
  const sorobanService = (await import("./soroban.service")).sorobanService;
  const totalSupply = await sorobanService.getTotalSupply();

  const ledgerState = {
    mintedTokens: mintedTokens._sum.amount || 0,
    burnedTokens: burnedTokens._sum.quantity || 0,
    netCirculating: (mintedTokens._sum.amount || 0) - (burnedTokens._sum.quantity || 0),
    blockchainTotalSupply: parseFloat(totalSupply),
    reconciled: Math.abs(
      ((mintedTokens._sum.amount || 0) - (burnedTokens._sum.quantity || 0)) - parseFloat(totalSupply)
    ) < 0.01, // Allow for small floating point differences
  };

  return ledgerState;
}

// System Controls
export async function pauseMinting(adminId: string, paused: boolean) {
  // Store in system settings
  await prisma.systemSettings.upsert({
    where: { key: "MINTING_PAUSED" },
    update: {
      value: paused.toString(),
      updatedBy: adminId,
      updatedAt: new Date(),
    },
    create: {
      key: "MINTING_PAUSED",
      value: paused.toString(),
      description: "Whether minting is paused system-wide",
      updatedBy: adminId,
    },
  });

  await AuditService.logAction(
    adminId,
    AuditAction.ADMIN_ACTION,
    "MINTING_PAUSE_TOGGLE",
    { paused },
    undefined,
    undefined
  );

  return { paused };
}

export async function isMintingPaused() {
  const setting = await prisma.systemSettings.findUnique({
    where: { key: "MINTING_PAUSED" },
  });

  return setting?.value === "true";
}
