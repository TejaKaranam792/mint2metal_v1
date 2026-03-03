import * as FreighterApi from '@stellar/freighter-api';
import { getCurrentKYCStatus } from './api';

export const connectWallet = async (): Promise<{ publicKey: string; network: string }> => {
  // Check KYC status before allowing wallet connection
  try {
    const kycRes = await getCurrentKYCStatus();
    // Backend returns { success, status: { status: "VERIFIED", message } }
    const kycStatus = typeof kycRes?.status === 'string'
      ? kycRes.status
      : kycRes?.status?.status;
    if (kycStatus !== 'VERIFIED') {
      throw new Error('KYC verification required before connecting wallet');
    }
  } catch (error: any) {
    if (error.message === 'KYC verification required before connecting wallet') {
      throw error;
    }
    throw new Error('KYC verification required before connecting wallet');
  }

  const connected = await FreighterApi.isConnected();
  if (!connected) {
    throw new Error('Freighter wallet is not connected');
  }

  await FreighterApi.requestAccess();
  const pubKeyResult = await FreighterApi.getAddress();
  const address = typeof pubKeyResult === 'object' && pubKeyResult !== null
    ? (pubKeyResult as { address: string }).address
    : pubKeyResult as unknown as string;

  const netDetails = await FreighterApi.getNetworkDetails();
  const network = typeof netDetails === 'object' && netDetails !== null && 'network' in netDetails
    ? (netDetails as { network: string }).network
    : netDetails as unknown as string;

  return { publicKey: address, network };
};
