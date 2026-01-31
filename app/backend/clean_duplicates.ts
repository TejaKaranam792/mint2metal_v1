import 'dotenv/config';
import { prisma } from './prisma';

async function cleanDuplicates() {
  try {
    // Delete duplicate wallets, keeping the one with the smallest id for each address
    await prisma.$executeRaw`
      DELETE FROM "Wallet"
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM "Wallet"
        GROUP BY address
      );
    `;
    console.log('Duplicate wallets cleaned successfully.');
  } catch (error) {
    console.error('Error cleaning duplicates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDuplicates();
