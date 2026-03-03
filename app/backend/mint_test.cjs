const stellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

async function main() {
  try {
    const { Keypair, Horizon, TransactionBuilder, Networks, Operation, Asset } = stellarSdk;
    const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');

    const adminSecret = process.env.TREASURY_SECRET;
    const adminKeypair = Keypair.fromSecret(adminSecret);
    const asset = new Asset('XAG', adminKeypair.publicKey());
    const userPubKey = 'GD275XUQFID3TPHVUQSKU3OJXIB5TI3KJOAFWIDSQN3LBLU6EOZMHH7T';

    console.log(`Treasury: ${adminKeypair.publicKey()}`);
    console.log(`Minting 0.5 XAG to ${userPubKey}...`);

    const issuerAcc = await horizon.loadAccount(adminKeypair.publicKey());
    const tx = new TransactionBuilder(issuerAcc, { fee: '100000', networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({
        destination: userPubKey,
        asset: asset,
        amount: '0.5'
      }))
      .setTimeout(60)
      .build();

    tx.sign(adminKeypair);
    console.log("Submitting transaction...");
    const res = await horizon.submitTransaction(tx);
    console.log(`Success! Hash: ${res.hash}`);

    // Try to fetch claimable balances again
    const cbResponse = await horizon.claimableBalances().claimant(userPubKey).asset(asset).limit(10).order("desc").call();
    require('fs').writeFileSync('cbs-new.json', JSON.stringify(cbResponse.records, null, 2));
    console.log("Wrote claimable balances to cbs-new.json");
  } catch (e) {
    console.error("Error:", e.message);
    if (e.response && e.response.data) {
      console.error(JSON.stringify(e.response.data.extras, null, 2));
    }
  }
}
main();
