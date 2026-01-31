'use client';

import React from 'react';
import { useWallet } from '@/context/WalletContext';

const ConnectWallet: React.FC = () => {
  const { publicKey, connect, isConnecting } = useWallet();

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  if (publicKey) {
    return <span className="text-white">{shortenAddress(publicKey)}</span>;
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
    >
      {isConnecting ? 'Connecting...' : 'Connect Freighter Wallet'}
    </button>
  );
};

export default ConnectWallet;
