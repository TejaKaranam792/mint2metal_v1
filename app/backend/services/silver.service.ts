import { prisma } from "../prisma";
import { AuditService, AuditAction } from "./audit.service";

export async function setSilverPrice(adminId: string, pricePerGram: number, currency: string = "USD") {
  // Deactivate previous active price
  await prisma.silverPrice.updateMany({
    where: { active: true },
    data: { active: false },
  });

  // Set new price
  const newPrice = await prisma.silverPrice.create({
    data: {
      price: pricePerGram,
      pricePerGram,
      currency,
      setBy: adminId,
    },
  });

  // Log audit
  await AuditService.logAction(
    adminId,
    AuditAction.ADMIN_ACTION,
    "SET_SILVER_PRICE",
    { pricePerGram, currency },
    undefined,
    undefined
  );

  return newPrice;
}

export async function getCurrentSilverPrice() {
  return prisma.silverPrice.findFirst({
    where: { active: true },
    orderBy: { setAt: "desc" },
  });
}

export async function createSilverAsset(
  vaultId: string,
  weightGrams: number,
  purity: number,
  adminId?: string
) {
  const asset = await prisma.silverAsset.create({
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
  const assets = await prisma.silverAsset.findMany({
    where: { mint: null }, // Not yet minted
    // No vault relation to include
  });

  const totalWeight = assets.reduce((sum, asset) => sum + asset.weightGrams, 0);
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
  silverAssetId: string,
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
      silverAssetId,
      status: "ACTIVE",
    },
    data: { status: "CANCELLED" },
  });

  const expiresAt = new Date(Date.now() + lockDurationMinutes * 60 * 1000);

  const priceLock = await prisma.priceLock.create({
    data: {
      userId,
      silverAssetId,
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
      silverAsset: true,
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
    updateData.receivedDate = new Date();
    if (serialNumbers) updateData.serialNumbers = JSON.stringify(serialNumbers);
    if (assayReports) updateData.assayReports = JSON.stringify(assayReports);
  }

  const purchaseOrder = await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: updateData,
  });

  // If received, create silver assets
  if (status === "RECEIVED") {
    // Create silver assets based on serial numbers
    const serials = serialNumbers || [];
    for (const serial of serials) {
      await createSilverAsset(
        "default-vault", // TODO: Make this configurable
        purchaseOrder.weightGrams / serials.length, // Distribute weight
        0.999, // Standard purity
        adminId
      );
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
