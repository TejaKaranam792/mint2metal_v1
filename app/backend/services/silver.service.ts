import { prisma } from "../prisma";
import { AuditService, AuditAction } from "./audit.service";

/**
 * [ORACLE-POWERED] Get the current silver price from the decentralized oracle.
 *
 * Reads from the OracleStatus DB singleton (updated every 5 min by the oracle scheduler).
 * Falls back to raw DB CommodityPrice table if the oracle has not been bootstrapped yet.
 */
export async function getCurrentSilverPrice() {
  // Prefer oracle-driven price (fast DB read, updated by oracle scheduler)
  try {
    const oracleStatus = await (prisma as any).oracleStatus.findUnique({
      where: { id: "singleton" },
    });

    if (oracleStatus && oracleStatus.currentPrice > 0) {
      const ageMs = Date.now() - new Date(oracleStatus.lastUpdatedAt).getTime();
      return {
        id: "oracle-singleton",
        price: oracleStatus.currentPrice,
        pricePerGram: oracleStatus.currentPrice,
        currency: "USD",
        setBy: "oracle",
        active: !oracleStatus.isPaused,
        isStale: ageMs > 3_600_000,
        source: oracleStatus.source ?? "Median Oracle",
        setAt: oracleStatus.lastUpdatedAt,
        updatedAt: oracleStatus.lastUpdatedAt,
        isPaused: oracleStatus.isPaused,
      };
    }
  } catch {
    // OracleStatus table may not exist yet before first migration
  }

  // Legacy fallback: return from CommodityPrice table
  return prisma.commodityPrice.findFirst({
    where: { active: true },
    orderBy: { setAt: "desc" },
  });
}

/**
 * @deprecated Admin manual price override is disabled.
 * Prices are now exclusively determined by the decentralized OracleAggregator.
 * This function will throw in production to prevent accidental centralized pricing.
 */
export async function setSilverPrice(adminId: string, pricePerGram: number, currency: string = "USD") {
  throw new Error(
    "Manual price override is disabled. Silver price is now controlled exclusively by the decentralized OracleAggregator contract. " +
    "To update the price, ensure the oracle scheduler is running and has valid API keys configured."
  );
}


export async function createSilverAsset(
  vaultId: string,
  weightGrams: number,
  purity: number,
  adminId?: string
) {
  const asset = await prisma.commodityAsset.create({
    data: {
      vaultId,
      weightGrams,
      purity,
      location: "default-vault", // Required field
    },
  });

  // Log audit
  if (adminId) {
    await AuditService.logAction(
      adminId,
      AuditAction.ADMIN_ACTION,
      "CREATE_SILVER_ASSET",
      { assetId: asset.id, vaultId, weightGrams, purity },
      undefined,
      undefined
    );
  }

  return asset;
}

export async function getVaultInventory() {
  const assets = await prisma.commodityAsset.findMany({
    where: { mint: null }, // Not yet minted
    // No vault relation to include
  });

  const totalWeight = assets.reduce((sum: number, asset: any) => sum + asset.weightGrams, 0);
  const totalValue = totalWeight * 31.1035; // Troy ounce conversion, but we'll use current price

  return {
    assets,
    totalWeight,
    totalValue,
    count: assets.length,
  };
}

export async function checkMintEligibility() {
  const inventory = await getVaultInventory();
  const currentPrice = await getCurrentSilverPrice();

  return {
    canMint: inventory.totalWeight > 0,
    availableGrams: inventory.totalWeight,
    estimatedValue: currentPrice ? inventory.totalWeight * currentPrice.pricePerGram : 0,
  };
}

