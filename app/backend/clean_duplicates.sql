-- Clean up duplicate addresses in Wallet table
-- Keep the first occurrence of each address and delete the rest

DELETE FROM "Wallet"
WHERE id NOT IN (
    SELECT MIN(id)
    FROM "Wallet"
    GROUP BY address
);
