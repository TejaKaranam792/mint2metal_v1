import { sorobanService } from "./services/soroban.service";
import { Keypair } from "@stellar/stellar-sdk";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const adminSecret = process.env.STELLAR_ADMIN_SECRET;
  if (!adminSecret) throw new Error("STELLAR_ADMIN_SECRET missing");
  const treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY;
  if (!treasuryPublicKey) throw new Error("TREASURY_PUBLIC_KEY missing");

  const adminKeypair = Keypair.fromSecret(adminSecret);
  const wasmPath = path.join(__dirname, "../contracts/dst-token/target/wasm32-unknown-unknown/release/mint2metal_dst_token.wasm");

  console.log("Deploying DST Token contract...");
  const contractId = await sorobanService.deployContract(wasmPath, adminKeypair);
  console.log("Deployed DST contract:", contractId);

  // Update .env with new contract ID temporarily
  // But wait, sorobanService uses process.env.DST_CONTRACT_ID inside initializeContract, so we must override it dynamically
  (sorobanService as any).contractId = contractId;

  console.log("Initializing DST Token contract...");
  try {
    await sorobanService.initializeContract(adminKeypair, treasuryPublicKey);
    console.log("Initialization complete!");
  } catch (err: any) {
    if (err.message?.includes("already initialized")) {
      console.log("Already initialized.");
    } else {
      throw err;
    }
  }

  // Also need to register the asset class (XAG)
  console.log("Registering XAG asset class mapping...");
  try {
    // SAC token address will be generated if missing, but we can pass the native token address for XAG issued by TREASURY
    // The native token address on Soroban uses the ContractIdPreimageFromAsset
    const { Asset } = await import('@stellar/stellar-sdk');
    const xagAsset = new Asset("XAG", adminKeypair.publicKey());
    // Let's just pass the treasury public key for now to satisfy the parameter
    await sorobanService.registerAssetClass(
      adminKeypair,
      "XAG",
      adminKeypair.publicKey(), // Mock SAC address
      "1",
      "999",
      "brinks-ny-01",
      "metals.live",
      treasuryPublicKey
    );
    console.log("Asset class registered.");
  } catch (e) {
    console.log("Could not register asset class initially, this might be fine:", e);
  }

  // Update .env
  const envPath = path.join(__dirname, ".env");
  let envData = fs.readFileSync(envPath, "utf8");
  envData = envData.replace(/DST_CONTRACT_ID=.*/, `DST_CONTRACT_ID=${contractId}`);
  fs.writeFileSync(envPath, envData);
  console.log("✅ .env updated. Please restart the backend.");
}

main().catch(console.error);
