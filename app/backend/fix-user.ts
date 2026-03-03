import * as stellarSdk from '@stellar/stellar-sdk';
import { readFileSync, writeFileSync } from 'fs';

async function main() {
  try {
    const env = readFileSync('.env', 'utf-8');
    const getEnv = (key: string) => env.match(new RegExp(`${key}="?(.*?)"?(?:\n|$)`))?.[1];

    const treasurySecret = getEnv('TREASURY_SECRET');
    const adminSecret = getEnv('STELLAR_ADMIN_SECRET');

    if (!treasurySecret) throw new Error("No TREASURY_SECRET");
    if (!adminSecret) throw new Error("No STELLAR_ADMIN_SECRET");

    const { Keypair, Horizon, TransactionBuilder, Networks, Operation, Asset } = stellarSdk;

    const treasuryKeypair = Keypair.fromSecret(treasurySecret);
    const adminKeypair = Keypair.fromSecret(adminSecret);

    const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
    const asset = new Asset('XAG', treasuryKeypair.publicKey());
    const userPubKey = 'GD275XUQFID3TPHVUQSKU3OJXIB5TI3KJOAFWIDSQN3LBLU6EOZMHH7T';

    console.log(`Treasury PK: ${treasuryKeypair.publicKey()}`);

    // Ensure flags are correct on issuer
    const account = await horizon.loadAccount(treasuryKeypair.publicKey());
    if (!account.flags.auth_clawback_enabled || !account.flags.auth_revocable) {
      console.log('Setting auth flags on Treasury account...');
      const tx = new TransactionBuilder(account, { fee: '200000', networkPassphrase: Networks.TESTNET })
        // @ts-ignore
        .addOperation(Operation.setOptions({ setFlags: (2 | 8) as any }))
        .setTimeout(60)
        .build();
      tx.sign(treasuryKeypair);
      const res = await horizon.submitTransaction(tx);
      console.log(`Flags set: ${res.hash}`);
    } else {
      console.log('Treasury flags already correct.');
    }

    // Enable clawback on the specific user's trustline
    console.log(`Enabling clawback for trustline of user: ${userPubKey}`);
    const issuerAcc = await horizon.loadAccount(treasuryKeypair.publicKey());
    const tx2 = new TransactionBuilder(issuerAcc, { fee: '200000', networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.setTrustLineFlags({
        trustor: userPubKey,
        asset,
        flags: { clawbackEnabled: true }
      }))
      .setTimeout(60)
      .build();
    tx2.sign(treasuryKeypair);
    try {
      const res2 = await horizon.submitTransaction(tx2);
      console.log(`TrustLine flag set: ${res2.hash}`);
      writeFileSync('direct-setup-result.txt', `SUCCESS: Trustline fixed. Hash: ${res2.hash}`);
    } catch (e: any) {
      const rc = JSON.stringify(e?.response?.data?.extras?.result_codes || e.message);
      console.log(`TrustLine set failed: ${rc}`);
      writeFileSync('direct-setup-result.txt', `FAILED to set trustline: ${rc}`);
    }

  } catch (e: any) {
    console.error(e);
    writeFileSync('direct-setup-result.txt', `FATAL: ${e.message}`);
  }
}

main();
