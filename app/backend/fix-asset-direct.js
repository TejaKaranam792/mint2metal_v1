const { Keypair, Asset, Contract, TransactionBuilder, Networks, rpc, nativeToScVal } = require('@stellar/stellar-sdk');
require('dotenv').config();
const fs = require('fs');

function log(msg) {
  fs.appendFileSync('fix-log.txt', msg + '\n');
  console.log(msg);
}

async function main() {
  log("Fixing XAG asset registry on Soroban...");
  const adminSecret = process.env.STELLAR_ADMIN_SECRET;
  const treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY;
  const contractId = process.env.DST_CONTRACT_ID;

  const adminKeypair = Keypair.fromSecret(adminSecret);
  const xagAsset = new Asset("XAG", treasuryPublicKey);

  const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
  const server = new rpc.Server(rpcUrl);
  const networkPassphrase = process.env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

  const expectedContractId = xagAsset.contractId(networkPassphrase);
  log("Target SAC Contract ID: " + expectedContractId);

  try {
    const account = await server.getAccount(adminKeypair.publicKey());
    const contract = new Contract(contractId);

    // Register it natively using raw invoke
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

    const regTx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase
    })
      .addOperation(regOp)
      .setTimeout(60)
      .build();

    const preparedTx = await server.prepareTransaction(regTx);
    preparedTx.sign(adminKeypair);

    log("Submitting register_asset_class transaction...");
    const response = await server.sendTransaction(preparedTx);

    log("Transaction submitted. Hash: " + response.hash);

    // Wait and check status
    let status = await server.getTransaction(response.hash);
    while (status.status === 'NOT_FOUND') {
      log("Polling for completion...");
      await new Promise(r => setTimeout(r, 3000));
      status = await server.getTransaction(response.hash);
    }
    log("Final status: " + status.status);
    if (status.status === 'FAILED') {
      log("Tx details: " + JSON.stringify(status.resultMetaXdr, null, 2));
    }
  } catch (e) {
    log("Failed to complete asset registry fix: " + (e.message || e));
    if (e.response && e.response.data) {
      log(JSON.stringify(e.response.data, null, 2));
    }
  }
}

main().then(() => log('Done')).catch(console.error);
