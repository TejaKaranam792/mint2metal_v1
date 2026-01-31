import { Keypair, Contract, SorobanRpc, TransactionBuilder, Networks, xdr, Operation } from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';

async function deployContract(
  contractName: string,
  wasmPath: string,
  adminSecret: string,
  network: 'testnet' | 'mainnet' = 'testnet'
) {
  console.log(`🚀 Deploying ${contractName} contract...`);

  // Initialize server and network
  const server = new SorobanRpc.Server(
    network === 'mainnet'
      ? 'https://soroban-rpc.mainnet.stellar.org'
      : 'https://soroban-testnet.stellar.org'
  );

  const networkPassphrase = network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

  // Load admin keypair
  const adminKeypair = Keypair.fromSecret(adminSecret);

  try {
    // Read WASM file
    const wasmBuffer = fs.readFileSync(wasmPath);

    // Get account
    const account = await server.getAccount(adminKeypair.publicKey());

    // Create deployment transaction
    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase
    })
      .addOperation(
        Operation.invokeHostFunction({
          func: xdr.HostFunction.hostFunctionTypeCreateContract(
            new xdr.CreateContractArgs({
              executable: xdr.ContractExecutable.contractExecutableWasm(wasmBuffer),
              contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
                new xdr.ContractIdPreimageFromAddress({
                  address: xdr.ScAddress.scAddressTypeAccount(adminKeypair.publicKey() as any),
                  salt: Buffer.from(contractName, 'utf8')
                })
              )
            })
          )
        })
      )
      .setTimeout(30)
      .build();

    // Sign and submit
    tx.sign(adminKeypair);
    const result = await server.sendTransaction(tx);

    // Wait for transaction confirmation
    let status = await server.getTransaction(result.hash);
    while ((status as any).status === 'pending') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      status = await server.getTransaction(result.hash);
    }

    if ((status as any).status !== 'success') {
      throw new Error(`Transaction failed: ${(status as any).status}`);
    }

    // Extract contract ID from transaction result
    const contractId = (status as any).returnValue?.toString('hex');
    if (!contractId) {
      throw new Error('Contract ID not found in transaction result');
    }

    console.log(`✅ ${contractName} deployed successfully!`);
    console.log(`📋 Contract ID: ${contractId}`);
    console.log(`🔗 Transaction Hash: ${result.hash}`);

    return contractId;

  } catch (error) {
    console.error(`❌ Failed to deploy ${contractName}:`, error);
    throw error;
  }
}

async function main() {
  const network = (process.env.STELLAR_NETWORK as 'testnet' | 'mainnet') || 'testnet';
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    throw new Error('ADMIN_SECRET environment variable is required');
  }

  console.log(`🌐 Deploying to ${network.toUpperCase()}`);
  console.log(`👤 Admin: ${Keypair.fromSecret(adminSecret).publicKey()}`);

  // Deploy DST Token contract
  const dstContractId = await deployContract(
    'DST Token',
    path.join(__dirname, '../../contracts/dst-token/target/wasm32v1-none/release/dst_token.wasm'),
    adminSecret,
    network
  );

  // Deploy Loan contract
  const loanContractId = await deployContract(
    'Loan Contract',
    path.join(__dirname, '../../contracts/loan-contract/target/wasm32v1-none/release/loan_contract.wasm'),
    adminSecret,
    network
  );

  console.log('\n🎉 All contracts deployed successfully!');
  console.log('📋 Contract IDs:');
  console.log(`   DST Token: ${dstContractId}`);
  console.log(`   Loan Contract: ${loanContractId}`);

  // Save contract IDs to environment file
  const envPath = path.join(__dirname, '../../.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Update or add contract IDs
  envContent = envContent.replace(/DST_CONTRACT_ID=.*/g, `DST_CONTRACT_ID=${dstContractId}`);
  envContent = envContent.replace(/LOAN_CONTRACT_ID=.*/g, `LOAN_CONTRACT_ID=${loanContractId}`);

  if (!envContent.includes('DST_CONTRACT_ID=')) {
    envContent += `\nDST_CONTRACT_ID=${dstContractId}`;
  }
  if (!envContent.includes('LOAN_CONTRACT_ID=')) {
    envContent += `\nLOAN_CONTRACT_ID=${loanContractId}`;
  }

  fs.writeFileSync(envPath, envContent.trim());
  console.log('💾 Contract IDs saved to .env file');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { deployContract };
