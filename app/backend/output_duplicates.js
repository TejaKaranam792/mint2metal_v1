const { prisma } = require('./prisma');

async function checkDuplicates() {
  try {
    // Check for duplicate addresses
    const duplicates = await prisma.$queryRaw`
      SELECT address, COUNT(*) as count FROM "Wallet" GROUP BY address HAVING COUNT(*) > 1;
    `;
    console.log('Duplicate addresses:', duplicates);

    // Check if LoanRequest table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'LoanRequest'
      );
    `;
    console.log('LoanRequest table exists:', tableExists);

    // Check recent migrations
    const migrations = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 5;
    `;
    console.log('Recent migrations:', migrations);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();
