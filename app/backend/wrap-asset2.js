const { Keypair, Asset, Contract, TransactionBuilder, Networks, rpc, Operation, xdr } = require('@stellar/stellar-sdk');
require('dotenv').config();

async function main() {
  console.log("Wrapping XAG asset on Soroban...");
  const adminSecret = process.env.STELLAR_ADMIN_SECRET;
  if (!adminSecret) throw new Error("STELLAR_ADMIN_SECRET missing");
  const treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY;
  if (!treasuryPublicKey) throw new Error("TREASURY_PUBLIC_KEY missing");

  const adminKeypair = Keypair.fromSecret(adminSecret);
  const xagAsset = new Asset("XAG", treasuryPublicKey);

  const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
  const server = new rpc.Server(rpcUrl);
  const networkPassphrase = process.env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

  try {
    const account = await server.getAccount(adminKeypair.publicKey());

    const op = Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeCreateContract(
        new xdr.CreateContractArgs({
          contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAsset(xagAsset.toXDRObject()),
          executable: xdr.ContractExecutable.contractExecutableStellarAsset(),
        })
      ),
      auth: []
    });

    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase
    })
      .addOperation(op)
      .setTimeout(60)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    preparedTx.sign(adminKeypair);

    console.log("Submitting SAC deployment transaction...");
    const response = await server.sendTransaction(preparedTx);

    console.log("Transaction submitted. Hash:", response.hash);
  } catch (e) {
    console.error("Failed to wrap asset:", e.message || e);
    if (e.response && e.response.data) {
      console.error(JSON.stringify(e.response.data, null, 2));
    }
  }
}

main().then(() => console.log('Done')).catch(console.error);
