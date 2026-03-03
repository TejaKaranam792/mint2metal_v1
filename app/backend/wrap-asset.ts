import { sorobanService } from "./services/soroban.service";
import { Keypair, Asset, Contract, TransactionBuilder } from "@stellar/stellar-sdk";
import * as dotenv from "dotenv";
import fs from "fs";

dotenv.config();

function log(msg: string) {
  fs.appendFileSync('wrap-log.txt', msg + '\n');
}

async function main() {
  log("Wrapping XAG asset on Soroban...");
  const adminSecret = process.env.STELLAR_ADMIN_SECRET;
  if (!adminSecret) throw new Error("STELLAR_ADMIN_SECRET missing");
  const treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY;
  if (!treasuryPublicKey) throw new Error("TREASURY_PUBLIC_KEY missing");

  const adminKeypair = Keypair.fromSecret(adminSecret);
  const xagAsset = new Asset("XAG", treasuryPublicKey);

  const server = (sorobanService as any).server;
  const networkPassphrase = (sorobanService as any).networkPassphrase;

  try {
    const account = await server.getAccount(adminKeypair.publicKey());

    // Create the wrap operation
    const op = Contract.deployStellarAsset(xagAsset);

    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase
    })
      .addOperation(op)
      .setTimeout(60)
      .build();

    log("Submitting SAC deployment transaction...");
    const txHash = await (sorobanService as any).submitAndWait(tx, adminKeypair);
    log("SAC wrapper deployed! Tx: " + txHash);
  } catch (e: any) {
    log("Failed to wrap asset: " + (e.message || e));
    if (e.response && e.response.data) {
      log(JSON.stringify(e.response.data, null, 2));
    }
    throw e;
  }
}

main().then(() => {
  log("Done");
  process.exit(0);
}).catch(err => {
  log("Script failed: " + err.message);
  process.exit(1);
});
