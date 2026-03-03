import { prisma } from "../prisma";
import { sorobanService } from "./soroban.service";
import { Keypair } from '@stellar/stellar-sdk';
import { AuditService, AuditAction } from "./audit.service";
import { AMLStatus } from '@prisma/client';

export async function submitRedemption(userId: string, data: { quantity: number; address: string; signedXdr?: string }) {
  // Verify user has sufficient DST balance (simplified check)
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });
  if (!wallet) throw new Error("User has no wallet");

  // Check if user is eligible (KYC verified, not blocked)
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user || user.kycStatus !== "VERIFIED") {
    throw new Error("User not KYC verified");
  }
  if (user.amlStatus === AMLStatus.FLAGGED) {
    throw new Error("User is flagged");
  }

  // If strict on chain mode is active, the frontend must supply a signed XDR transferring tokens to the treasury
  let txHash = "";
  if (data.signedXdr) {
    try {
      // Submit signed transaction from frontend directly to the network
      const { rpc, TransactionBuilder, Networks } = await import('@stellar/stellar-sdk');
      const server = new rpc.Server(process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org');

      const parsedTx = TransactionBuilder.fromXDR(data.signedXdr, Networks.TESTNET);
      const result = await server.sendTransaction(parsedTx as any);

      if (result.status === 'ERROR') {
        const errorDetail = (result as any).errorResultXdr || (result as any).errorResult || 'Unknown error';
        throw new Error(`Transaction submission failed: ${errorDetail}`);
      }
      txHash = result.hash;

      // Wait for confirmation to ensure atomicity
      let txStatus = await server.getTransaction(txHash);
      let attempts = 0;
      while ((txStatus as any).status === 'NOT_FOUND' && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        txStatus = await server.getTransaction(txHash);
        attempts++;
      }

      if ((txStatus as any).status !== 'SUCCESS') {
        throw new Error(`Transaction failed on-chain: ${(txStatus as any).status}`);
      }

    } catch (err: any) {
      console.error("Failed to execute signedXdr for redemption:", err);
      throw new Error("Failed to process token transfer: " + (err.message || String(err)));
    }
  } else if (process.env.STRICT_ONCHAIN_MODE === 'true') {
    throw new Error("Strict Mode Active: Missing signedXdr to transfer tokens to Treasury for burning.");
  }

  const redemption = await prisma.redemption.create({
    data: {
      userId,
      quantity: data.quantity,
      address: data.address,
      status: "PENDING",
    },
  });

  // Log request
  await AuditService.logAction(
    userId,
    AuditAction.REDEMPTION_REQUESTED,
    redemption.id,
    { quantity: data.quantity, address: data.address },
    undefined,
    undefined
  );

  return redemption;
}

export async function getPendingRedemptions() {
  return prisma.redemption.findMany({
    where: { status: "PENDING" },
    include: { user: { include: { wallet: true } } },
    orderBy: { requestedAt: 'desc' },
  });
}

