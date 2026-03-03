'use strict';

const {
  Keypair, Horizon, TransactionBuilder, Networks, Operation, Asset
} = require('@stellar/stellar-sdk');
const { readFileSync, writeFileSync } = require('fs');
const { parse: parseDotenv } = require('dotenv');

const log = [];
const out = (msg) => { log.push(msg); };

async function main() {
  const env = parseDotenv(readFileSync('.env'));
  const ADMIN_SECRET = env.STELLAR_ADMIN_SECRET;

  if (!ADMIN_SECRET) {
    out('ERROR: STELLAR_ADMIN_SECRET not found in .env');
    return;
  }

  const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);
  const adminPubKey = adminKeypair.publicKey();
  const networkPassphrase = Networks.TESTNET;
  const asset = new Asset('XAG', adminPubKey);
  const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');

  out(`Admin PK: ${adminPubKey}`);

  // 1. Load account and check flags
  let account;
  try {
    account = await horizon.loadAccount(adminPubKey);
  } catch (e) {
    out(`FATAL: could not load account: ${e.message}`);
    return;
  }

  out(`Current flags: ${JSON.stringify(account.flags)}`);

  if (account.flags.auth_clawback_enabled) {
    out('auth_clawback_enabled is ALREADY set. Nothing to do.');
    return;
  }

  // AUTH_REVOCABLE (flag=4) must be set before AUTH_CLAWBACK_ENABLED (flag=8)
  let setFlag = 8; // AUTH_CLAWBACK_ENABLED_FLAG
  if (!account.flags.auth_revocable) {
    setFlag = 4 | 8; // both together
    out('Will set AUTH_REVOCABLE + AUTH_CLAWBACK_ENABLED (flags 4|8 = 12)');
  } else {
    out('AUTH_REVOCABLE already set. Will only set AUTH_CLAWBACK_ENABLED (flag 8)');
  }

  // 2. SetOptions transaction
  let tx;
  try {
    tx = new TransactionBuilder(account, {
      fee: '200000',
      networkPassphrase,
    })
      .addOperation(Operation.setOptions({ setFlag }))
      .setTimeout(60)
      .build();
  } catch (e) {
    out(`TX BUILD ERROR: ${e.message}`);
    return;
  }

  tx.sign(adminKeypair);
  out('Transaction signed. Submitting to Horizon...');

  try {
    const result = await horizon.submitTransaction(tx);
    out(`SUCCESS: setOptions tx hash = ${result.hash}`);
  } catch (e) {
    const extras = e?.response?.data;
    out(`SUBMIT ERROR: ${e.message}`);
    out(`Horizon response: ${JSON.stringify(extras, null, 2)}`);
    return;
  }

  // 3. Verify
  const updated = await horizon.loadAccount(adminPubKey);
  out(`Updated flags: ${JSON.stringify(updated.flags)}`);

  // 4. Update existing trustlines
  out('\nLooking for existing XAG trustline holders...');
  try {
    const page = await horizon.accounts().forAsset(asset).limit(200).call();
    let count = 0;
    for (const acct of page.records) {
      if (acct.account_id === adminPubKey) continue;
      const bal = (acct.balances || []).find(
        b => b.asset_type !== 'native' && b.asset_code === 'XAG' && b.asset_issuer === adminPubKey
      );
      if (!bal) continue;
      if (bal.is_clawback_enabled) {
        out(`  ${acct.account_id}: trustline already clawback-enabled, skip`);
        continue;
      }
      out(`  Setting trustline clawback for ${acct.account_id}`);
      try {
        const issuerAcc = await horizon.loadAccount(adminPubKey);
        const tTx = new TransactionBuilder(issuerAcc, { fee: '200000', networkPassphrase })
          .addOperation(Operation.setTrustLineFlags({
            trustor: acct.account_id,
            asset,
            flags: { clawbackEnabled: true },
          }))
          .setTimeout(60)
          .build();
        tTx.sign(adminKeypair);
        const r = await horizon.submitTransaction(tTx);
        out(`    -> OK: ${r.hash}`);
        count++;
      } catch (e2) {
        out(`    -> FAILED: ${e2?.response?.data?.extras?.result_codes ? JSON.stringify(e2.response.data.extras.result_codes) : e2.message}`);
      }
    }
    out(`Trustlines updated: ${count}`);
  } catch (e) {
    out(`Error fetching accounts: ${e.message}`);
  }
}

main()
  .then(() => {
    const output = log.join('\n');
    writeFileSync('clawback-setup-result.txt', output, 'utf8');
    process.exit(0);
  })
  .catch((e) => {
    log.push(`UNHANDLED: ${e.message}`);
    writeFileSync('clawback-setup-result.txt', log.join('\n'), 'utf8');
    process.exit(1);
  });
