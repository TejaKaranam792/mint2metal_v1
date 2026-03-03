import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixDB() {
  try {
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminUser) throw new Error("No admin");

    let adminWallet = await prisma.wallet.findFirst({ where: { userId: adminUser.id } });
    if (!adminWallet) {
      adminWallet = await prisma.wallet.create({
        data: {
          userId: adminUser.id,
          address: "ADMIN_ADDRESS_PLACEHOLDER",
          walletType: "INTERNAL"
        }
      });
    }

    // 1. Mark unminted assets as minted
    const unmintedAssets = await prisma.commodityAsset.findMany({
      where: { mint: null },
      orderBy: { weightGrams: 'desc' }
    });

    let remainingToMint = 1000;
    const assetsToUpdate = [];
    for (const asset of unmintedAssets) {
      if (remainingToMint <= 0) break;
      assetsToUpdate.push(asset.id);
      remainingToMint -= asset.weightGrams;
    }

    if (assetsToUpdate.length > 0) {
      await prisma.commodityAsset.updateMany({
        where: { id: { in: assetsToUpdate } },
        data: { mint: "backfilled-tx" }
      });
      console.log(`Updated ${assetsToUpdate.length} unminted assets.`);
    }

    // 2. Create DSTMint
    await prisma.dSTMint.create({
      data: {
        userId: adminUser.id,
        walletId: adminWallet.id,
        amount: 1000,
        status: "COMPLETED",
        txHash: "backfilled-tx",
      }
    });

    // 3. Create VaultReceipt
    await prisma.vaultReceipt.upsert({
      where: { receiptId: "VAULT-101" },
      update: { isUsed: true },
      create: {
        receiptId: "VAULT-101",
        vaultId: "vault-default",
        commodityType: "XAG",
        gramsSecured: 1000,
        verifierId: adminUser.id,
        isUsed: true,
      }
    });

    console.log("DB backfilled successfully for the 1000g vault mint.");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

fixDB();
