import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Keypair, Contract, rpc, TransactionBuilder, Networks, xdr, Operation } from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { sorobanService } from '../services/soroban.service';

console.log('--- DEPLOY SCRIPT STARTING ---');
fs.writeFileSync(path.join(__dirname, '../deploy-internal.log'), 'DEPL0Y START\n');

async function deployContract(
  contractName: string,
  wasmPath: string,
  adminSecret: string,
  network: 'testnet' | 'mainnet' = 'testnet'
) {
  console.log(`🚀 Deploying ${contractName} contract...`);

  // Initialize server and network
  const server = new rpc.Server(
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
    const account = await server.getAccount(adminKeypair.publicKey());

    // 1. Upload WASM (Install)
    console.log(`📤 Uploading WASM for ${contractName}...`);
    fs.appendFileSync(path.join(__dirname, '../deploy-internal.log'), `Uploading WASM for ${contractName}...\n`);

    const uploadOp = Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeUploadContractWasm(wasmBuffer)
    });

    const uploadTx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase
    })
      .addOperation(uploadOp)
      .setTimeout(30)
      .build();

    uploadTx.sign(adminKeypair);
    const uploadResult = await server.sendTransaction(uploadTx);

    // Wait for upload confirmation
    let uploadStatus = await server.getTransaction(uploadResult.hash);
    while ((uploadStatus as any).status === 'NOT_FOUND' || (uploadStatus as any).status === 'pending') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      uploadStatus = await server.getTransaction(uploadResult.hash);
    }

    if ((uploadStatus as any).status !== 'success') {
      throw new Error(`WASM upload failed: ${(uploadStatus as any).status}`);
    }

    // Extract WASM ID (32 bytes)
    const wasmId = (uploadStatus as any).returnValue?.xdr()?.slice(-32);
    if (!wasmId) {
      throw new Error('WASM ID not found in transaction result');
    }
    console.log(`✅ WASM uploaded! ID: ${wasmId.toString('hex')}`);
    fs.appendFileSync(path.join(__dirname, '../deploy-internal.log'), `WASM ID: ${wasmId.toString('hex')}\n`);

    // 2. Create Contract (Instantiate)
    console.log(`🏗️ Creating ${contractName} contract instance...`);
    fs.appendFileSync(path.join(__dirname, '../deploy-internal.log'), `Creating ${contractName} instance...\n`);

    const createAccount = await server.getAccount(adminKeypair.publicKey());
    const createTx = new TransactionBuilder(createAccount, {
      fee: '100000',
      networkPassphrase
    })
      .addOperation(
        Operation.invokeHostFunction({
          func: xdr.HostFunction.hostFunctionTypeCreateContract(
            new xdr.CreateContractArgs({
              executable: xdr.ContractExecutable.contractExecutableWasm(wasmId),
              contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
                new xdr.ContractIdPreimageFromAddress({
                  address: xdr.ScAddress.scAddressTypeAccount(adminKeypair.xdrPublicKey()),
                  salt: crypto.createHash('sha256').update(contractName).digest()
                })
              )
            })
          )
        })
      )
      .setTimeout(30)
      .build();

    createTx.sign(adminKeypair);
    const result = await server.sendTransaction(createTx);

    // Wait for transaction confirmation
    let status = await server.getTransaction(result.hash);
    while ((status as any).status === 'NOT_FOUND' || (status as any).status === 'pending') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      status = await server.getTransaction(result.hash);
    }

    if ((status as any).status !== 'success') {
      throw new Error(`Deployment failed: ${(status as any).status}`);
    }

    // Extract contract ID from transaction result
    const contractId = (status as any).returnValue?.address()?.toString();
    if (!contractId) {
      throw new Error('Contract ID not found in transaction result');
    }

    console.log(`✅ ${contractName} deployed successfully!`);
    console.log(`📋 Contract ID: ${contractId}`);
    fs.appendFileSync(path.join(__dirname, '../deploy-internal.log'), `${contractName} ID: ${contractId}\n`);

    return contractId;

  } catch (error: any) {
    console.error(`❌ Failed to deploy ${contractName}:`, error);
    fs.appendFileSync(path.join(__dirname, '../deploy-internal.log'), `ERROR: ${error.message}\n`);
    throw error;
  }
}

