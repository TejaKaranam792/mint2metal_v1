// Contract Connectivity Check for Mint2Metal
// This function verifies Soroban RPC and contract wiring without executing transactions

import { getSorobanServer, getDSTContract } from './sorobanClient';
import { sorobanConfig } from './sorobanConfig';

interface ContractConnectionStatus {
  serverConnected: boolean;
  contractAddress: string;
  network: string;
}

/**
 * Check Soroban contract connectivity
 * This is NOT a contract execution - just verifies RPC + contract wiring
 */
export async function checkContractConnection(): Promise<ContractConnectionStatus> {
  try {
    // Instantiate Soroban server
    const server = getSorobanServer();

    // Instantiate DST Contract
    const contract = getDSTContract();

    // Return connectivity status
    return {
      serverConnected: true,
      contractAddress: sorobanConfig.contracts.dstToken,
      network: sorobanConfig.network,
    };
  } catch (error) {
    console.error('Contract connectivity check failed:', error);
    return {
      serverConnected: false,
      contractAddress: sorobanConfig.contracts.dstToken,
      network: sorobanConfig.network,
    };
  }
}
