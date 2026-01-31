import {
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Memo,
  Operation,
} from '@stellar/stellar-sdk';
import Server from '@stellar/stellar-sdk';

/**
 * SERVER-ONLY helper
 * Builds a dummy transaction XDR (unsigned)
 */
export const signDummyTx = async (publicKey: string): Promise<string> => {
  const server = new Server('https://horizon-testnet.stellar.org');

  const account = await server.loadAccount(publicKey);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addMemo(Memo.text('Mint2Metal Dummy'))
    .addOperation(
      Operation.manageData({
        name: 'dummy',
        value: 'test',
      })
    )
    .setTimeout(30)
    .build();

  // ⚠️ DO NOT sign here — Freighter signs in client
  return tx.toXDR();
};
