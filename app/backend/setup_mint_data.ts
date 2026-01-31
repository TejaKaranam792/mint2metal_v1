import { prisma } from './prisma';

async function setupMintData() {
  try {
    console.log('Setting up data for mint intent testing...');

    // 1. Set current silver price
    console.log('Setting silver price...');
    await prisma.silverPrice.upsert({
      where: { id: 'current-price' },
      update: {
        price: 25.0,
        pricePerGram: 25.0,
        currency: 'USD',
        active: true,
        setBy: 'system',
      },
      create: {
        id: 'current-price',
        price: 25.0,
        pricePerGram: 25.0,
        currency: 'USD',
        active: true,
        setBy: 'system',
      },
    });

    // 2. Create silver assets
    console.log('Creating silver assets...');
    const assets = [
      { weightGrams: 1000, purity: 0.999, vaultId: 'vault-1', location: 'secure-vault' },
      { weightGrams: 500, purity: 0.999, vaultId: 'vault-1', location: 'secure-vault' },
      { weightGrams: 200, purity: 0.999, vaultId: 'vault-1', location: 'secure-vault' },
      { weightGrams: 100, purity: 0.999, vaultId: 'vault-1', location: 'secure-vault' },
    ];

    for (const asset of assets) {
      await prisma.silverAsset.create({
        data: asset,
      });
    }

    // 3. Check if admin user exists, if not create one
    console.log('Checking admin user...');
    let adminUser = await prisma.user.findFirst({
      where: { email: 'admin@admin.com' },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: 'admin@admin.com',
          password: '$2b$10$hashedpassword', // This would be properly hashed
          role: 'ADMIN',
          kycStatus: 'VERIFIED',
          amlStatus: 'CLEARED',
        },
      });

      // Create wallet for admin
      await prisma.wallet.create({
        data: {
          userId: adminUser.id,
          address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
          balance: 0,
        },
      });
    }

    // 4. Check if test user exists, if not create one
    console.log('Checking test user...');
    let testUser = await prisma.user.findFirst({
      where: { email: 'test@example.com' },
    });

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: '$2b$10$hashedpassword',
          role: 'USER',
          kycStatus: 'VERIFIED',
          amlStatus: 'CLEARED',
        },
      });

      // Create wallet for test user
      await prisma.wallet.create({
        data: {
          userId: testUser.id,
          address: 'GBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
          balance: 0,
        },
      });
    }

    console.log('Setup completed successfully!');
    console.log('Admin user:', adminUser.id);
    console.log('Test user:', testUser.id);

  } catch (error) {
    console.error('Setup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupMintData();
