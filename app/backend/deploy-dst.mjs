import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run(cmd, cwd, logFile) {
  fs.appendFileSync(logFile, `\n> Running: ${cmd}\n`);
  try {
    const out = execSync(cmd, { cwd, encoding: "utf8", stdio: "pipe" });
    fs.appendFileSync(logFile, `OUT:\n${out.trim()}\n`);
    return out.trim();
  } catch (e) {
    fs.appendFileSync(logFile, `ERR:\n${e.stderr || e.stdout || e.message}\n`);
    throw e;
  }
}

async function main() {
  const appDir = path.resolve(__dirname, "..");
  const logFile = path.join(appDir, "deploy_dst.log");
  fs.writeFileSync(logFile, "Starting deploy...\n");

  try {
    const wasmPath = path.join(appDir, "contracts", "dst-token", "target", "wasm32-unknown-unknown", "release", "dst_token.optimized.wasm");

    // We will deploy using the STELLAR_ADMIN_SECRET
    // Let's get it from .env
    const envPath = path.join(appDir, "backend", ".env");
    const envData = fs.readFileSync(envPath, "utf8");
    const secretMatch = envData.match(/STELLAR_ADMIN_SECRET="(.*?)"/);
    if (!secretMatch) throw new Error("Could not find STELLAR_ADMIN_SECRET in .env");
    const adminSecret = secretMatch[1];

    const treasuryPublicKeyMatch = envData.match(/TREASURY_PUBLIC_KEY=(.*?)\n/);
    const treasuryPublicKey = treasuryPublicKeyMatch ? treasuryPublicKeyMatch[1].trim() : "";

    let contractId = "";
    try {
      // NOTE: Passing secret directly to CLI is slightly insecure but fine for local testnet
      const deployOutput = run(`stellar contract deploy --wasm "${wasmPath}" --source-account ${adminSecret} --network testnet`, appDir, logFile);
      contractId = deployOutput.split('\n').pop().trim();
    } catch (e) {
      throw e;
    }

    console.log("Deployed contract ID:", contractId);

    // Get Admin Server public key
    const adminKey = run(`stellar keys address ${adminSecret}`, appDir, logFile);

    console.log("Initializing...");
    const initCmd = `stellar contract invoke --id "${contractId}" --source-account ${adminSecret} --network testnet -- initialize --admin "${adminKey}"`;
    try {
      run(initCmd, appDir, logFile);
      fs.appendFileSync(logFile, `\n✅ Contract Initialized!`);
    } catch (e) {
      fs.appendFileSync(logFile, `\n⚠️ Maybe already initialized? Ignoring.`);
    }

    console.log("Registering Asset Class XAG...");
    // register_asset_class(env, commodity_type: Symbol, token_address: Address, unit_weight: u32, purity: u32, vault_id: String, oracle_source: String, issuer_id: Address)
    // token_address can be treasuryPublicKey for now
    const regCmd = `stellar contract invoke --id "${contractId}" --source-account ${adminSecret} --network testnet -- register_asset_class --commodity_type XAG --token_address "${adminKey}" --unit_weight 1 --purity 999 --vault_id "brinks-ny-01" --oracle_source "metals.live" --issuer_id "${treasuryPublicKey}"`;
    try {
      run(regCmd, appDir, logFile);
      fs.appendFileSync(logFile, `\n✅ Asset Class Registered!`);
    } catch (e) {
      fs.appendFileSync(logFile, `\n⚠️ Asset class registration failed. Details in log.`);
    }

    // Update .env
    let newEnvData = envData.replace(/DST_CONTRACT_ID=.*/, `DST_CONTRACT_ID=${contractId}`);
    fs.writeFileSync(envPath, newEnvData);
    console.log("✅ .env updated successfully!");

    fs.appendFileSync(logFile, `\n✅ Run complete! Contract ID: ${contractId}\n`);
  } catch (e) {
    console.error("Deploy failed:", e);
    fs.appendFileSync(logFile, `\nFATAL EXCEPTION:\n${e.stack}\n`);
  }
}

main().catch(console.error);
