const { sorobanService } = require('./services/soroban.service');
const { Keypair } = require('@stellar/stellar-sdk');
require('dotenv').config();

async function testMint() {
  try {
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;
    const treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY;
    const adminKeypair = Keypair.fromSecret(adminSecret);
    const receiptId = `test-mint-${Date.now()}`;
    const amount = '1000'; // 1000 XAG

    console.log("1. Submitting custody receipt...");
    await sorobanService.submitCustodyReceipt(
      adminKeypair,
      receiptId,
      "vault-01",
      "XAG",
      amount,
      "test-hash"
    );
    console.log("Custody receipt submitted.");

    console.log("2. Minting with custody to Treasury (" + treasuryPublicKey + ")...");
    const txHash = await sorobanService.mintWithCustody(
      adminKeypair,
      receiptId,
      treasuryPublicKey
    );

    console.log("Mint SUCCESS! TxHash:", txHash);

    // Check balance
    const balance = await sorobanService.getBalance(treasuryPublicKey);
    console.log("New Treasury Balance:", balance);
  } catch (e) {
    console.error("Test failed:", e);
  }
}

testMint().then(() => process.exit(0)).catch(e => { console.error('FATAL:', e); process.exit(1); });
