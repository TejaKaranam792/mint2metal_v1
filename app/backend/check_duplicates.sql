SELECT address, COUNT(*) as count FROM "Wallet" GROUP BY address HAVING COUNT(*) > 1;
