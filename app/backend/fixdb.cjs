const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
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

  const result = await prisma.commodityAsset.updateMany({
    where: { mint: null },
    data: { mint: "backfilled-tx" }
  });
  console.log("Updated unminted assets:", result.count);

  await prisma.dSTMint.create({
    data: {
      userId: adminUser.id,
      walletId: adminWallet.id,
      amount: 1000,
      status: "COMPLETED",
      txHash: "backfilled-tx",
    }
  });

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
  console.log("Backfill complete");
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