// Price Locking Mechanism
export async function lockPriceForUser(
  userId: string,
  commodityAssetId: string,
  lockDurationMinutes: number = 15
) {
  const currentPrice = await getCurrentSilverPrice();
  if (!currentPrice) {
    throw new Error("No active silver price available");
  }

  // Cancel any existing active locks for this user/asset
  await prisma.priceLock.updateMany({
    where: {
      userId,
      commodityAssetId,
      status: "ACTIVE",
    },
    data: { status: "CANCELLED" },
  });

  const expiresAt = new Date(Date.now() + lockDurationMinutes * 60 * 1000);

  const priceLock = await prisma.priceLock.create({
    data: {
      userId,
      commodityAssetId,
      price: currentPrice.pricePerGram,
      lockedPrice: currentPrice.pricePerGram,
      expiresAt,
      status: "ACTIVE",
    },
  });

  // Log audit
  await AuditService.logAction(
    userId,
    AuditAction.ADMIN_ACTION,
    "PRICE_LOCKED",
    {
      priceLockId: priceLock.id,
      lockedPrice: currentPrice.pricePerGram,
      expiresAt,
    },
    undefined,
    undefined
  );

  return priceLock;
}

export async function getActivePriceLocks(userId?: string) {
  const whereClause = userId ? { userId, status: "ACTIVE" as const } : { status: "ACTIVE" as const };

  return prisma.priceLock.findMany({
    where: whereClause,
    include: {
      user: true,
      commodityAsset: true,
    },
    orderBy: { lockedAt: "desc" },
  });
}

export async function expirePriceLocks() {
  const expiredLocks = await prisma.priceLock.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: {
        lt: new Date(),
      },
    },
    data: { status: "EXPIRED" },
  });

  return expiredLocks;
}

// Purchase Order Management
export async function createPurchaseOrder(
  adminId: string,
  dealerName: string,
  weightGrams: number,
  pricePerGram: number
) {
  const totalAmount = weightGrams * pricePerGram;

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      userId: adminId,
      quantityGrams: weightGrams,
      weightGrams,
      price: pricePerGram,
      pricePerGram,
      totalAmount,
      dealerName,
      status: "ORDERED",
    },
  });

  // Log audit
  await AuditService.logAction(
    adminId,
    AuditAction.ADMIN_ACTION,
    "PURCHASE_ORDER_CREATED",
    {
      purchaseOrderId: purchaseOrder.id,
      dealerName,
      weightGrams,
      totalAmount,
    },
    undefined,
    undefined
  );

  return purchaseOrder;
}

export async function updatePurchaseOrderStatus(
  adminId: string,
  purchaseOrderId: string,
  status: "CONFIRMED" | "RECEIVED" | "CANCELLED",
  serialNumbers?: string[],
  assayReports?: string[]
) {
  const updateData: any = { status };

  if (status === "RECEIVED") {
    // The schema does not support receivedDate, serialNumbers, or assayReports
    // updateData.receivedDate = new Date();
    // if (serialNumbers) updateData.serialNumbers = JSON.stringify(serialNumbers);
    // if (assayReports) updateData.assayReports = JSON.stringify(assayReports);
  }

  const purchaseOrder = await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: updateData,
  });

  // If received, add silver into vault inventory
  if (status === "RECEIVED") {
    const serials = serialNumbers || [];

    if (serials.length > 0) {
      // Create one asset per bar/serial (weight distributed equally)
      const weightPerBar = purchaseOrder.weightGrams / serials.length;
      for (const serial of serials) {
        await createSilverAsset(`order-${purchaseOrderId}`, weightPerBar, 0.999, adminId);
      }
    } else {
      // No serial numbers — create one consolidated asset for the total order weight
      await createSilverAsset(`order-${purchaseOrderId}`, purchaseOrder.weightGrams, 0.999, adminId);
    }
  }


  // Log audit
  await AuditService.logAction(
    adminId,
    AuditAction.ADMIN_ACTION,
    "PURCHASE_ORDER_UPDATED",
    {
      purchaseOrderId,
      newStatus: status,
      serialNumbers: serialNumbers?.length,
      assayReports: assayReports?.length,
    },
    undefined,
    undefined
  );

  return purchaseOrder;
}

export async function getPurchaseOrders(status?: string) {
  const whereClause = status ? { status: status as any } : {};

  return prisma.purchaseOrder.findMany({
    where: whereClause,
    orderBy: { orderDate: "desc" },
  });
}
