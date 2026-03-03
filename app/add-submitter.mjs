import { execSync } from "child_process";
import fs from "fs";

function run(cmd) {
  let out = "";
  try {
    out = execSync(cmd, { cwd: "C:/Users/tejak/OneDrive/Desktop/Mint2Metal/app", encoding: "utf8", stdio: "pipe" });
    return out;
  } catch (e) {
    return "ERROR:\n" + (e.stderr || e.stdout || e.message);
  }
}

const cmd = `stellar contract invoke --id CDJNOZZGZFHEPTMLEQQ3NY3BP3JWDEKZEQ3CUN7OTPLFTMAKRB25JJ6N --source-account alice --network testnet -- add_submitter --new_submitter GCNIKRKSIKJQ4D4X56JO34A4ZF5NYXYCEF64E5XTZDSA2B5OFJWRQGCK`;
const res = run(cmd);

fs.writeFileSync("add_submitter.log", res);
