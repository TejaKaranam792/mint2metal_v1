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

// Pass array as a JSON file to avoid endless quoting problems
const submitters = ["GCNIKRKSIKJQ4D4X56JO34A4ZF5NYXYCEF64E5XTZDSA2B5OFJWRQGCK"];
fs.writeFileSync("C:/Users/tejak/OneDrive/Desktop/Mint2Metal/app/submitters.json", JSON.stringify(submitters));

const cmd = `stellar contract invoke --id CDJNOZZGZFHEPTMLEQQ3NY3BP3JWDEKZEQ3CUN7OTPLFTMAKRB25JJ6N --source-account alice --network testnet -- initialize --admin GAPZOKK3ZHDAOZTAWKLXUZ5B6P3OI5MTVVLMTPV3F2M7YYHWXX4JMF6X --submitters-file-path submitters.json`;

const res = run(cmd);
fs.writeFileSync("C:/Users/tejak/OneDrive/Desktop/Mint2Metal/app/init_result.log", res);
