/**
 * enable-clawback.mjs
 *
 * Enables AUTH_REVOCABLE + AUTH_CLAWBACK_ENABLED on the Stellar issuer account
 * and enables clawback on existing trustlines. Uses execSync wrapping to write
 * output to a log file since direct stdout may be suppressed in some envs.
 */
import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const INNER_SCRIPT = `
'use strict';
const {
  Keypair, Horizon, TransactionBuilder, Networks, Operation, Asset
} = require('@stellar/stellar-sdk');
const { readFileSync, writeFileSync } = require('fs');
const { parse: parseDotenv } = require('dotenv');
const path = require('path');

const lines = [];
const L = (s) => { lines.push(String(s)); process.stderr.write(s + '\\n'); };

async function main() {
  const envPath = path.join(__dirname, '.env');
  L('Reading env from: ' + envPath);
  const env = parseDotenv(readFileSync(envPath, 'utf8'));

  const ADMIN_SECRET = env.STELLAR_ADMIN_SECRET;
  if (!ADMIN_SECRET) { L('ERROR: STELLAR_ADMIN_SECRET not found'); return; }

  const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);
  const adminPubKey  = adminKeypair.publicKey();
  const networkPassphrase = Networks.TESTNET;
  const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
  const assetCode = 'XAG';
  const asset = new Asset(assetCode, adminPubKey);

  L('Admin PK: ' + adminPubKey);

  let account;
  try {
    account = await horizon.loadAccount(adminPubKey);
  } catch (e) { L('FATAL loadAccount: ' + e.message); return; }

  const flags = account.flags;
  L('Current flags: ' + JSON.stringify(flags));

  if (!flags.auth_clawback_enabled) {
    const setFlag = (!flags.auth_revocable ? 4 : 0) | 8;
    L('Setting flags: ' + setFlag + ' (AUTH_REVOCABLE=4, AUTH_CLAWBACK_ENABLED=8)');

    const tx = new TransactionBuilder(account, { fee: '200000', networkPassphrase })
      .addOperation(Operation.setOptions({ setFlag }))
      .setTimeout(60)
      .build();
    tx.sign(adminKeypair);

    try {
      const res = await horizon.submitTransaction(tx);
      L('SUCCESS: setOptions tx=' + res.hash);
    } catch (e) {
      const rc = e?.response?.data?.extras?.result_codes;
      L('SUBMIT FAILED: ' + e.message);
      L('result_codes: ' + JSON.stringify(rc));
      return;
    }

    const updated = await horizon.loadAccount(adminPubKey);
    L('Updated flags: ' + JSON.stringify(updated.flags));
  } else {
    L('auth_clawback_enabled ALREADY SET. Now updating trustlines...');
  }

  // Update existing trustlines
  L('Looking for trustline holders of XAG:' + adminPubKey + '...');
  try {
    const page = await horizon.accounts().forAsset(asset).limit(200).call();
    L('Found ' + page.records.length + ' accounts holding XAG');
    let count = 0;
    for (const acct of page.records) {
      if (acct.account_id === adminPubKey) continue;
      const bal = (acct.balances||[]).find(b => b.asset_code === assetCode && b.asset_issuer === adminPubKey);
      if (!bal) continue;
      if (bal.is_clawback_enabled) { L('  SKIP ' + acct.account_id + ' already clawback-enabled'); continue; }
      L('  Enabling clawback on: ' + acct.account_id);
      try {
        const issuerAcc = await horizon.loadAccount(adminPubKey);
        const t = new TransactionBuilder(issuerAcc, { fee: '200000', networkPassphrase })
          .addOperation(Operation.setTrustLineFlags({ trustor: acct.account_id, asset, flags: { clawbackEnabled: true }}))
          .setTimeout(60).build();
        t.sign(adminKeypair);
        const r = await horizon.submitTransaction(t);
        L('    OK: ' + r.hash); count++;
      } catch(e2) {
        const rc2 = e2?.response?.data?.extras?.result_codes;
        L('    FAIL: ' + (rc2 ? JSON.stringify(rc2) : e2.message));
      }
    }
    L('Total trustlines updated: ' + count);
  } catch(e) { L('Account query failed: ' + e.message); }
}

main()
  .then(() => { require('fs').writeFileSync(require('path').join(__dirname, 'clawback-result.txt'), lines.join('\\n'), 'utf8'); })
  .catch(e => { lines.push('UNHANDLED: ' + e.message); require('fs').writeFileSync(require('path').join(__dirname, 'clawback-result.txt'), lines.join('\\n'), 'utf8'); });
`;

const scriptPath = join(__dirname, '_clawback_inner.cjs');
writeFileSync(scriptPath, INNER_SCRIPT, 'utf8');

try {
  // Run as child process so execSync can capture stderr
  const output = execSync(`node "${scriptPath}"`, {
    cwd: __dirname,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 120000,
  });
  writeFileSync(join(__dirname, 'clawback-result.txt'), output || '(no stdout)', 'utf8');
} catch (e) {
  // stderr is where our L() logger writes
  const combined = (e.stderr || '') + '\n' + (e.stdout || '') + '\n' + (e.message || '');
  writeFileSync(join(__dirname, 'clawback-result.txt'), combined, 'utf8');
}
