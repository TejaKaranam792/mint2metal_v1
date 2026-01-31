import { Keypair, TransactionBuilder, Networks, Contract, SorobanRpc, xdr, nativeToScVal, scValToNative, Operation, StrKey } from '@stellar/stellar-sdk';
import { prisma } from '../prisma';
import winston from 'winston';

export enum UserRole {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  USER = 'USER'
}

export class SorobanService {
  private server: SorobanRpc.Server;
  private networkPassphrase: string;
  private contractId: string;
  private loanContractId: string;
  private logger: winston.Logger;

  constructor() {
    this.server = new SorobanRpc.Server(process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org');
    this.networkPassphrase = process.env.STELLAR_NETWORK === 'mainnet'
      ? Networks.PUBLIC
      : Networks.TESTNET;
    this.contractId = process.env.DST_CONTRACT_ID || 'CDBTLG5FXPPTFPQB7OJZVILNRZU6TR2GF7WNAFBLNH72WWSZPU73P5TO';
    this.loanContractId = process.env.LOAN_CONTRACT_ID || 'CCXLLPAILNMYZI2Z37YE2R5O75W672JRM5H7RVQVLIKKBTYOX2KVOCQS';

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'soroban.log' })
      ]
    });
  }

  /**
   * Initialize the DST token contract
   */
  async initializeContract(adminKeypair: Keypair): Promise<string> {
    try {
      const account = await this.server.getAccount(adminKeypair.publicKey());
      const contract = new Contract(this.contractId);

      // Initialize contract with admin role
      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call('initialize', nativeToScVal(adminKeypair.publicKey(), { type: 'address' })))
        .setTimeout(30)
        .build();

      tx.sign(adminKeypair);
      const result = await this.server.sendTransaction(tx);

      this.logger.info('DST Contract initialized', { txHash: result.hash });
      return result.hash;
    } catch (error) {
      this.logger.error('Failed to initialize DST contract', { error });
      throw error;
    }
  }

  /**
   * Mint DST tokens
   */
  async mintTokens(
    adminKeypair: Keypair,
    to: string,
    amount: string,
    reservesProof: string
  ): Promise<string> {
    try {
      const account = await this.server.getAccount(adminKeypair.publicKey());
      const contract = new Contract(this.contractId);

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call(
          'mint',
          nativeToScVal(to, { type: 'address' }),
          nativeToScVal(BigInt(amount), { type: 'u64' }),
          nativeToScVal(reservesProof, { type: 'string' })
        ))
        .setTimeout(30)
        .build();

      tx.sign(adminKeypair);
      const result = await this.server.sendTransaction(tx);

      // Log minting event in audit log
      await prisma.auditLog.create({
        data: {
          userId: to,
          action: 'DST_MINT',
          reference: result.hash,
          details: JSON.stringify({ amount: parseFloat(amount), reservesProof, status: 'COMPLETED' })
        }
      });

      this.logger.info('DST tokens minted', { to, amount, txHash: result.hash });
      return result.hash;
    } catch (error) {
      this.logger.error('Failed to mint DST tokens', { error, to, amount });
      throw error;
    }
  }

  /**
   * Burn DST tokens
   */
  async burnTokens(
    adminKeypair: Keypair,
    from: string,
    amount: string
  ): Promise<string> {
    try {
      const account = await this.server.getAccount(adminKeypair.publicKey());
      const contract = new Contract(this.contractId);

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call(
          'burn',
          nativeToScVal(from, { type: 'address' }),
          nativeToScVal(BigInt(amount), { type: 'u64' })
        ))
        .setTimeout(30)
        .build();

      tx.sign(adminKeypair);
      const result = await this.server.sendTransaction(tx);

      // Log burning event in audit log
      await prisma.auditLog.create({
        data: {
          userId: from,
          action: 'DST_BURN',
          reference: result.hash,
          details: JSON.stringify({ amount: parseFloat(amount), status: 'COMPLETED' })
        }
      });

      this.logger.info('DST tokens burned', { from, amount, txHash: result.hash });
      return result.hash;
    } catch (error) {
      this.logger.error('Failed to burn DST tokens', { error, from, amount });
      throw error;
    }
  }

  /**
   * Transfer DST tokens
   */
  async transferTokens(
    fromKeypair: Keypair,
    to: string,
    amount: string
  ): Promise<string> {
    try {
      const account = await this.server.getAccount(fromKeypair.publicKey());
      const contract = new Contract(this.contractId);

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call(
          'transfer',
          nativeToScVal(fromKeypair.publicKey(), { type: 'address' }),
          nativeToScVal(to, { type: 'address' }),
          nativeToScVal(BigInt(amount), { type: 'u64' })
        ))
        .setTimeout(30)
        .build();

      tx.sign(fromKeypair);
      const result = await this.server.sendTransaction(tx);

      this.logger.info('DST tokens transferred', { from: fromKeypair.publicKey(), to, amount, txHash: result.hash });
      return result.hash;
    } catch (error) {
      this.logger.error('Failed to transfer DST tokens', { error, from: fromKeypair.publicKey(), to, amount });
      throw error;
    }
  }

  /**
   * Freeze/unfreeze user account
   */
  async setFreezeStatus(
    adminKeypair: Keypair,
    user: string,
    frozen: boolean
  ): Promise<string> {
    try {
      const account = await this.server.getAccount(adminKeypair.publicKey());
      const contract = new Contract(this.contractId);

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call(
          'set_freeze',
          nativeToScVal(user, { type: 'address' }),
          nativeToScVal(frozen, { type: 'bool' })
        ))
        .setTimeout(30)
        .build();

      tx.sign(adminKeypair);
      const result = await this.server.sendTransaction(tx);

      this.logger.info('User freeze status updated', { user, frozen, txHash: result.hash });
      return result.hash;
    } catch (error) {
      this.logger.error('Failed to update freeze status', { error, user, frozen });
      throw error;
    }
  }

  /**
   * Set user role
   */
  async setUserRole(
    adminKeypair: Keypair,
    user: string,
    role: UserRole
  ): Promise<string> {
    try {
      const account = await this.server.getAccount(adminKeypair.publicKey());
      const contract = new Contract(this.contractId);

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call(
          'set_role',
          nativeToScVal(user, { type: 'address' }),
          nativeToScVal(role, { type: 'symbol' })
        ))
        .setTimeout(30)
        .build();

      tx.sign(adminKeypair);
      const result = await this.server.sendTransaction(tx);

      this.logger.info('User role updated', { user, role, txHash: result.hash });
      return result.hash;
    } catch (error) {
      this.logger.error('Failed to set user role', { error, user, role });
      throw error;
    }
  }

  /**
   * Get token balance
   */
  async getBalance(user: string): Promise<string> {
    try {
      const contract = new Contract(this.contractId);
      const account = await this.server.getAccount(user);

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call('balance', nativeToScVal(user, { type: 'address' })))
        .setTimeout(30)
        .build();

      const result = await this.server.simulateTransaction(tx);
      const balance = scValToNative((result as any).result?.retval as xdr.ScVal);

      return balance.toString();
    } catch (error) {
      this.logger.error('Failed to get balance', { error, user });
      throw error;
    }
  }

  /**
   * Get total supply
   */
  async getTotalSupply(): Promise<string> {
    try {
      const contract = new Contract(this.contractId);
      const account = await this.server.getAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'); // System account

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call('total_supply'))
        .setTimeout(30)
        .build();

      const result = await this.server.simulateTransaction(tx);
      const supply = scValToNative((result as any).results[0].retval as xdr.ScVal);

      return supply.toString();
    } catch (error) {
      this.logger.error('Failed to get total supply', { error });
      throw error;
    }
  }

  /**
   * Anchor proof of reserves
   */
  async anchorReservesProof(
    adminKeypair: Keypair,
    proofHash: string,
    totalSilverGrams: string
  ): Promise<string> {
    try {
      const account = await this.server.getAccount(adminKeypair.publicKey());
      const contract = new Contract(this.contractId);

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call(
          'anchor_reserves',
          nativeToScVal(proofHash, { type: 'string' }),
          nativeToScVal(BigInt(totalSilverGrams), { type: 'u64' })
        ))
        .setTimeout(30)
        .build();

      tx.sign(adminKeypair);
      const result = await this.server.sendTransaction(tx);

      this.logger.info('Reserves proof anchored', { proofHash, totalSilverGrams, txHash: result.hash });
      return result.hash;
    } catch (error) {
      this.logger.error('Failed to anchor reserves proof', { error, proofHash, totalSilverGrams });
      throw error;
    }
  }

  /**
   * Get reserves proof
   */
  async getReservesProof(): Promise<{ proofHash: string; totalSilverGrams: string; timestamp: number }> {
    try {
      const contract = new Contract(this.contractId);
      const account = await this.server.getAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call('get_reserves_proof'))
        .setTimeout(30)
        .build();

      const result = await this.server.simulateTransaction(tx);
      const reservesData = scValToNative((result as any).result?.retval as xdr.ScVal);

      return {
        proofHash: reservesData.proof_hash,
        totalSilverGrams: reservesData.total_silver_grams.toString(),
        timestamp: reservesData.timestamp
      };
    } catch (error) {
      this.logger.error('Failed to get reserves proof', { error });
      throw error;
    }
  }

  /**
   * Repay loan
   */
  async repayLoan(
    userKeypair: Keypair,
    loanId: string,
    amount: string
  ): Promise<string> {
    try {
      const account = await this.server.getAccount(userKeypair.publicKey());
      const contract = new Contract(this.loanContractId);

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call(
          'repay_loan',
          nativeToScVal(BigInt(loanId), { type: 'u64' }),
          nativeToScVal(BigInt(amount), { type: 'u64' })
        ))
        .setTimeout(30)
        .build();

      tx.sign(userKeypair);
      const result = await this.server.sendTransaction(tx);

      this.logger.info('Loan repaid', { loanId, amount, txHash: result.hash });
      return result.hash;
    } catch (error) {
      this.logger.error('Failed to repay loan', { error, loanId, amount });
      throw error;
    }
  }

  /**
   * Deploy a Soroban contract
   */
  async deployContract(
    wasmPath: string,
    adminKeypair: Keypair,
    salt?: Buffer
  ): Promise<string> {
    try {
      this.logger.info('Deploying Soroban contract', { wasmPath });

      // Read WASM file
      const wasmBuffer = require('fs').readFileSync(wasmPath);

      // Get account
      const account = await this.server.getAccount(adminKeypair.publicKey());

      // Use provided salt or generate random one
      const contractSalt = salt || Buffer.from(Math.random().toString(36).substring(2, 15), 'utf8');

      // Create deployment transaction
      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(
          Operation.invokeHostFunction({
            func: xdr.HostFunction.hostFunctionTypeCreateContract(
              new xdr.CreateContractArgs({
                executable: xdr.ContractExecutable.contractExecutableWasm(wasmBuffer),
                contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
                  new xdr.ContractIdPreimageFromAddress({
                    address: xdr.ScAddress.scAddressTypeAccount(adminKeypair.publicKey() as any),
                    salt: contractSalt
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
      const result = await this.server.sendTransaction(tx);

      // Wait for confirmation
      let status = await this.server.getTransaction(result.hash);
      while ((status as any).status === 'pending') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        status = await this.server.getTransaction(result.hash);
      }

      if ((status as any).status !== 'success') {
        throw new Error(`Transaction failed: ${(status as any).status}`);
      }

      // Extract contract ID from transaction result
      const contractId = (status as any).returnValue?.toString('hex');
      if (!contractId) {
        throw new Error('Contract ID not found in transaction result');
      }

      this.logger.info('Contract deployed successfully', { contractId, txHash: result.hash });
      return contractId;

    } catch (error) {
      this.logger.error('Failed to deploy contract', { error, wasmPath });
      throw error;
    }
  }
}

export const sorobanService = new SorobanService();
