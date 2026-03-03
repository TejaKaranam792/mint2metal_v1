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
    try {
      const tx = TransactionBuilder.fromXDR(
        signedXDR,
        Networks.TESTNET
      ) as Transaction;

      const result = await this.server.submitTransaction(tx);
      return { hash: result.hash, successful: result.successful };
    } catch (error: any) {
      if (error.response?.data?.extras?.result_codes) {
        const codes = error.response.data.extras.result_codes;
        throw new Error(`Stellar Tx Failed: tx=${codes.transaction}, op=${codes.operations?.join(',')}`);
      }
      throw error;
    }
  }

  getExplorerUrl(hash: string): string {
    return `https://stellar.expert/explorer/testnet/tx/${hash}`;
  }
}

export const stellarService = new StellarService();