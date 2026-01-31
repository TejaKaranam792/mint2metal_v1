import 'dotenv/config';
import { prisma } from './prisma';

async function markMigrationApplied() {
  try {
    await prisma.$executeRaw`
      UPDATE "_prisma_migrations"
      SET finished_at = NOW(), logs = 'Applied after cleaning duplicates'
      WHERE migration_name = '20260130023344_add_loan_request_and_unique_wallet_address'
      AND finished_at IS NULL;
    `;
    console.log('Migration marked as applied successfully.');
  } catch (error) {
    console.error('Error marking migration as applied:', error);
  } finally {
    await prisma.$disconnect();
  }
}

markMigrationApplied();
