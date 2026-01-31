// Soroban Configuration for Mint2Metal
// This file contains network and contract configuration for Stellar Soroban integration

const sorobanConfig = {
  // Network configuration
  network: "TESTNET" as const,
  rpcUrl: "https://soroban-testnet.stellar.org",

  // Contract IDs - Actual deployed contract IDs from backend
  contracts: {
    dstToken: "CDBTLG5FXPPTFPQB7OJZVILNRZU6TR2GF7WNAFBLNH72WWSZPU73P5TO", // DST Token contract ID
    loan: "CCXLLPAILNMYZI2Z37YE2R5O75W672JRM5H7RVQVLIKKBTYOX2KVOCQS",     // Loan contract ID
  },
};

export { sorobanConfig };

// Note: Minting is vault-gated - actual contract execution requires:
// 1. Physical silver custody confirmation
// 2. Admin approval
// 3. Wallet signature from use
