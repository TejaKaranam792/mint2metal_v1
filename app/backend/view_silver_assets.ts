
import { prisma } from './prisma';

async function viewSilverAssets() {
  try {
    console.log('Viewing silver assets in vault...\n');

    const assets = await prisma.silverAsset.findMany({
      include: {
        dstmints: true, // Include any mints associated with the asset
      },
    });

    if (assets.length === 0) {
      console.log('No silver assets found in vault.');
      return;
    }

    console.log(`Found ${assets.length} silver assets:\n`);

    assets.forEach((asset, index) => {
      console.log(`${index + 1}. Asset ID: ${asset.id}`);
      console.log(`   Weight: ${asset.weightGrams} grams`);
      console.log(`   Purity: ${(asset.purity * 100).toFixed(1)}%`);
      console.log(`   Vault ID: ${asset.vaultId}`);
      console.log(`   Location: ${asset.location}`);
      console.log(`   Available: ${asset.available ? 'Yes' : 'No'}`);
      console.log(`   Minted: ${asset.dstmints.length > 0 ? 'Yes' : 'No'}`);
      if (asset.dstmints.length > 0) {
        console.log(`   Mint Records: ${asset.dstmints.length}`);
      }
      console.log('   ---');
    });

    // Calculate totals
    const totalWeight = assets.reduce((sum, asset) => sum + asset.weightGrams, 0);
    const availableAssets = assets.filter(asset => asset.available && asset.dstmints.length === 0);
    const availableWeight = availableAssets.reduce((sum, asset) => sum + asset.weightGrams, 0);

    console.log('\nSummary:');
    console.log(`Total Assets: ${assets.length}`);
    console.log(`Total Weight: ${totalWeight} grams`);
    console.log(`Available Assets: ${availableAssets.length}`);
    console.log(`Available Weight: ${availableWeight} grams`);

  } catch (error) {
    console.error('Error viewing silver assets:', error);
  } finally {
    await prisma.$disconnect();
  }
}

viewSilverAssets();
