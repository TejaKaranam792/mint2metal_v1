import { execSync } from "child_process";

function run(cmd) {
  try {
    const out = execSync(cmd, { cwd: "C:/Users/tejak/OneDrive/Desktop/Mint2Metal/app", encoding: "utf8", stdio: "pipe" });
    console.log(out.trim());
  } catch (e) {
    console.error(e.stderr || e.stdout || e.message);
  }
}

console.log("--- GET STATUS ---");
run(`stellar contract invoke --id CDJNOZZGZFHEPTMLEQQ3NY3BP3JWDEKZEQ3CUN7OTPLFTMAKRB25JJ6N --network testnet --source-account alice -- get_status`);
