const stellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

async function main() {
  try {
    const horizon = new stellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
    const adminPubKey = 'GAQSTTMR5P4YBJ3ZVE3HQ46QA2RED3VSNHGVLF5PHBDVOXW5Z5SSPPG2';
    const asset = new stellarSdk.Asset('XAG', adminPubKey);
    const from = 'GD275XUQFID3TPHVUQSKU3OJXIB5TI3KJOAFWIDSQN3LBLU6EOZMHH7T'; // The user wallet address from the error log

    console.log(`Checking Claimable Balances for claimant ${from}...`);

    let claimableBalances = [];
    const cbResponse = await horizon.claimableBalances()
      .claimant(from)
      .asset(asset)
      .limit(200)
      .call();

    for (const cb of cbResponse.records) {
      console.log(`Balance ID: ${cb.id}`);
      console.log(`  Amount: ${cb.amount}`);
      console.log(`  Flags:`, cb.flags);
      claimableBalances.push(cb);
    }

    console.log(`Total records: ${cbResponse.records.length}`);

    const strictMatch = cbResponse.records.filter(cb => cb.flags && cb.flags.clawback_enabled === true);
    console.log(`Records with clawback_enabled === true: ${strictMatch.length}`);

    // Try direct balance
    try {
      const userAccount = await horizon.loadAccount(from);
      const balObj = userAccount.balances.find(
        b => b.asset_code === 'XAG' && b.asset_issuer === adminPubKey
      );
      console.log(`Direct Trustline Balance:`, balObj);
    } catch (e) {
      console.log(`Could not fetch account trustlines: ${e.message}`);
    }

  } catch (e) {
    console.error(e);
  }
}

main();
