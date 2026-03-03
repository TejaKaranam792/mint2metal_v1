import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Keypair } from '@stellar/stellar-sdk';
import { sorobanService } from '../services/soroban.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function manualMint(amountGrams, proof) {
  const adminSecret = process.env.STELLAR_ADMIN_SECRET;

  if (!adminSecret) {
    console.error('❌ STELLAR_ADMIN_SECRET not found in .env');
    return;
  }

  const adminKeypair = Keypair.fromSecret(adminSecret);
  const reservesProof = proof || `manual-mint-${Date.now()}`;

  console.log(`⏳ Minting ${amountGrams}g to Treasury Buffer...`);
  console.log(`📝 Proof: ${reservesProof}`);

  try {
    const txHash = await sorobanService.mintTokens(
      adminKeypair,
      amountGrams.toString(),
      reservesProof
    );
    console.log(`✅ Minting Successful!`);
    console.log(`🔗 Tx Hash: ${txHash}`);

    // Check new balance
    const treasuryPub = process.env.TREASURY_PUBLIC_KEY;
    const balance = await sorobanService.getBalance(treasuryPub);
    console.log(`💰 New Treasury Balance: ${balance} grams`);
  } catch (e) {
    console.error('❌ Minting Failed:', e.message || e);
  }
}

// Usage: node manual-mint.mjs <amount> [proof]
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: node manual-mint.mjs <amount_in_grams> [proof_string]');
  process.exit(1);
}

manualMint(args[0], args[1]);