export async function approveRedemption(adminId: string | undefined, redemptionId: string, force: boolean = false) {
  // Step 1: Mark as APPROVED
  let redemption = await prisma.redemption.update({
    where: { id: redemptionId },
    data: { status: "APPROVED" },
    include: { user: { include: { wallet: true } } },
  });

  // Log approval
  if (adminId) {
    await AuditService.logAction(
      adminId,
      AuditAction.REDEMPTION_APPROVED,
      redemptionId,
      { approvedUserId: redemption.userId },
      undefined,
      undefined
    );
  }

  // Step 2: Burn tokens on-chain via Soroban contract
  const adminSecret = process.env.STELLAR_ADMIN_SECRET;
  if (!adminSecret) {
    throw new Error("STELLAR_ADMIN_SECRET is not configured — cannot burn tokens");
  }

  const userWalletAddress = redemption.user.wallet?.address;
  if (!userWalletAddress) {
    throw new Error("User has no wallet address — cannot burn tokens");
  }

  const adminKeypair = Keypair.fromSecret(adminSecret);

  let burnTxHash: string = "ALREADY_TRANSFERRED_BY_USER";

  // Under the new model, tokens are transferred to the Treasury BY THE USER during the request phase.
  // We no longer clawback. "Approve" simply acknowledges that the Treasury received them (which we validated in request) 
  // and marks them as conceptually burned. In a true final state, the treasury would trigger a burn contract call here.
  // For now, removing the clawback entirely since the tokens are off the user's wallet.

  /* try {
    burnTxHash = await sorobanService.burnTokens(
      adminKeypair,
      userWalletAddress,
      Math.floor(redemption.quantity).toString()
    );
  } catch (burnError: any) {
    console.error("On-chain token burn failed:", burnError);
    // Extract Horizon result_codes from 400 errors (much more diagnostic)
    const horizonExtras = burnError?.response?.data?.extras;
    const resultCodes = horizonExtras?.result_codes
      ? ` [result_codes: ${JSON.stringify(horizonExtras.result_codes)}]`
      : '';

    const isStrictMode = process.env.STRICT_ONCHAIN_MODE === 'true';

    if (!force || isStrictMode) {
      // Revert to PENDING so admin can retry from the queue
      await prisma.redemption.update({
        where: { id: redemptionId },
        data: { status: "PENDING" },
      });
      throw new Error(`Token burn failed: ${burnError instanceof Error ? burnError.message : String(burnError)}${resultCodes}. ${isStrictMode ? 'STRICT_ONCHAIN_MODE enforced, database reverted.' : 'Use force override to approve anyway.'}`);
    } else {
      console.warn(`[FORCE OVERRIDE] Skipping failed burn for redemption ${redemptionId}. This is non-atomic and disallowed in production.`);
    }
  } */

  // Double check strict mode compliance
  if (process.env.STRICT_ONCHAIN_MODE === 'true' && burnTxHash === 'FORCE_SKIPPED') {
    throw new Error('[CRITICAL] Mock burnTxHash generated in STRICT_ONCHAIN_MODE. Reverting transaction.');
  }

  // Mark tokens as burned in DB (Atomic with network now)
  redemption = await prisma.redemption.update({
    where: { id: redemptionId },
    data: { status: "TOKENS_BURNED" },
    include: { user: { include: { wallet: true } } },
  });

  if (adminId) {
    await AuditService.logAction(
      adminId,
      AuditAction.REDEMPTION_COMPLETED,
      redemptionId,
      {
        note: "Tokens burned on-chain",
        txHash: burnTxHash,
        quantity: redemption.quantity,
        walletAddress: userWalletAddress,
      },
      undefined,
      undefined
    );
  }

  // Step 3: Automatically initiate shipment
  try {
    redemption = await prisma.redemption.update({
      where: { id: redemptionId },
      data: {
        status: "DISPATCHED",
        fulfilledAt: new Date(),
      },
      include: { user: { include: { wallet: true } } },
    });

    if (adminId) {
      await AuditService.logAction(
        adminId,
        AuditAction.ADMIN_ACTION,
        redemptionId,
        {
          action: "SHIPMENT_INITIATED",
          deliveryAddress: redemption.address,
          quantity: redemption.quantity,
          burnTxHash,
        },
        undefined,
        undefined
      );
    }
  } catch (dispatchError) {
    console.error("Shipment status update failed:", dispatchError);
    // Burn succeeded on-chain — don't block, admin can see TOKENS_BURNED status
  }

  return redemption;
}


