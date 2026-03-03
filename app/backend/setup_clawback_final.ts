import * as stellarSdk from '@stellar/stellar-sdk';
import { writeFileSync } from 'fs';

const logs: string[] = [];
const L = (s: string) => {
  logs.push(s);
  console.log('[setup-clawback]', s);
};

async function main() {
  try {
    const adminSecret = process.env.TREASURY_SECRET;
    if (!adminSecret) {
      throw new Error("TREASURY_SECRET not configured");
    }

    const { Keypair: KP, Horizon: H, TransactionBuilder: TB, Networks: N, Operation: Op, Asset: A } = stellarSdk;
    const adminKeypair = KP.fromSecret(adminSecret);
    const adminPubKey = adminKeypair.publicKey();
    const networkPassphrase = N.TESTNET;
    const horizon = new H.Server('https://horizon-testnet.stellar.org');
    const asset = new A('XAG', adminPubKey);

    L(`Admin PK: ${adminPubKey}`);

    // Step 1: Set account flags
    const account = await horizon.loadAccount(adminPubKey);
    const flags: any = account.flags;
    L(`Current flags: ${JSON.stringify(flags)}`);

    if (!flags.auth_clawback_enabled) {
      const setFlags: any = (!flags.auth_revocable ? 2 : 0) | 8; // 2=AUTH_REVOCABLE, 8=AUTH_CLAWBACK_ENABLED
      L(`Setting flags ${setFlags} on issuer account...`);

      const tx = new TB(account, { fee: '200000', networkPassphrase })
        .addOperation(Op.setOptions({ setFlags }))
        .setTimeout(60)
        .build();
      tx.sign(adminKeypair);

      try {
        const txResult = await horizon.submitTransaction(tx);
        L(`setOptions SUCCESS: ${txResult.hash}`);
      } catch (e: any) {
        const rc = e?.response?.data?.extras?.result_codes;
        L(`setOptions FAILED: ${e.message} | result_codes: ${JSON.stringify(rc)}`);
        throw new Error(`setOptions failed: ${e.message}`);
      }

      const updated = await horizon.loadAccount(adminPubKey);
      L(`Updated flags: ${JSON.stringify((updated as any).flags)}`);
    } else {
      L("auth_clawback_enabled already set — skipping setOptions");
    }

    // Step 2: Update existing XAG trustlines
    L("Looking for XAG trustline holders...");
    let trustlineCount = 0;
    try {
      const page = await horizon.accounts().forAsset(asset).limit(200).call();
      L(`Found ${(page as any).records.length} accounts holding XAG`);

      for (const acct of (page as any).records) {
        if (acct.account_id === adminPubKey) continue;
        const bal = (acct.balances || []).find(
          (b: any) => b.asset_code === 'XAG' && b.asset_issuer === adminPubKey
        );
        if (!bal) continue;
        if (bal.is_clawback_enabled) {
          L(`  SKIP ${acct.account_id} — trustline clawback already enabled`);
          continue;
        }
        L(`  Enabling clawback for ${acct.account_id}`);
        try {
          const issuerAcc = await horizon.loadAccount(adminPubKey);
          const tTx = new TB(issuerAcc, { fee: '200000', networkPassphrase })
            .addOperation(Op.setTrustLineFlags({ trustor: acct.account_id, asset, flags: { clawbackEnabled: true } }))
            .setTimeout(60)
            .build();
          tTx.sign(adminKeypair);
          const r = await horizon.submitTransaction(tTx);
          L(`    OK: ${r.hash}`);
          trustlineCount++;
        } catch (e2: any) {
          const rc2 = e2?.response?.data?.extras?.result_codes;
          L(`    FAILED: ${e2.message} | ${JSON.stringify(rc2)}`);
        }
      }
    } catch (e: any) {
      L(`Account query failed: ${e.message}`);
    }

    L(`Done. Trustlines updated: ${trustlineCount}`);

    writeFileSync('final-result.json', JSON.stringify({ success: true, trustlineCount, logs }, null, 2));

  } catch (error: any) {
    const msg = error.message || String(error);
    logs.push(`FATAL: ${msg}`);
    writeFileSync('final-result.json', JSON.stringify({ success: false, error: msg, logs }, null, 2));
  }
}

main();
