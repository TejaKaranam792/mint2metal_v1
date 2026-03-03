const { Horizon } = require('@stellar/stellar-sdk');
const fs = require('fs');
require('dotenv').config({ path: './.env' });

async function check() {
  let out = "";
  const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
  const treasuryPubKey = process.env.TREASURY_PUBLIC_KEY || 'GAQSTTMR5P4YBJ3ZVE3HQ46QA2RED3VSNHGVLF5PHBDVOXW5Z5SSPPG2';

  try {
    const account = await horizon.loadAccount(treasuryPubKey);
    out += "Balances for " + treasuryPubKey + "\n";
    account.balances.forEach(b => {
      if (b.asset_type === 'native') out += `XLM: ${b.balance}\n`;
      else out += `${b.asset_code} (${b.asset_issuer}): ${b.balance}\n`;
    });

    out += "\nChecking claimable balances...\n";
    const cbResponse = await horizon.claimableBalances()
      .claimant(treasuryPubKey)
      .limit(200)
      .call();

    out += `Found ${cbResponse.records.length} claimable balances\n`;
    cbResponse.records.forEach(cb => {
      out += `${cb.asset}: ${cb.amount}\n`;
    });
  } catch (e) {
    out += "Error: " + e.message + "\n";
  }
  fs.writeFileSync('balance-result.txt', out);
  console.log("Done");
}

check();
