// Soroban Client Utilities for Mint2Metal
// Provides utilities for interacting with Stellar Soroban contracts

import { Soroban, Contract, rpc } from '@stellar/stellar-sdk';
import { sorobanConfig } from './sorobanConfig';

// Get Soroban server instance
export function getSorobanServer(): rpc.Server {
  return new rpc.Server(sorobanConfig.rpcUrl);
}

// Get DST Token contract instance
export function getDSTContract(): Contract {
  return new Contract(sorobanConfig.contracts.dstToken);
}

// Get Loan contract instance
export function getLoanContract(): Contract {
  return new Contract(sorobanConfig.contracts.loan);
}
