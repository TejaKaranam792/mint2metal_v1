import { Keypair, Address, nativeToScVal, Contract, TransactionBuilder, SorobanRpc } from "@stellar/stellar-sdk";
import fs from "fs";

const ORACLE_CONTRACT_ID = "CDJNOZZGZFHEPTMLEQQ3NY3BP3JWDEKZEQ3CUN7OTPLFTMAKRB25JJ6N";
const ORACLE_SUBMITTER_SECRET = "SAT7UROE7EQ6OLF5XN4FU44SOU6FD7TIGHJNOFF4PWZEHTOCTCYZJZL2";
const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

async function main() {
  let out = "";
  try {
    const submitter = Keypair.fromSecret(ORACLE_SUBMITTER_SECRET);
    const server = new SorobanRpc.Server(SOROBAN_RPC_URL);
    const account = await server.getAccount(submitter.publicKey());
    const contract = new Contract(ORACLE_CONTRACT_ID);

    const priceMicroUsd = BigInt(3013069);
    const timestampU64 = BigInt(Math.floor(Date.now() / 1000));

    out += `Submitting with: ${submitter.publicKey()} ${priceMicroUsd} ${timestampU64}\n`;

    const operation = contract.call(
      "submit_price",
      new Address(submitter.publicKey()).toScVal(),
      nativeToScVal(priceMicroUsd, { type: "i128" }),
      nativeToScVal(timestampU64, { type: "u64" })
    );

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    out += "Simulating...\n";
    const sim = await server.simulateTransaction(tx);
    out += "Sim result:\n" + JSON.stringify(sim, null, 2);
  } catch (e) {
    out += "Error:\n" + e.stack;
  }
  fs.writeFileSync("sim_result.txt", out);
}

main().catch(e => fs.writeFileSync("sim_result.txt", "Fatal:\n" + e.stack));
