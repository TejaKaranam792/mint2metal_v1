import { prisma } from "../prisma";
import { sorobanService } from "./soroban.service";
import { Keypair } from '@stellar/stellar-sdk';
import { AuditService, AuditAction } from "./audit.service";
import { AMLStatus } from '@prisma/client';

export async function submitRedemption(userId: string, data: { quantity: number; address: string }) {
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
    include: { user: true },
  });
}

export async function approveRedemption(adminId: string | undefined, redemptionId: string) {
  const redemption = await prisma.redemption.update({
    where: { id: redemptionId },
    data: {
      status: "APPROVED",
    },
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
    // Burn tokens on Soroban
    const txHash = await sorobanService.burnTokens(
      adminKeypair,
      redemption.user.wallet?.address || '',
      redemption.quantity.toString()
    );

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
      { txHash, quantity: redemption.quantity },
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
  const approved = await prisma.redemption.findMany({
    where: { status: "APPROVED" },
    include: { user: true },
  });

  return {
    pendingRedemptions: pending,
    approvedRedemptions: approved,
    totalPending: pending.length,
    totalApproved: approved.length,
  };
}

/**
 * Alias for submitRedemption
 */
export async function requestRedemption(userId: string, data: { quantity: number; address: string }) {
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
