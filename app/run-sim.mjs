import { execSync } from "child_process";
import fs from "fs";

try {
  const out = execSync("node -e \"import('@stellar/stellar-sdk').then(async sdk => { const { Keypair, Address, nativeToScVal, Contract, TransactionBuilder, SorobanRpc } = sdk; const ORACLE_CONTRACT_ID = 'CDJNOZZGZFHEPTMLEQQ3NY3BP3JWDEKZEQ3CUN7OTPLFTMAKRB25JJ6N'; const ORACLE_SUBMITTER_SECRET = 'SAT7UROE7EQ6OLF5XN4FU44SOU6FD7TIGHJNOFF4PWZEHTOCTCYZJZL2'; const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org'); const submitter = Keypair.fromSecret(ORACLE_SUBMITTER_SECRET); const account = await server.getAccount(submitter.publicKey()); const contract = new Contract(ORACLE_CONTRACT_ID); const op = contract.call('submit_price', new Address(submitter.publicKey()).toScVal(), nativeToScVal(BigInt(3013069), {type: 'i128'}), nativeToScVal(BigInt(Math.floor(Date.now() / 1000)), {type:'u64'})); const tx = new TransactionBuilder(account, {fee: '100', networkPassphrase: 'Test SDF Network ; September 2015'}).addOperation(op).setTimeout(30).build(); const sim = await server.simulateTransaction(tx); console.log(JSON.stringify(sim, null, 2)); }).catch(e => console.error(e));\"", { encoding: "utf8" });
  fs.writeFileSync("sim_result.txt", out);
} catch (e) {
  fs.writeFileSync("sim_result.txt", e.stdout + "\n" + e.stderr);
}
