import {
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Memo,
  Operation,
  Transaction,
  xdr,
  Horizon, // Correct way to import Server in modern stellar-sdk
} from '@stellar/stellar-sdk';
import { rpc, Contract } from '@stellar/stellar-sdk';

import * as FreighterApi from '@stellar/freighter-api';

export class StellarService {
  private server: Horizon.Server;

  constructor() {
    this.server = new Horizon.Server('https://horizon-testnet.stellar.org');
  }

  getServer() {
    return this.server;
  }

  async buildTransaction(
    publicKey: string,
    operations: xdr.Operation[]
  ): Promise<Transaction> {
    const account = await this.server.loadAccount(publicKey);

    // Casting operations[0] as any if TypeScript struggles with XDR type mismatches
    return new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addMemo(Memo.text('Mint2Metal Test'))
      .addOperation(operations[0] as any) 
      .setTimeout(30)
      .build();
  }

  async signWithFreighter(transaction: Transaction): Promise<string> {
    const xdrString = transaction.toXDR();

    const result = await FreighterApi.signTransaction(xdrString, {
      networkPassphrase: Networks.TESTNET,
    });

    return result.signedTxXdr;
  }

  async submitTransaction(
    signedXDR: string
  ): Promise<{ hash: string; successful: boolean }> {
    // When using fromXDR, modern SDKs return a Transaction or FeeBumpTransaction
    const tx = TransactionBuilder.fromXDR(
      signedXDR,
      Networks.TESTNET
    ) as Transaction;

    const result = await this.server.submitTransaction(tx);

    return {
      hash: result.hash,
      successful: result.successful,
    };
  }

  async performTestTransaction(publicKey: string) {
    const operation = Operation.manageData({
      name: 'Mint2Metal_Test',
      value: `Test data: ${Date.now()}`,
    });

    // Operation.manageData returns a valid Operation object
    const tx = await this.buildTransaction(publicKey, [operation as any]);
    const signedXDR = await this.signWithFreighter(tx);
    return this.submitTransaction(signedXDR);
  }

  getExplorerUrl(hash: string): string {
    return `https://stellar.expert/explorer/testnet/tx/${hash}`;
  }

  // Soroban read call (placeholder for when contracts are deployed)
  async performSorobanReadCall(contractId?: string): Promise<any> {
    if (!contractId || contractId === 'PLACEHOLDER_CONTRACT_ID') {
      return { status: 'awaiting_deployment', message: 'Contract not yet deployed' };
    }

    try {
      const server = new rpc.Server('https://soroban-testnet.stellar.org');
      const contract = new Contract(contractId);

      // This is a placeholder - actual implementation would depend on contract methods
      // For now, just return a mock response
      return {
        status: 'success',
        data: 'Placeholder Soroban read result',
        contractId
      };
    } catch (error) {
      console.error('Soroban read call failed:', error);
      return { status: 'error', message: 'Failed to read from contract' };
    }
  }
}

export const stellarService = new StellarService();