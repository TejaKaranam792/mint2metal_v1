import * as FreighterApi from '@stellar/freighter-api';
import { getCurrentKYCStatus } from './api';

export const connectWallet = async (): Promise<{ publicKey: string; network: string }> => {
  // Check KYC status before allowing wallet connection
  try {
    const kycRes = await getCurrentKYCStatus();
    if (kycRes.status !== 'VERIFIED') {
      throw new Error('KYC verification required before connecting wallet');
    }
  } catch (error) {
    throw new Error('KYC verification required before connecting wallet');
  }

  const connected = await FreighterApi.isConnected();
  if (!connected) {
    throw new Error('Freighter wallet is not connected');
  }

  await FreighterApi.requestAccess();
  const publicKeyResult = await FreighterApi.getAddress();
  const networkDetails = await FreighterApi.getNetworkDetails();

  return { publicKey: publicKeyResult.address, network: networkDetails.network };
};
