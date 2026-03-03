const { Keypair, Asset, Contract, TransactionBuilder, Networks, rpc, xdr, scValToNative, nativeToScVal } = require('@stellar/stellar-sdk');
require('dotenv').config();
const fs = require('fs');

function log(msg) {
  fs.appendFileSync('check-log.txt', msg + '\n');
}

async function main() {
  log("Checking XAG asset on Soroban...");
  const adminSecret = process.env.STELLAR_ADMIN_SECRET;
  const treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY;
  const contractId = process.env.DST_CONTRACT_ID;

  const adminKeypair = Keypair.fromSecret(adminSecret);
  const xagAsset = new Asset("XAG", treasuryPublicKey);

  const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
  const server = new rpc.Server(rpcUrl);
  const networkPassphrase = process.env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

  const expectedContractId = xagAsset.contractId(networkPassphrase);
  log("Expected SAC Contract ID: " + expectedContractId);

  try {
    const account = await server.getAccount(adminKeypair.publicKey());
    const contract = new Contract(contractId);

    // Read current asset registration
    const readOp = contract.call('get_asset_class', nativeToScVal("XAG", { type: 'symbol' }));

    const readTx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase
    })
      .addOperation(readOp)
      .setTimeout(60)
      .build();

    const sim = await server.simulateTransaction(readTx);

    if (sim.results && sim.results[0] && sim.results[0].xdr) {
      const resVal = xdr.SCVal.fromXDR(sim.results[0].xdr, 'base64');
      const data = scValToNative(resVal);
      log("Current Registered Asset: " + JSON.stringify(data, null, 2));

      if (data.token_address !== expectedContractId) {
        log(`Mismatch! Expected ${expectedContractId} but got ${data.token_address}`);
        log("Reregistering right now...");

        // Re-register it
        const regOp = contract.call(
          'register_asset_class',
          nativeToScVal("XAG", { type: 'symbol' }),
          nativeToScVal(expectedContractId, { type: 'address' }),
          nativeToScVal(1, { type: 'u32' }),
          nativeToScVal(999, { type: 'u32' }),
          nativeToScVal("brinks-ny-01", { type: 'string' }),
          nativeToScVal("metals.live", { type: 'string' }),
          nativeToScVal(treasuryPublicKey, { type: 'address' })
        );

        const regTx = new TransactionBuilder(await server.getAccount(adminKeypair.publicKey()), {
          fee: '100000',
          networkPassphrase
        }).addOperation(regOp).setTimeout(60).build();

        const preparedTx = await server.prepareTransaction(regTx);
        preparedTx.sign(adminKeypair);

        const response = await server.sendTransaction(preparedTx);
        log("Re-registration tx: " + response.hash);
      } else {
        log("Asset already correctly registered with SAC address.");
      }
    } else {
      log("Failed to read asset class: " + JSON.stringify(sim.error));
    }
  } catch (e) {
    log("Error reading asset: " + (e.message || e));
  }
}

main().then(() => log('Done')).catch(console.error);
