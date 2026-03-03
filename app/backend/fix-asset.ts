import { sorobanService } from "./services/soroban.service";
import { Keypair, Asset } from "@stellar/stellar-sdk";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Starting fix script...");
  const adminSecret = process.env.STELLAR_ADMIN_SECRET;
  if (!adminSecret) throw new Error("STELLAR_ADMIN_SECRET missing");
  const treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY;
  if (!treasuryPublicKey) throw new Error("TREASURY_PUBLIC_KEY missing");

  const adminKeypair = Keypair.fromSecret(adminSecret);

  const xagAsset = new Asset("XAG", treasuryPublicKey);
  // Get SAC address for XAG issued by treasury
  const passphrase = process.env.STELLAR_NETWORK === 'mainnet' ? 'Public Global Stellar Network ; September 2015' : 'Test SDF Network ; September 2015';
  const xagContractId = xagAsset.contractId(passphrase);

  console.log("XAG SAC Contract ID:", xagContractId);
  console.log("Registering correct XAG asset class mapping...");

  const txHash = await sorobanService.registerAssetClass(
    adminKeypair,
    "XAG",
    xagContractId,
    "1",
    "999",
    "brinks-ny-01",
    "metals.live",
    treasuryPublicKey
  );
  console.log("Asset class registered successfully with tx:", txHash);
}

main().then(() => {
  console.log("Done");
  process.exit(0);
}).catch(err => {
  console.error("Script failed:", err);
  process.exit(1);
});
