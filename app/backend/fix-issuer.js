const { Keypair, Asset, Contract, TransactionBuilder, Networks, rpc, Operation, xdr, nativeToScVal } = require('@stellar/stellar-sdk');
require('dotenv').config();
const fs = require('fs');

function log(msg) {
  fs.appendFileSync('fix-issuer-log.txt', msg + '\n');
  console.log(msg);
}

async function main() {
  log("Starting full issuer migration to Admin account...");
  const adminSecret = process.env.STELLAR_ADMIN_SECRET;
  const treasurySecret = process.env.TREASURY_SECRET;
  const treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY;
  const contractId = process.env.DST_CONTRACT_ID;

  const adminKeypair = Keypair.fromSecret(adminSecret);
  const treasuryKeypair = Keypair.fromSecret(treasurySecret);

  // NEW ASSET DEFINITION: Admin is the issuer
  const xagAsset = new Asset("XAG", adminKeypair.publicKey());

  const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
  const server = new rpc.Server(rpcUrl);
  const networkPassphrase = process.env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

  const expectedContractId = xagAsset.contractId(networkPassphrase);
  log("New target SAC Contract ID for Admin-issued XAG: " + expectedContractId);

  try {
    const adminAccount = await server.getAccount(adminKeypair.publicKey());

    // STEP 1: Deploy SAC wrapper for Admin's XAG
    log("Deploying SAC wrapper...");
    const wrapOp = Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeCreateContract(
        new xdr.CreateContractArgs({
          contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAsset(xagAsset.toXDRObject()),
          executable: xdr.ContractExecutable.contractExecutableStellarAsset(),
        })
      ),
      auth: []
    });

    const wrapTx = new TransactionBuilder(adminAccount, { fee: '100000', networkPassphrase })
      .addOperation(wrapOp)
      .setTimeout(60)
      .build();

    let preparedWrapTx = await server.prepareTransaction(wrapTx);
    preparedWrapTx.sign(adminKeypair);

    try {
      log("Submitting SAC deployment...");
      const wrapRes = await server.sendTransaction(preparedWrapTx);
      log("Wrap submitted Hash: " + wrapRes.hash);

      let status = await server.getTransaction(wrapRes.hash);
      while (status.status === 'NOT_FOUND') {
        await new Promise(r => setTimeout(r, 3000));
        status = await server.getTransaction(wrapRes.hash);
      }
      log("Wrap SAC final status: " + status.status);
    } catch (e) {
      log("SAC deployment failed or already exists. Continuing...");
    }

    // STEP 2: Register the new SAC in DST contract
    log("Registering new SAC in DST contract...");
    const contract = new Contract(contractId);

    // Using adminKeypair since Admin is the admin of the DST contract
    const freshAdminAccount = await server.getAccount(adminKeypair.publicKey());
    const regOp = contract.call(
      'register_asset_class',
      nativeToScVal("XAG", { type: 'symbol' }),
      nativeToScVal(expectedContractId, { type: 'address' }),
      nativeToScVal(1, { type: 'u32' }),
      nativeToScVal(999, { type: 'u32' }),
      nativeToScVal("brinks-ny-01", { type: 'string' }),
      nativeToScVal("metals.live", { type: 'string' }),
      nativeToScVal(adminKeypair.publicKey(), { type: 'address' }) // The issuer is Admin
    );

    const regTx = new TransactionBuilder(freshAdminAccount, { fee: '100000', networkPassphrase })
      .addOperation(regOp)
      .setTimeout(60)
      .build();

    let preparedRegTx = await server.prepareTransaction(regTx);
    preparedRegTx.sign(adminKeypair);

    try {
      const regRes = await server.sendTransaction(preparedRegTx);
      log("Registration submitted Hash: " + regRes.hash);

      let status = await server.getTransaction(regRes.hash);
      while (status.status === 'NOT_FOUND') {
        await new Promise(r => setTimeout(r, 3000));
        status = await server.getTransaction(regRes.hash);
      }
      log("Registry final status: " + status.status);
    } catch (e) {
      log("Registration failed, possibly already registered. Continuing...");
    }

    // STEP 3: Setup Trustline for Treasury to Admin's XAG
    log("Creating trustline for Treasury to Admin's XAG...");
    const treasuryAccount = await server.getAccount(treasuryPublicKey);

    const trustOp = Operation.changeTrust({
      asset: xagAsset,
      limit: "922337203685.4775807"
    });

    const trustTx = new TransactionBuilder(treasuryAccount, { fee: '100000', networkPassphrase })
      .addOperation(trustOp)
      .setTimeout(60)
      .build();

    trustTx.sign(treasuryKeypair);

    try {
      const horizon = new (require('@stellar/stellar-sdk').Horizon.Server)('https://horizon-testnet.stellar.org');
      const trustRes = await horizon.submitTransaction(trustTx);
      log("Trustline established, Hash: " + trustRes.hash);
    } catch (e) {
      log("Trustline failed, might already exist.");
    }

    log("Migration successfully finished.");
  } catch (e) {
    log("Migration error: " + (e.message || e));
  }
}

main().then(() => log('Done')).catch(console.error);
