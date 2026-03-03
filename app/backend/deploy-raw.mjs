import { execSync } from "child_process";
import fs from "fs";
import path from "path";

try {
  const appDir = "C:\\Users\\tejak\\OneDrive\\Desktop\\Mint2Metal\\app\\backend";
  const cmd = `stellar contract deploy --wasm "C:\\Users\\tejak\\OneDrive\\Desktop\\Mint2Metal\\app\\contracts\\dst-token\\target\\wasm32-unknown-unknown\\release\\dst_token.optimized.wasm" --source-account SCUR3RJGLFHLHQQZNZCKPURBDI4CVN437GGHK53QMFA7GNEH2VAJXCCL --network testnet --network-passphrase "Test SDF Network ; September 2015"`;

  const out = execSync(cmd, { encoding: "utf8" });
  console.log("Deployed successfully. Contract ID is:", out.trim());

  const envPath = path.join(appDir, ".env");
  let envData = fs.readFileSync(envPath, "utf8");
  envData = envData.replace(/DST_CONTRACT_ID=.*/, `DST_CONTRACT_ID=${out.trim()}`);
  fs.writeFileSync(envPath, envData);

  console.log("Updated .env file with new DST_CONTRACT_ID!");

  // also run initialization since it's a new contract!
  const initCmd = `stellar contract invoke --id "${out.trim()}" --source-account SCUR3RJGLFHLHQQZNZCKPURBDI4CVN437GGHK53QMFA7GNEH2VAJXCCL --network testnet --network-passphrase "Test SDF Network ; September 2015" -- initialize --admin "GABTF6HFGUGYGUSMU23SC3NWQOJKNADKZAJZY3NOARNE3ORLSKGNVREL"`;
  const initOut = execSync(initCmd, { encoding: "utf8" });
  console.log("Initialized contract!");

  // register asset class
  const regCmd = `stellar contract invoke --id "${out.trim()}" --source-account SCUR3RJGLFHLHQQZNZCKPURBDI4CVN437GGHK53QMFA7GNEH2VAJXCCL --network testnet --network-passphrase "Test SDF Network ; September 2015" -- register_asset_class --commodity_type XAG --token_address "GABTF6HFGUGYGUSMU23SC3NWQOJKNADKZAJZY3NOARNE3ORLSKGNVREL" --unit_weight 1 --purity 999 --vault_id "brinks-ny-01" --oracle_source "metals.live" --issuer_id "GAQSTTMR5P4YBJ3ZVE3HQ46QA2RED3VSNHGVLF5PHBDVOXW5Z5SSPPG2"`;
  const regOut = execSync(regCmd, { encoding: "utf8" });
  console.log("Registered asset class XAG!");

} catch (e) {
  console.error("ERROR:", e.message);
  if (e.stdout) console.error("STDOUT:", e.stdout.toString());
  if (e.stderr) console.error("STDERR:", e.stderr.toString());
}
