import { sorobanService } from "./services/soroban.service";
import { Keypair, Asset, Contract, scValToNative, nativeToScVal } from "@stellar/stellar-sdk";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const adminSecret = process.env.STELLAR_ADMIN_SECRET;
  if (!adminSecret) throw new Error("STELLAR_ADMIN_SECRET missing");
  const treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY;
  if (!treasuryPublicKey) throw new Error("TREASURY_PUBLIC_KEY missing");

  const adminKeypair = Keypair.fromSecret(adminSecret);
  const xagAsset = new Asset("XAG", treasuryPublicKey);
  const passphrase = process.env.STELLAR_NETWORK === 'mainnet' ? 'Public Global Stellar Network ; September 2015' : 'Test SDF Network ; September 2015';
  const expectedContractId = xagAsset.contractId(passphrase);

  console.log("Expected SAC Contract ID:", expectedContractId);

  try {
    const server = (sorobanService as any).server;
    const contract = new Contract((sorobanService as any).contractId);

    // Read current asset registration
    const readTx = await server.prepareTransaction(
      new (require("@stellar/stellar-sdk").TransactionBuilder)(await server.getAccount(adminKeypair.publicKey()), {
        fee: '100000', networkPassphrase: (sorobanService as any).networkPassphrase
      }).addOperation(contract.call('get_asset_class', nativeToScVal("XAG", { type: 'symbol' })))
        .setTimeout(60).build()
    );

    // simulate it
    const sim = await server.simulateTransaction(readTx);
    if (sim.results && sim.results[0] && sim.results[0].xdr) {
      const resVal = require("@stellar/stellar-sdk").xdr.SCVal.fromXDR(sim.results[0].xdr, 'base64');
      const data = scValToNative(resVal);
      console.log("Current Registered Asset:", JSON.stringify(data, null, 2));

      if (data.token_address !== expectedContractId) {
        console.log(`Mismatch! Expected ${expectedContractId} but got ${data.token_address}`);
        console.log("Reregistering right now...");

        const txHash = await sorobanService.registerAssetClass(
          adminKeypair,
          "XAG",
          expectedContractId,
          "1",
          "999",
          "brinks-ny-01",
          "metals.live",
          treasuryPublicKey
        );
        console.log("Re-registration tx:", txHash);
      } else {
        console.log("Asset already correctly registered with SAC address.");
      }
    } else {
      console.log("Failed to read asset class", sim.error);
    }
  } catch (e) {
    console.error("Error reading asset class:", e);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
