import { prisma } from './prisma';

async function checkSilverAssets() {
  try {
    console.log('Checking silver assets in database...');

    const assets = await prisma.silverAsset.findMany();

    console.log(`Found ${assets.length} silver assets:`);
    assets.forEach((asset, index) => {
      console.log(`${index + 1}. ID: ${asset.id}, Weight: ${asset.weightGrams}g, Minted: ${asset.mint ? 'Yes' : 'No'}`);
    });

    const unmintedAssets = assets.filter(asset => !asset.mint);
    console.log(`\nUnminted assets: ${unmintedAssets.length}`);
    const totalUnmintedWeight = unmintedAssets.reduce((sum, asset) => sum + asset.weightGrams, 0);
    console.log(`Total unminted weight: ${totalUnmintedWeight}g`);

    // Check vault inventory
    const inventory = await prisma.silverAsset.findMany({
      where: { mint: null },
    });
    const totalWeight = inventory.reduce((sum, asset) => sum + asset.weightGrams, 0);
    console.log(`\nVault inventory total weight: ${totalWeight}g`);

  } catch (error) {
    console.error('Error checking silver assets:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSilverAssets();
