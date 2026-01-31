import { prisma } from './prisma';

async function addSilverAssets() {
  try {
    console.log('Adding silver assets...');

    // Check if assets already exist
    const existingAssets = await prisma.silverAsset.findMany();
    if (existingAssets.length > 0) {
      console.log(`Found ${existingAssets.length} existing silver assets. Skipping creation.`);
      return;
    }

    // Create some silver assets
    const assets = [
      { vaultId: 'default-vault', weightGrams: 100, purity: 0.999 },
      { vaultId: 'default-vault', weightGrams: 200, purity: 0.999 },
      { vaultId: 'default-vault', weightGrams: 50, purity: 0.999 },
      { vaultId: 'default-vault', weightGrams: 500, purity: 0.999 },
    ];

    for (const asset of assets) {
      const created = await prisma.silverAsset.create({
        data: {
          vaultId: asset.vaultId,
          weightGrams: asset.weightGrams,
          purity: asset.purity,
          location: 'default-vault',
        },
      });
      console.log(`Created silver asset: ${created.id} - ${created.weightGrams}g`);
    }

    console.log('Silver assets added successfully!');

  } catch (error) {
    console.error('Error adding silver assets:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addSilverAssets();
