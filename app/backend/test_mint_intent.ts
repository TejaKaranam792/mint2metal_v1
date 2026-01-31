import { initiateMintIntent } from './services/mint.service';
import { prisma } from './prisma';

async function testMintIntent() {
  try {
    console.log('Testing mint intent...');

    // Get a test user
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No users found in database. Creating a test user...');
      // Create a test user
      const testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashedpassword',
          kycStatus: 'VERIFIED',
          amlStatus: 'CLEARED',
          role: 'USER',
        },
      });

      // Create a wallet for the user
      const wallet = await prisma.wallet.create({
        data: {
          userId: testUser.id,
          address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', // Test address
        },
      });

      console.log('Created test user:', testUser.id);
      console.log('Created wallet:', wallet.id);

      // Now test mint intent
      const result = await initiateMintIntent(testUser.id, 100);
      console.log('Mint intent result:', result);
    } else {
      console.log('Using existing user:', user.id);
      const result = await initiateMintIntent(user.id, 100);
      console.log('Mint intent result:', result);
    }

  } catch (error) {
    console.error('Mint intent test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMintIntent();