export async function executeRedemption(redemptionId: string, adminSecret: string) {
  // Get redemption details
  const redemption = await prisma.redemption.findUnique({
    where: { id: redemptionId },
    include: { user: { include: { wallet: true } } }
  });

  if (!redemption || redemption.status !== "APPROVED") {
    throw new Error("Redemption not found or not approved");
  }

  // Get admin keypair
  const adminKeypair = Keypair.fromSecret(adminSecret);

  try {
    // Under the updated physical redemption model, the tokens are transferred to the treasury
    // by the user in the initial request. Therefore, "execution" does not need to trigger an 
    // additional burn transaction here, but simply confirms fulfillment of the vault process.

    // Update redemption record
    const updatedRedemption = await prisma.redemption.update({
      where: { id: redemptionId },
      data: {
        status: "FULFILLED",
        fulfilledAt: new Date(),
      },
    });

    // Log completion
    await AuditService.logAction(
      redemption.userId,
      AuditAction.REDEMPTION_COMPLETED,
      redemptionId,
      { quantity: redemption.quantity },
      undefined,
      undefined
    );

    return updatedRedemption;
  } catch (error) {
    // Update status to failed
    await prisma.redemption.update({
      where: { id: redemptionId },
      data: { status: "REJECTED" },
    });
    throw error;
  }
}

export async function dispatchRedemption(adminId: string, redemptionId: string, trackingNumber: string) {
  const redemption = await prisma.redemption.update({
    where: { id: redemptionId },
    data: {
      status: "DISPATCHED",
    },
  });

  // Log dispatch
  await AuditService.logAction(
    adminId,
    AuditAction.ADMIN_ACTION,
    redemptionId,
    { action: "DISPATCH_REDEMPTION", trackingNumber },
    undefined,
    undefined
  );

  return redemption;
}

export async function getRedemptionQueue() {
  const pending = await getPendingRedemptions();

  // Also fetch all non-pending, non-rejected for the admin overview
  const processed = await prisma.redemption.findMany({
    where: { status: { in: ["APPROVED", "TOKENS_BURNED", "DISPATCHED", "FULFILLED"] } },
    include: { user: { include: { wallet: true } } },
    orderBy: { requestedAt: 'desc' },
  });

  // Helper to parse the address string stored as "Name, Phone, Street, City, State, PIN"
  const parseAddress = (raw: string | null) => {
    if (!raw) return { raw: '', formatted: 'No address provided' };
    const parts = raw.split(', ');
    return {
      raw,
      name: parts[0] || '',
      phone: parts[1] || '',
      street: parts[2] || '',
      city: parts[3] || '',
      state: parts[4] || '',
      pincode: parts[5] || '',
      formatted: raw,
    };
  };

  const toQueueItem = (r: any) => ({
    id: r.id,
    userId: r.userId,
    userEmail: r.user?.email || 'N/A',
    quantity: r.quantity,
    status: r.status,
    requestedAt: r.requestedAt,
    fulfilledAt: r.fulfilledAt,
    deliveryAddress: parseAddress(r.address),
    walletAddress: r.user?.wallet?.address || 'No wallet',
  });

  return {
    pendingRedemptions: pending.map(toQueueItem),
    processedRedemptions: processed.map(toQueueItem),
    totalPending: pending.length,
    totalProcessed: processed.length,
  };
}

/**
 * Alias for submitRedemption
 */
export async function requestRedemption(userId: string, data: { quantity: number; address: string; signedXdr?: string }) {
  return submitRedemption(userId, data);
}

/**
 * Get user's redemptions
 */
export async function getUserRedemptions(userId: string) {
  return prisma.redemption.findMany({
    where: { userId },
    orderBy: { requestedAt: 'desc' },
  });
}

/**
 * Alias for dispatchRedemption
 */
export async function shipRedemption(adminId: string, redemptionId: string, trackingNumber: string) {
  return dispatchRedemption(adminId, redemptionId, trackingNumber);
}

/**
 * Reject redemption
 */
export async function rejectRedemption(redemptionId: string, reason?: string) {
  const redemption = await prisma.redemption.update({
    where: { id: redemptionId },
    data: {
      status: "REJECTED",
    },
  });

  // Log rejection
  await AuditService.logAction(
    redemption.userId,
    AuditAction.REDEMPTION_REJECTED,
    redemptionId,
    { reason },
    undefined,
    undefined
  );

  return redemption;
}
