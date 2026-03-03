import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Keypair, TransactionBuilder, Networks, Contract, rpc, nativeToScVal } from '@stellar/stellar-sdk';

async function main() {
  const server = new rpc.Server('https://soroban-testnet.stellar.org');
  const networkPassphrase = Networks.TESTNET;

  const adminSecret = process.env.STELLAR_ADMIN_SECRET;
  const dstId = process.env.DST_CONTRACT_ID;
  const treasuryPub = process.env.TREASURY_PUBLIC_KEY;

  if (!adminSecret || !dstId || !treasuryPub) {
    console.error('❌ Missing .env values');
    process.exit(1);
  }

  const adminKeypair = Keypair.fromSecret(adminSecret);
  const account = await server.getAccount(adminKeypair.publicKey());
  const contract = new Contract(dstId);

  console.log('⏳ Initializing contract...');
  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase
  })
    .addOperation(contract.call('initialize',
      nativeToScVal(adminKeypair.publicKey(), { type: 'address' }),
      nativeToScVal(treasuryPub, { type: 'address' })
    ))
    .setTimeout(30)
    .build();

  tx.sign(adminKeypair);
  const result = await server.sendTransaction(tx);
  console.log('✅ Tx submitted. Hash:', result.hash);

  // Poll
  let status = await server.getTransaction(result.hash);
  while (status.status === 'NOT_FOUND' || status.status === 'pending') {
    await new Promise(resolve => setTimeout(resolve, 2000));
    status = await server.getTransaction(result.hash);
  }

  if (status.status === 'SUCCESS') {
    console.log('🎉 Contract Initialized Successfully!');
  } else {
    console.error('❌ Initialization failed:', status.status);
    process.exit(1);
  }
}

main().catch(console.error);
