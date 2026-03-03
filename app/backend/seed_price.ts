import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seed() {
  // Find any admin user to set as the price-setter
  const admin = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'INDIA_USER', 'INTERNATIONAL_USER'] } } });
  const setById = admin?.id ?? 'system';

  // Check if an active price already exists
  const existing = await prisma.commodityPrice.findFirst({ where: { active: true, commodityType: 'XAG' } });
  if (existing) {
    console.log('✅ CommodityPrice already seeded:', existing.pricePerGram, existing.currency);
    return;
  }

  const price = await prisma.commodityPrice.create({
    data: {
      commodityType: 'XAG',
      price: 85.50,       // total price reference
      pricePerGram: 85.50, // M2M tokens per gram of silver
      currency: 'M2M',
      active: true,
      setBy: setById,
    }
  });
  console.log('✅ CommodityPrice seeded:', price.pricePerGram, price.currency, '/ gram for', price.commodityType);
}

seed().catch(console.error).finally(() => prisma.$disconnect());
