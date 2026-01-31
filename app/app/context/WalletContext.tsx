'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as FreighterApi from '@stellar/freighter-api';

interface WalletContextType {
  publicKey: string | null;
  network: string | null;
  connect: () => Promise<void>;
  isConnecting: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = async () => {
    setIsConnecting(true);
    try {
      const connected = await FreighterApi.isConnected();
      if (!connected) {
        throw new Error('Freighter wallet is not connected');
      }

      await FreighterApi.requestAccess();
      const pubKeyResult = await FreighterApi.getAddress();
      const netDetails = await FreighterApi.getNetworkDetails();

      if (netDetails.network !== 'TESTNET') {
        alert('Please switch Freighter to Stellar Testnet.');
        return;
      }

      // Connect wallet in backend
      const { connectExternalWallet } = await import('@/lib/api');
      await connectExternalWallet(pubKeyResult.address, netDetails.network);

      setPublicKey(pubKeyResult.address);
      setNetwork(netDetails.network);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet. Please ensure Freighter is installed and unlocked.');
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    // Check if already connected on mount
    const checkConnection = async () => {
      try {
        const connected = await FreighterApi.isConnected();
        if (connected) {
          const pubKeyResult = await FreighterApi.getAddress();
          const netDetails = await FreighterApi.getNetworkDetails();
          if (netDetails.network === 'TESTNET') {
            setPublicKey(pubKeyResult.address);
            setNetwork(netDetails.network);
          }
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    };
    checkConnection();
  }, []);

  return (
    <WalletContext.Provider value={{ publicKey, network, connect, isConnecting }}>
      {children}
    </WalletContext.Provider>
  );
};
