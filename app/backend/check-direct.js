const sdk = require('@stellar/stellar-sdk');
require('dotenv').config();

async function check() {
  try {
    const horizon = new sdk.Horizon.Server('https://horizon-testnet.stellar.org');
    const treasuryPub = process.env.TREASURY_PUBLIC_KEY;
    console.log("Checking balance for Treasury:", treasuryPub);
    const account = await horizon.loadAccount(treasuryPub);

    // We changed the issuer to ADMIN!
    const adminKeypair = sdk.Keypair.fromSecret(process.env.STELLAR_ADMIN_SECRET);
    const adminPub = adminKeypair.publicKey();
    console.log("Issuer is Admin:", adminPub);

    const balanceObj = account.balances.find(b => b.asset_type !== 'native' && b.asset_code === 'XAG' && b.asset_issuer === adminPub);
    if (balanceObj) {
      console.log("Treasury XAG Balance:", balanceObj.balance);
    } else {
      console.log("Treasury XAG Balance: 0 (No trustline or zero balance)");
    }
  } catch (e) {
    console.error(e);
  }
}
check();
