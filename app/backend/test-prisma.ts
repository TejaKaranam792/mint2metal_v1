import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const vaultAssets = await prisma.commodityAsset.findMany({
      where: {
        dstmints: {
          some: {
            wallet: { userId: "dummy-id" },
            status: "MINTED"
          }
        }
      }
    });
    console.log("Success", vaultAssets);
  } catch (error: any) {
    console.error("Prisma Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
