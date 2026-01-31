-- Check for duplicate addresses in Wallet table
SELECT address, COUNT(*) as count FROM "Wallet" GROUP BY address HAVING COUNT(*) > 1;

-- Check if LoanRequest table exists
SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'LoanRequest'
);

-- Check current state of migrations
SELECT * FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 5;
