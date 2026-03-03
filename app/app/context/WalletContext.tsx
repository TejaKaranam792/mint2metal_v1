'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
      // Dynamic import to avoid SSR issues
      const FreighterApi = await import('@stellar/freighter-api');

      // Freighter API v3 returns objects, not raw primitives
      const connectedResult = await FreighterApi.isConnected();
      const isConnected = typeof connectedResult === 'object'
        ? (connectedResult as { isConnected: boolean }).isConnected
        : connectedResult;

      if (!isConnected) {
        alert('Freighter wallet is not installed. Please install the Freighter browser extension from https://www.freighter.app and reload the page.');
        return;
      }

      await FreighterApi.requestAccess();

      const pubKeyResult = await FreighterApi.getAddress();
      // Handle both v2 (raw string) and v3 (object) return types
      const address = typeof pubKeyResult === 'object'
        ? (pubKeyResult as { address: string }).address
        : pubKeyResult as string;

      const netDetails = await FreighterApi.getNetworkDetails();
      // Handle both v2 (raw string) and v3 (object) return types
      const network = typeof netDetails === 'object' && 'network' in netDetails
        ? (netDetails as { network: string }).network
        : netDetails as string;

      if (network !== 'TESTNET') {
        alert('Please switch Freighter to Stellar Testnet and try again.');
        return;
      }

      // Connect wallet in backend
      const { connectExternalWallet } = await import('@/lib/api');
      await connectExternalWallet(address, network);

      setPublicKey(address);
      setNetwork(network);
    } catch (error: unknown) {
      console.error('Failed to connect wallet:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('user declined') || message.toLowerCase().includes('rejected')) {
        alert('Connection cancelled. Please approve the connection request in Freighter.');
      } else if (message.toLowerCase().includes('already linked')) {
        alert(message); // Show the specific backend error as-is
      } else {
        alert(`Failed to connect wallet: ${message}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const checkConnection = async () => {
      try {
        const FreighterApi = await import('@stellar/freighter-api');
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
        // Freighter extension not installed — this is fine, button will still show
        console.log('Freighter not detected:', error);
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
