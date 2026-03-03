/**
 * setup-clawback.mjs
 *
 * Sets AUTH_CLAWBACK_ENABLED_FLAG on the admin/issuer Stellar account
 * so that clawback and clawbackClaimableBalance work on XAG tokens.
 *
 * Also enables TRUSTLINE_CLAWBACK_ENABLED_FLAG on any existing XAG trustlines
 * so existing holders can be clawed back.
 *
 * Run: node setup-clawback.mjs
 */
import { Keypair, Horizon, TransactionBuilder, Networks, Operation, Asset, AuthFlag } from '@stellar/stellar-sdk';
import { readFileSync } from 'fs';
import { parse as parseDotenv } from 'dotenv';

// ── Load env ──────────────────────────────────────────────────────────────────
const env = parseDotenv(readFileSync('.env'));
const ADMIN_SECRET = env.STELLAR_ADMIN_SECRET;
const NETWORK = env.STELLAR_NETWORK || 'testnet';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const ASSET_CODE = 'XAG';

if (!ADMIN_SECRET) {
  console.error('❌  STELLAR_ADMIN_SECRET not found in .env');
  process.exit(1);
}

const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);
const adminPubKey = adminKeypair.publicKey();
const networkPassphrase = NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const asset = new Asset(ASSET_CODE, adminPubKey);

const horizon = new Horizon.Server(HORIZON_URL);

console.log(`\n🔑  Admin / Issuer:  ${adminPubKey}`);
console.log(`🌐  Network:         ${NETWORK}`);
console.log(`💎  Asset:           ${ASSET_CODE}:${adminPubKey}\n`);

// ── Step 1: Set AUTH_CLAWBACK_ENABLED on the issuer account ──────────────────
async function enableClawbackOnAccount() {
  const account = await horizon.loadAccount(adminPubKey);

  // Check if already set
  const flags = account.flags;
  if (flags.auth_clawback_enabled) {
    console.log('✅  AUTH_CLAWBACK_ENABLED is already set on the issuer account.');
    return;
  }

  console.log('⚙️   Setting AUTH_CLAWBACK_ENABLED on issuer account...');

  // NOTE: AUTH_CLAWBACK_ENABLED can only be set if AUTH_REVOCABLE is also set.
  const setFlags =
    (flags.auth_revocable ? 0 : AuthFlag.AuthRevocable) |
    AuthFlag.AuthClawbackEnabled;

  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase,
  })
    .addOperation(Operation.setOptions({ setFlag: setFlags }))
    .setTimeout(60)
    .build();

  tx.sign(adminKeypair);
  const result = await horizon.submitTransaction(tx);
  console.log(`✅  Account flags set! Tx hash: ${result.hash}`);

  // Verify
  const updated = await horizon.loadAccount(adminPubKey);
  console.log('   Updated flags:', updated.flags);
}

// ── Step 2: Enable clawback on existing XAG trustlines ───────────────────────
async function enableClawbackOnExistingTrustlines() {
  console.log('\n🔍  Looking for existing XAG trustlines to enable clawback on...');

  let page = await horizon.accounts().forAsset(asset).limit(200).call();
  let count = 0;

  while (page.records.length > 0) {
    for (const acct of page.records) {
      if (acct.account_id === adminPubKey) continue; // skip issuer itself

      // Check if clawback_enabled is already set on this trustline
      const bal = acct.balances.find(
        (b) => b.asset_type !== 'native' && b.asset_code === ASSET_CODE && b.asset_issuer === adminPubKey
      );
      if (!bal) continue;

      if (bal.is_clawback_enabled) {
        console.log(`   ⏭️  ${acct.account_id.slice(0, 12)}... already clawback-enabled, skipping.`);
        continue;
      }

      console.log(`   🔧  Enabling clawback on trustline: ${acct.account_id}`);

      try {
        const issuerAccount = await horizon.loadAccount(adminPubKey);

        const tx = new TransactionBuilder(issuerAccount, {
          fee: '100000',
          networkPassphrase,
        })
          .addOperation(
            Operation.setTrustLineFlags({
              trustor: acct.account_id,
              asset,
              flags: {
                clawbackEnabled: true,
              },
            })
          )
          .setTimeout(60)
          .build();

        tx.sign(adminKeypair);
        const result = await horizon.submitTransaction(tx);
        console.log(`   ✅  ${acct.account_id.slice(0, 12)}... → clawback enabled. Tx: ${result.hash}`);
        count++;
      } catch (err) {
        console.error(`   ❌  Failed for ${acct.account_id}: ${err.message}`);
        // Don't stop — continue trying other accounts
      }
    }

    // Follow pagination
    if (page.records.length < 200) break;
    page = await page.next();
  }

  if (count === 0) {
    console.log('   No trustlines needed updating (either none exist or all already enabled).');
  } else {
    console.log(`\n✅  Enabled clawback on ${count} trustline(s).`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await enableClawbackOnAccount();
    await enableClawbackOnExistingTrustlines();
    console.log('\n🎉  Done! Clawback is now enabled. Redemptions should work correctly.\n');
  } catch (err) {
    console.error('\n❌  Fatal error:', err?.response?.data || err.message);
    process.exit(1);
  }
})();
