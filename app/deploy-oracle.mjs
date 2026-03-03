import { execSync } from "child_process";
import fs from "fs";
import path from "path";

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
  const appDir = "C:\\Users\\tejak\\OneDrive\\Desktop\\Mint2Metal\\app";
  const logFile = path.join(appDir, "deploy_oracle.log");
  fs.writeFileSync(logFile, "Starting deploy...\n");

  try {
    // Ensure oracle-submitter is funded
    try {
      // Note: If you don't use --fund, you can't submit to testnet. But oracle-submitter only submits transactions via the backend.
      // Wait, actually, let's just use alice for deploy, but we need the oracle-submitter's SECRET key!
      // Let's get the secret key.
    } catch (e) { }

    const wasmPath = path.join(appDir, "contracts", "oracle-aggregator", "target", "wasm32-unknown-unknown", "release", "oracle_aggregator.wasm");

    const publicKey = run(`stellar keys address oracle-submitter`, appDir, logFile);
    const secretKeyRaw = run(`stellar keys show oracle-submitter`, appDir, logFile);

    const adminKey = run(`stellar keys address alice`, appDir, logFile);

    let contractId = "";
    try {
      const deployOutput = run(`stellar contract deploy --wasm "${wasmPath}" --source-account alice --network testnet --alias oracle-aggregator`, appDir, logFile);
      contractId = deployOutput.split('\n').pop().trim();
    } catch (e) {
      // If already deployed under that alias maybe, or error.
      throw e;
    }

    const initCmd = `stellar contract invoke --id "${contractId}" --source-account alice --network testnet -- initialize --admin "${adminKey}" --submitters '["${publicKey}"]'`;
    try {
      run(initCmd, appDir, logFile);
      fs.appendFileSync(logFile, `\n✅ Contract Initialized!`);
    } catch (e) {
      fs.appendFileSync(logFile, `\n⚠️ Maybe already initialized? Ignoring.`);
    }

    // Update .env
    const envPath = path.join(appDir, "backend", ".env");
    let envData = fs.readFileSync(envPath, "utf8");

    envData = envData.replace(/ORACLE_CONTRACT_ID=.*/, `ORACLE_CONTRACT_ID="${contractId}"`);
    // Find the secret key (it's the 56 char S string)
    const secretKeyMatch = secretKeyRaw.match(/S[A-Z0-9]{55}/);
    if (secretKeyMatch) {
      const secretKey = secretKeyMatch[0];
      envData = envData.replace(/ORACLE_SUBMITTER_SECRET=.*/, `ORACLE_SUBMITTER_SECRET="${secretKey}"`);
      fs.appendFileSync(logFile, `\n✅ Also found and updated ORACLE_SUBMITTER_SECRET.`);
    }

    fs.writeFileSync(envPath, envData);
    fs.appendFileSync(logFile, `\n✅ Run complete! Contract ID: ${contractId}\n`);
  } catch (e) {
    fs.appendFileSync(logFile, `\nFATAL EXCEPTION:\n${e.stack}\n`);
  }
}

main().catch(err => {
  const appDir = "C:\\Users\\tejak\\OneDrive\\Desktop\\Mint2Metal\\app";
  const logFile = path.join(appDir, "deploy_oracle.log");
  fs.appendFileSync(logFile, `\ncatch block:\n${err.message}`);
});
