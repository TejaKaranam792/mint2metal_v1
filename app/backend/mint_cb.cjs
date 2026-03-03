const stellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();
const fs = require('fs');

async function main() {
  try {
    const { Keypair, Horizon, TransactionBuilder, Networks, Operation, Asset, Claimant } = stellarSdk;
    const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');

    const adminSecret = process.env.TREASURY_SECRET;
    const adminKeypair = Keypair.fromSecret(adminSecret);
    const asset = new Asset('XAG', adminKeypair.publicKey());
    const userPubKey = 'GD275XUQFID3TPHVUQSKU3OJXIB5TI3KJOAFWIDSQN3LBLU6EOZMHH7T';

    console.log(`Treasury: ${adminKeypair.publicKey()}`);
    console.log(`Creating Claimable Balance to ${userPubKey}...`);

    const issuerAcc = await horizon.loadAccount(adminKeypair.publicKey());
    const tx = new TransactionBuilder(issuerAcc, { fee: '100000', networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.createClaimableBalance({
        asset: asset,
        amount: '0.1',
        claimants: [
          new Claimant(userPubKey, Claimant.predicateUnconditional())
        ]
      }))
      .setTimeout(60)
      .build();

    tx.sign(adminKeypair);
    const res = await horizon.submitTransaction(tx);
    fs.writeFileSync('cb-hash.txt', res.hash);
    console.log(`Success! Hash: ${res.hash}`);

    // Try to fetch claimable balances again
    const cbResponse = await horizon.claimableBalances().claimant(userPubKey).asset(asset).limit(10).order("desc").call();
    require('fs').writeFileSync('cbs-new.json', JSON.stringify(cbResponse.records, null, 2));
  } catch (e) {
    let msg = e.message;
    if (e.response && e.response.data) {
      msg += JSON.stringify(e.response.data.extras, null, 2);
    }
    fs.writeFileSync('cb-error.txt', msg);
  }
}
main();