async function main() {
  const network = (process.env.STELLAR_NETWORK as 'testnet' | 'mainnet') || 'testnet';
  const adminSecret = process.env.STELLAR_ADMIN_SECRET || process.env.ADMIN_SECRET;

  if (!adminSecret) {
    throw new Error('STELLAR_ADMIN_SECRET or ADMIN_SECRET environment variable is required');
  }

  let treasurySecret = process.env.TREASURY_SECRET;
  let treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY;

  if (!treasurySecret) {
    console.log('⚠️ TREASURY_SECRET not found in environment. Generating a new Treasury Buffer Wallet...');
    const kp = Keypair.random();
    treasurySecret = kp.secret();
    treasuryPublicKey = kp.publicKey();
  } else if (!treasuryPublicKey) {
    treasuryPublicKey = Keypair.fromSecret(treasurySecret).publicKey();
  }

  console.log(`🌐 Deploying to ${network.toUpperCase()}`);
  console.log(`👤 Admin: ${Keypair.fromSecret(adminSecret).publicKey()}`);
  console.log(`🏦 Treasury Buffer: ${treasuryPublicKey}`);

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
  const envPath = path.join(__dirname, '../.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Update or add contract IDs
  envContent = envContent.replace(/DST_CONTRACT_ID=.*/g, `DST_CONTRACT_ID=${dstContractId}`);
  envContent = envContent.replace(/LOAN_CONTRACT_ID=.*/g, `LOAN_CONTRACT_ID=${loanContractId}`);
  if (envContent.includes('TREASURY_SECRET=')) {
    envContent = envContent.replace(/TREASURY_SECRET=.*/g, `TREASURY_SECRET=${treasurySecret}`);
  }
  if (envContent.includes('TREASURY_PUBLIC_KEY=')) {
    envContent = envContent.replace(/TREASURY_PUBLIC_KEY=.*/g, `TREASURY_PUBLIC_KEY=${treasuryPublicKey}`);
  }

  if (!envContent.includes('DST_CONTRACT_ID=')) {
    envContent += `\nDST_CONTRACT_ID=${dstContractId}`;
  }
  if (!envContent.includes('LOAN_CONTRACT_ID=')) {
    envContent += `\nLOAN_CONTRACT_ID=${loanContractId}`;
  }
  if (!envContent.includes('TREASURY_SECRET=')) {
    envContent += `\nTREASURY_SECRET=${treasurySecret}`;
  }
  if (!envContent.includes('TREASURY_PUBLIC_KEY=')) {
    envContent += `\nTREASURY_PUBLIC_KEY=${treasuryPublicKey}`;
  }

  fs.writeFileSync(envPath, envContent.trim());
  console.log('💾 Contract IDs and Treasury Keys saved to .env file');

  // Initialize the deployed DST Token contract
  console.log('⏳ Initializing the DST Token Contract with Admin and Treasury Buffer...');
  try {
    // Inject the new contract ID into the service so it interacts with the newly deployed one
    (sorobanService as any).contractId = dstContractId;
    const initHash = await sorobanService.initializeContract(
      Keypair.fromSecret(adminSecret),
      treasuryPublicKey!
    );
    console.log(`✅ Contract Initialized! Tx Hash: ${initHash}`);

    // Final result writing
    const results = {
      success: true,
      dstContractId,
      loanContractId,
      treasuryPublicKey,
      initHash
    };
    fs.writeFileSync(path.join(__dirname, '../deploy-results.json'), JSON.stringify(results, null, 2));

  } catch (err: any) {
    console.warn(`⚠️ Failed to initialize contract Automatically. Error: ${err.message}. You may need to fund the admin wallet or run initialization manually.`);
    const results = {
      success: false,
      error: err.message,
      dstContractId,
      loanContractId,
      treasuryPublicKey
    };
    fs.writeFileSync(path.join(__dirname, '../deploy-results.json'), JSON.stringify(results, null, 2));
  }
}

main().catch(err => {
  fs.appendFileSync(path.join(__dirname, '../deploy-internal.log'), `FATAL ERROR: ${err.message}\n${err.stack}\n`);
  console.error(err);
});

export { deployContract };
