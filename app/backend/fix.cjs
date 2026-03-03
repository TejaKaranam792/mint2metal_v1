const fs = require('fs');

async function main() {
  try {
    console.log("Loading modules...");
    const stellarSdk = require('@stellar/stellar-sdk');
    require('dotenv').config();

    const treasurySecret = process.env.TREASURY_SECRET;
    if (!treasurySecret) throw new Error("No TREASURY_SECRET");

    const { Keypair, Horizon, TransactionBuilder, Networks, Operation, Asset } = stellarSdk;

    const treasuryKeypair = Keypair.fromSecret(treasurySecret);
    const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
    const asset = new Asset('XAG', treasuryKeypair.publicKey());
    const userPubKey = 'GD275XUQFID3TPHVUQSKU3OJXIB5TI3KJOAFWIDSQN3LBLU6EOZMHH7T';

    console.log(`Treasury PK: ${treasuryKeypair.publicKey()}`);

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

    console.log("Submitting transaction...");
    const res2 = await horizon.submitTransaction(tx2);
    console.log(`TrustLine flag set: ${res2.hash}`);
    fs.writeFileSync('direct-setup-result.txt', `SUCCESS: Trustline fixed. Hash: ${res2.hash}`);

  } catch (e) {
    console.error("Caught error:", e);
    const rc = e.response?.data?.extras?.result_codes;
    fs.writeFileSync('direct-setup-result.txt', `FAILED: ${e.message} ${JSON.stringify(rc || {})}`);
  }
}

main().then(() => console.log("Done")).catch(console.error);
