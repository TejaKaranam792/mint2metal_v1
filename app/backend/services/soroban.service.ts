import { Keypair, TransactionBuilder, Networks, Contract, rpc, xdr, nativeToScVal, scValToNative, Operation, StrKey, Address } from '@stellar/stellar-sdk';
import * as winston from 'winston';

export enum UserRole {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  USER = 'USER'
}

export class SorobanService {
  private server: rpc.Server;
  private networkPassphrase: string;
  private contractId: string;
  private loanContractId: string;
  private logger: winston.Logger;

  constructor() {
    this.server = new rpc.Server(process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org');
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
   * Helper to convert float strings to BigInt with 7 decimals (Stellar standard)
   */
  public toStroops(amount: string): bigint {
    const [whole, fraction = ''] = amount.split('.');
    const paddedFraction = fraction.padEnd(7, '0').slice(0, 7);
    return BigInt((whole === '0' || whole === '' ? '' : whole) + paddedFraction);
  }

  /**
   * Helper to convert BigInt stroops back to float string
   */
  public fromStroops(stroops: bigint): string {
    const s = stroops.toString().padStart(8, '0');
    const whole = s.slice(0, -7) || '0';
    const fraction = s.slice(-7).replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole;
  }

  /**
   * Helper to submit transaction and wait for success (Soroban async execution)
   */
  private async submitAndWait(tx: any, keypair: Keypair): Promise<string> {
    const adminPubKey = keypair.publicKey();
    this.logger.info('Preparing to sign and submit transaction', {
      publicKey: adminPubKey,
      network: this.networkPassphrase.slice(0, 15) + '...'
    });

    // CRITICAL: Soroban transactions MUST be prepared (simulated) to 
    // include resource footprint, CPU, RAM and fees.
    try {
      tx = await this.server.prepareTransaction(tx);
    } catch (prepError: any) {
      this.logger.error('Failed to prepare (simulate) transaction', {
        error: prepError.message || prepError,
        detail: prepError.response?.data?.error || 'No additional detail'
      });
      throw new Error(`Transaction simulation failed: ${prepError.message || 'Check logs'}`);
    }

    tx.sign(keypair);
    const result = await this.server.sendTransaction(tx);
    const hash = result.hash;

    this.logger.info('Transaction sendTransaction response', {
      hash,
      status: result.status,
      errorResult: (result as any).errorResultXdr || (result as any).errorResult
    });

    if (result.status === 'ERROR') {
      const errorDetail = (result as any).errorResultXdr || (result as any).errorResult || 'Unknown error';
      throw new Error(`Transaction submission failed (ERROR): ${hash}. Result: ${errorDetail}`);
    }

    // Wait for confirmation with timeout (120s)
    const startTime = Date.now();
    const timeout = 120000;

    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Transaction timed out after 120s: ${hash}. Check on Stellar Expert manually.`);
      }

      const statusResponse = await this.server.getTransaction(hash);
      const status = (statusResponse as any).status;

      this.logger.info('Polling transaction status', { hash, status });

      if (status === 'SUCCESS') {
        return hash;
      }

      if (status === 'FAILED') {
        const errorResult = (statusResponse as any).resultXdr || (statusResponse as any).resultMetaXdr;
        throw new Error(`Transaction failed on-chain: ${hash}. Result: ${errorResult}`);
      }

      if (status !== 'NOT_FOUND' && status !== 'pending' && status !== 'PENDING') {
        throw new Error(`Transaction ended with unexpected status: ${status}. Hash: ${hash}`);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  /**
   * Initialize the DST token contract
   */
  async initializeContract(adminKeypair: Keypair, treasuryPublicKey: string): Promise<string> {
    try {
      const account = await this.server.getAccount(adminKeypair.publicKey());
      const contract = new Contract(this.contractId);

      // Initialize contract with admin role
      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call('initialize',
          nativeToScVal(adminKeypair.publicKey(), { type: 'address' }),
          nativeToScVal(treasuryPublicKey, { type: 'address' })
        ))
        .setTimeout(30)
        .build();

      const txHash = await this.submitAndWait(tx, adminKeypair);

      this.logger.info('DST Contract initialized', { txHash });
      return txHash;
    } catch (error) {
      this.logger.error('Failed to initialize DST contract', { error });
      throw error;
    }
  }

  /**
   * Mint DST tokens to the designated Treasury Buffer
   */
  async mintTokens(
    adminKeypair: Keypair,
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
          nativeToScVal(this.toStroops(amount), { type: 'u64' }),
          nativeToScVal(reservesProof, { type: 'string' })
        ))
        .setTimeout(60)
        .build();

      const txHash = await this.submitAndWait(tx, adminKeypair);

      this.logger.info('DST tokens minted to treasury', { amount, txHash });
      return txHash;
    } catch (error: any) {
      this.logger.error('Failed to mint DST tokens to treasury', {
        error: error.message || error,
        stack: error.stack,
        detail: error.response?.data || error.response || 'No additional detail',
        amount
      });
      throw error;
    }
  }

  /**
   * Submit a custody vault receipt to the contract
   */
  async submitCustodyReceipt(
    verifierKeypair: Keypair,
    receiptId: string,
    vaultId: string,
    assetClass: string,
    amountGrams: string,
    custodyHash: string
  ): Promise<string> {
    try {
      const account = await this.server.getAccount(verifierKeypair.publicKey());
      const contract = new Contract(this.contractId);

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call(
          'submit_raw_receipt',
          nativeToScVal(verifierKeypair.publicKey(), { type: 'address' }),
          nativeToScVal(receiptId, { type: 'string' }),
          nativeToScVal(vaultId, { type: 'string' }),
          nativeToScVal(assetClass, { type: 'symbol' }),
          nativeToScVal(this.toStroops(amountGrams), { type: 'u64' }),
          nativeToScVal(custodyHash, { type: 'string' })
        ))
        .setTimeout(60)
        .build();

      const txHash = await this.submitAndWait(tx, verifierKeypair);

      this.logger.info('Custody receipt submitted', { receiptId, txHash });
      return txHash;
    } catch (error: any) {
      this.logger.error('Failed to submit custody receipt', {
        error: error.message || error,
        receiptId
      });
      throw error;
    }
  }

  /**
   * Mint natively wrapped tokens using a validated custody proof
   */
  async mintWithCustody(
    executorKeypair: Keypair,
    receiptId: string,
    toAddress: string
  ): Promise<string> {
    try {
      const account = await this.server.getAccount(executorKeypair.publicKey());
      const contract = new Contract(this.contractId);

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call(
          'mint_with_custody',
          nativeToScVal(executorKeypair.publicKey(), { type: 'address' }),
          nativeToScVal(receiptId, { type: 'string' }),
          nativeToScVal(toAddress, { type: 'address' })
        ))
        .setTimeout(60)
        .build();

      const txHash = await this.submitAndWait(tx, executorKeypair);

      this.logger.info('Custody-confirmed ABI mint successful', { receiptId, toAddress, txHash });
      return txHash;
    } catch (error: any) {
      this.logger.error('Failed to mint with custody proof', {
        error: error.message || error,
        receiptId
      });
      throw error;
    }
  }

  /**
   * Burn DST tokens (Native Stellar Asset).
   *
   * Handles two cases:
   *  1. Direct trustline balance → Operation.clawback
   *  2. Claimable Balances for the user → Operation.clawbackClaimableBalance
   *
   * Both operations require the admin keypair to be the asset issuer with
   * AUTH_CLAWBACK_ENABLED set on the asset.
   */
  async burnTokens(
    adminKeypair: Keypair,
    from: string,
    amount: string,
    assetCode: string = 'XAG'
  ): Promise<string> {
    const stellarSdk = require('@stellar/stellar-sdk');
    const horizon = new stellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
    const asset = new stellarSdk.Asset(assetCode, adminKeypair.publicKey());
    const targetAmount = parseFloat(amount);

    try {
      // ── 1. Gather direct trustline balance ────────────────────────────────
      let directBalance = 0;
      try {
        const userAccount = await horizon.loadAccount(from);
        const balObj = userAccount.balances.find(
          (b: any) => b.asset_type !== 'native' && b.asset_code === assetCode && b.asset_issuer === adminKeypair.publicKey()
        );
        if (balObj) directBalance = parseFloat(balObj.balance);
      } catch (e: any) {
        if (e?.response?.status !== 404) throw e;
      }

      // ── 2. Gather Claimable Balances claimable by this user ───────────────
      let claimableBalances: Array<{ id: string; amount: number; hasClawback: boolean }> = [];
      try {
        const cbResponse = await horizon.claimableBalances()
          .claimant(from)
          .asset(asset)
          .limit(200)
          .call();

        claimableBalances = cbResponse.records
          .filter((cb: any) => cb.flags?.clawback_enabled === true)
          .map((cb: any) => ({
            id: cb.id,
            amount: parseFloat(cb.amount),
            hasClawback: cb.flags?.clawback_enabled === true
          }));

        if (cbResponse.records.length > 0 && claimableBalances.length === 0) {
          this.logger.warn('User has claimable balances, but none have clawback enabled. They cannot be burned.', { from });
        }
      } catch (e: any) {
        this.logger.warn('Failed to fetch claimable balances for burn', { error: e.message, from });
      }

      const totalAvailable = directBalance + claimableBalances.reduce((s, cb) => s + cb.amount, 0);

      if (totalAvailable < targetAmount) {
        throw new Error(
          `Insufficient balance to burn ${amount} ${assetCode}. ` +
          `Available: ${totalAvailable.toFixed(7)} (trustline: ${directBalance.toFixed(7)}, ` +
          `claimable: ${claimableBalances.reduce((s, cb) => s + cb.amount, 0).toFixed(7)})`
        );
      }

      // ── 3. Build operations list (clawback from trustline first, then CBs) ─
      const ops: any[] = [];
      let remaining = targetAmount;

      if (directBalance > 0 && remaining > 0) {
        const clawAmt = Math.min(directBalance, remaining);
        ops.push(Operation.clawback({
          asset,
          amount: clawAmt.toFixed(7),
          from,
        }));
        remaining = parseFloat((remaining - clawAmt).toFixed(7));
      }

      for (const cb of claimableBalances) {
        if (remaining <= 0) break;
        // We must clawback the FULL claimable balance (partial not supported)
        ops.push(
          stellarSdk.Operation.clawbackClaimableBalance({ balanceId: cb.id })
        );
        remaining = parseFloat((remaining - cb.amount).toFixed(7));
      }

      if (ops.length === 0) {
        throw new Error(`No operations generated for burn of ${amount} ${assetCode} from ${from}`);
      }

      // ── 4. Submit (Stellar allows up to 100 ops per tx) ───────────────────
      const MAX_OPS_PER_TX = 100;
      let lastTxHash = '';

      for (let i = 0; i < ops.length; i += MAX_OPS_PER_TX) {
        const batch = ops.slice(i, i + MAX_OPS_PER_TX);
        const account = await horizon.loadAccount(adminKeypair.publicKey());
        const txBuilder = new TransactionBuilder(account, {
          fee: '100000',
          networkPassphrase: this.networkPassphrase,
        }).setTimeout(60);

        for (const op of batch) txBuilder.addOperation(op);
        const tx = txBuilder.build();
        tx.sign(adminKeypair);

        const submitResponse = await horizon.submitTransaction(tx);
        lastTxHash = submitResponse.hash;
        this.logger.info('Burn batch submitted', { batchIndex: i / MAX_OPS_PER_TX, txHash: lastTxHash });
      }

      this.logger.info('Tokens burned successfully', {
        from,
        amount,
        directBalance,
        claimableCount: claimableBalances.length,
        txHash: lastTxHash,
      });
      return lastTxHash;
    } catch (error) {
      this.logger.error('Failed to clawback DST tokens', { error, from, amount });
      throw error;
    }
  }

  /**
   * Transfer DST tokens (Native Stellar Asset Payment)
   */
  async transferTokens(
    fromKeypair: Keypair,
    to: string,
    amount: string,
    assetCode: string = 'XAG',
    issuer?: string
  ): Promise<string> {
    try {
      const stellarSdk = require('@stellar/stellar-sdk');

      // Default issuer: Prefer ADMIN_SECRET's public key (the actual issuer)
      if (!issuer) {
        try {
          const adminKeypair = stellarSdk.Keypair.fromSecret(process.env.STELLAR_ADMIN_SECRET!);
          issuer = adminKeypair.publicKey();
        } catch (e) {
          issuer = process.env.TREASURY_PUBLIC_KEY;
        }
      }

      if (!issuer) {
        throw new Error("No issuer (Asset Manager) identified for transfer. Set STELLAR_ADMIN_SECRET or TREASURY_PUBLIC_KEY.");
      }

      const horizon = new stellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
      const account = await horizon.loadAccount(fromKeypair.publicKey());
      const asset = new stellarSdk.Asset(assetCode, issuer);

      // Check if destination has trustline
      let hasTrustline = false;
      try {
        const destAccount = await horizon.loadAccount(to);
        hasTrustline = destAccount.balances.some(
          (b: any) => b.asset_code === assetCode && b.asset_issuer === issuer
        );
      } catch (e) {
        // Destination might not exist yet, so definitely no trustline
      }

      let operation;
      if (hasTrustline) {
        operation = stellarSdk.Operation.payment({
          destination: to,
          asset: asset,
          amount: amount
        });
      } else {
        operation = stellarSdk.Operation.createClaimableBalance({
          asset: asset,
          amount: amount,
          claimants: [
            new stellarSdk.Claimant(to, stellarSdk.Claimant.predicateUnconditional())
          ]
        });
      }

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(operation)
        .setTimeout(60)
        .build();

      tx.sign(fromKeypair);
      const submitResponse = await horizon.submitTransaction(tx);
      const txHash = submitResponse.hash;

      this.logger.info(`Tokens transferred (${hasTrustline ? 'Payment' : 'ClaimableBalance'})`, { from: fromKeypair.publicKey(), to, amount, txHash });
      return txHash;
    } catch (error: any) {
      this.logger.error('Failed to transfer tokens', {
        error: error.message,
        detail: error.response?.data || error.response || 'No additional detail',
        from: fromKeypair.publicKey(),
        to,
        amount
      });
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
        .setTimeout(60)
        .build();

      const txHash = await this.submitAndWait(tx, adminKeypair);

      this.logger.info('User freeze status updated', { user, frozen, txHash });
      return txHash;
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

      const txHash = await this.submitAndWait(tx, adminKeypair);

      this.logger.info('User role updated', { user, role, txHash });
      return txHash;
    } catch (error) {
      this.logger.error('Failed to set user role', { error, user, role });
      throw error;
    }
  }

  /**
   * Register a new asset class natively wrapping a SAC token
   */
  async registerAssetClass(
    adminKeypair: Keypair,
    symbol: string,
    tokenAddress: string,
    unitWeight: string,
    purity: string,
    vaultId: string,
    oracleSource: string,
    issuerId: string
  ): Promise<string> {
    try {
      const account = await this.server.getAccount(adminKeypair.publicKey());
      const contract = new Contract(this.contractId);

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call(
          'register_asset_class',
          nativeToScVal(symbol, { type: 'symbol' }),
          nativeToScVal(tokenAddress, { type: 'address' }),
          nativeToScVal(BigInt(unitWeight), { type: 'u64' }),
          nativeToScVal(BigInt(purity), { type: 'u64' }),
          nativeToScVal(vaultId, { type: 'string' }),
          nativeToScVal(oracleSource, { type: 'string' }),
          nativeToScVal(issuerId, { type: 'string' })
        ))
        .setTimeout(60)
        .build();

      const txHash = await this.submitAndWait(tx, adminKeypair);

      this.logger.info('Asset class registered', { symbol, txHash });
      return txHash;
    } catch (error) {
      this.logger.error('Failed to register asset class', { error, symbol });
      throw error;
    }
  }

  async getBalance(
    user: string,
    assetCode: string = 'XAG',
    issuer?: string
  ): Promise<string> {
    try {
      const stellarSdk = require('@stellar/stellar-sdk');
      if (!issuer) {
        try {
          const adminKeypair = stellarSdk.Keypair.fromSecret(process.env.STELLAR_ADMIN_SECRET!);
          issuer = adminKeypair.publicKey();
        } catch (e) {
          issuer = process.env.TREASURY_PUBLIC_KEY || 'GAQSTTMR5P4YBJ3ZVE3HQ46QA2RED3VSNHGVLF5PHBDVOXW5Z5SSPPG2';
        }
      }
      let account;
      const horizon = new stellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
      try {
        account = await horizon.loadAccount(user);
      } catch (err: any) {
        if (err?.response?.status === 404) return '0';
        throw err;
      }

      // 1. Get standard balance from trustline - Filter by Asset Code AND Issuer
      const balanceObj = account.balances.find((b: any) =>
        b.asset_type !== 'native' &&
        b.asset_code === assetCode &&
        b.asset_issuer === issuer
      );
      let standardBalance = balanceObj ? parseFloat(balanceObj.balance) : 0;

      // Temporary Fallback: If primary issuer balance is 0, check for ANY XAG trustlines
      // This solves the immediate problem of users seeing 0 while holding Treasury-issued tokens.
      if (standardBalance === 0) {
        const otherXagBalances = account.balances
          .filter((b: any) => b.asset_type !== 'native' && b.asset_code === assetCode && b.asset_issuer !== issuer)
          .reduce((sum: number, b: any) => sum + parseFloat(b.balance), 0);

        if (otherXagBalances > 0) {
          this.logger.warn('Issuer mismatch fallback hit: Displaying total of all XAG trustlines', {
            user,
            primaryIssuer: issuer,
            otherXagTotal: otherXagBalances
          });
          standardBalance = otherXagBalances;
        }
      }

      // 2. Look up pending Claimable Balances intended for this user
      let claimableTotal = 0;
      try {
        const assetObj = new stellarSdk.Asset(assetCode, issuer);
        const cbResponse = await horizon.claimableBalances()
          .claimant(user)
          .asset(assetObj)
          .limit(200)
          .call();

        claimableTotal = cbResponse.records.reduce((sum: number, cb: any) => sum + parseFloat(cb.amount), 0);
      } catch (e: any) {
        this.logger.warn('Failed to fetch claimable balances', { error: e.message, user });
      }

      const totalBalance = standardBalance + claimableTotal;
      return totalBalance.toString();
    } catch (error) {
      this.logger.error('Failed to get Native SAC balance', { error, user, assetCode });
      throw error;
    }
  }



  /**
   * Get total supply
   */
  async getTotalSupply(assetCode: string = 'XAG', issuer: string = process.env.TREASURY_PUBLIC_KEY || ''): Promise<string> {
    try {
      // Real Native Asset context queries Horizon `/assets?asset_code=XAG&asset_issuer=...`
      const horizon = new (require('@stellar/stellar-sdk').Horizon.Server)('https://horizon-testnet.stellar.org');
      const response = await horizon.assets().forCode(assetCode).forIssuer(issuer).call();

      if (response.records && response.records.length > 0) {
        return response.records[0].amount;
      }
      return "0";
    } catch (error) {
      this.logger.error('Failed to get total supply via Horizon', { error });
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

      const txHash = await this.submitAndWait(tx, adminKeypair);

      this.logger.info('Reserves proof anchored', { proofHash, totalSilverGrams, txHash });
      return txHash;
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

      const txHash = await this.submitAndWait(tx, userKeypair);

      this.logger.info('Loan repaid', { loanId, amount, txHash });
      return txHash;
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
