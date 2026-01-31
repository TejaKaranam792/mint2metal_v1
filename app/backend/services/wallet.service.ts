import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { prisma } from '../prisma';
import { sorobanService } from './soroban.service';
import winston from 'winston';
// import crypto from 'crypto'; // Temporarily disabled for testing

export interface WalletInfo {
  address: string;
  chain: string;
  balance: string;
  isActive: boolean;
  walletType: 'SERVER_GENERATED' | 'EXTERNAL';
  isConnected: boolean;
  lastConnected?: Date;
}

export interface Transaction {
  id: string;
  type: 'SEND' | 'RECEIVE';
  amount: string;
  toAddress?: string;
  fromAddress?: string;
  txHash: string;
  timestamp: Date;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
}

export class WalletService {
  private logger: winston.Logger;
  private encryptionKey: string;
  private iv: Buffer;

  constructor() {
    this.encryptionKey = process.env.WALLET_ENCRYPTION_KEY || 'default-key-change-in-production';
    // Use a fixed IV for simplicity (in production, generate random IV per encryption)
    this.iv = Buffer.from('0123456789abcdef0123456789abcdef', 'hex'); // 16 bytes for AES
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'wallet.log' })
      ]
    });
  }

  /**
   * Encrypt sensitive wallet data
   */
  private encrypt(text: string): string {
    // TODO: Fix encryption - temporarily disabled for testing
    return text;
  }

  /**
   * Decrypt sensitive wallet data
   */
  private decrypt(encryptedText: string): string {
    // TODO: Fix encryption - temporarily disabled for testing
    return encryptedText;
  }

  /**
   * Check if user is eligible for wallet operations
   */
  private async validateUserEligibility(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { kycs: true }
    });

    if (!user) throw new Error('User not found');

    // Check KYC status
    if (user.kycs?.[0]?.status !== 'VERIFIED') {
      throw new Error('KYC verification required for wallet operations');
    }

    // Check AML status
    if (user.amlStatus === 'FLAGGED') {
      throw new Error('Account flagged for AML compliance');
    }

    // Role-based restrictions for Indian users
    if (user.role === 'INDIA_USER') {
      // Additional checks for Indian users if needed
      // e.g., RBI compliance, local regulations
    }

    // International user checks
    if (user.role === 'INTERNATIONAL_USER') {
      // Additional checks for international users
      // e.g., OFAC sanctions, regional compliance
    }
  }

  /**
   * Create a new wallet for user
   */
  async createWallet(userId: string): Promise<{ address: string }> {
    try {
      await this.validateUserEligibility(userId);

      // Check if user already has a wallet
      const existingWallet = await prisma.wallet.findUnique({
        where: { userId }
      });

      if (existingWallet) {
        throw new Error('User already has a wallet');
      }

      // Generate new Stellar keypair
      const keypair = Keypair.random();

      // Encrypt the secret key
      const encryptedSecret = this.encrypt(keypair.secret());

      // Create wallet record
      const wallet = await prisma.wallet.create({
        data: {
          userId,
          address: keypair.publicKey(),
          chain: 'Stellar'
        }
      });

      // Store encrypted keypair securely (in production, use HSM or secure vault)
      // For now, we'll store in a separate secure table or environment
      // TODO: Implement secure key storage

      // Log wallet creation
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'WALLET_CREATED',
          reference: wallet.id,
          details: JSON.stringify({ address: keypair.publicKey() })
        }
      });

      this.logger.info('Wallet created successfully', { userId, address: keypair.publicKey() });
      return { address: keypair.publicKey() };

    } catch (error) {
      this.logger.error('Failed to create wallet', { error, userId });
      throw error;
    }
  }

  /**
   * Check if user has a wallet
   */
  async userHasWallet(userId: string): Promise<boolean> {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { userId }
      });
      return !!wallet;
    } catch (error) {
      this.logger.error('Failed to check wallet existence', { error, userId });
      throw error;
    }
  }

  /**
   * Connect external wallet (Freighter)
   */
  async connectExternalWallet(userId: string, address: string, network: string): Promise<void> {
    try {
      await this.validateUserEligibility(userId);

      // Validate address format
      if (!StrKey.isValidEd25519PublicKey(address)) {
        throw new Error('Invalid Stellar address format');
      }

      // Check if user already has a wallet
      const existingWallet = await prisma.wallet.findUnique({
        where: { userId }
      });

      if (existingWallet) {
        // Update existing wallet
        await prisma.wallet.update({
          where: { userId },
          data: {
            address,
            chain: 'Stellar',
            walletType: 'EXTERNAL',
            isConnected: true,
            lastConnected: new Date()
          }
        });
      } else {
        // Create new external wallet
        await prisma.wallet.create({
          data: {
            userId,
            address,
            chain: 'Stellar',
            walletType: 'EXTERNAL',
            isConnected: true,
            lastConnected: new Date()
          }
        });
      }

      // Log wallet connection
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'WALLET_CONNECTED',
          reference: address,
          details: JSON.stringify({ address, network, walletType: 'EXTERNAL' })
        }
      });

      this.logger.info('External wallet connected', { userId, address, network });

    } catch (error) {
      this.logger.error('Failed to connect external wallet', { error, userId, address });
      throw error;
    }
  }

  /**
   * Disconnect external wallet
   */
  async disconnectExternalWallet(userId: string): Promise<void> {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { userId }
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (wallet.walletType !== 'EXTERNAL') {
        throw new Error('Cannot disconnect server-generated wallet');
      }

      await prisma.wallet.update({
        where: { userId },
        data: {
          isConnected: false,
          lastConnected: null
        }
      });

      // Log wallet disconnection
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'WALLET_DISCONNECTED',
          reference: wallet.address,
          details: JSON.stringify({ address: wallet.address })
        }
      });

      this.logger.info('External wallet disconnected', { userId, address: wallet.address });

    } catch (error) {
      this.logger.error('Failed to disconnect external wallet', { error, userId });
      throw error;
    }
  }

  /**
   * Get wallet information
   */
  async getWalletInfo(userId: string): Promise<WalletInfo | null> {
    try {
      await this.validateUserEligibility(userId);

      const wallet = await prisma.wallet.findUnique({
        where: { userId }
      });

      if (!wallet) {
        return null;
      }

      const balance = await sorobanService.getBalance(wallet.address);

      return {
        address: wallet.address,
        chain: wallet.chain,
        balance,
        isActive: true,
        walletType: "EXTERNAL" as const,
        isConnected: wallet.isConnected,
        lastConnected: wallet.lastConnected || undefined
      };

    } catch (error) {
      this.logger.error('Failed to get wallet info', { error, userId });
      throw error;
    }
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(userId: string): Promise<string> {
    try {
      await this.validateUserEligibility(userId);

      const wallet = await prisma.wallet.findUnique({
        where: { userId }
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const balance = await sorobanService.getBalance(wallet.address);
      return balance;

    } catch (error) {
      this.logger.error('Failed to get wallet balance', { error, userId });
      throw error;
    }
  }

  /**
   * Transfer DST tokens
   */
  async transferTokens(userId: string, toAddress: string, amount: string): Promise<string> {
    try {
      await this.validateUserEligibility(userId);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true }
      });

      if (!user?.wallet) {
        throw new Error('Wallet not found');
      }

      // Validate recipient address format
      if (!StrKey.isValidEd25519PublicKey(toAddress)) {
        throw new Error('Invalid recipient address');
      }

      // Check sufficient balance
      const balance = await sorobanService.getBalance(user.wallet.address);
      if (parseFloat(balance) < parseFloat(amount)) {
        throw new Error('Insufficient balance');
      }

      // Get user's keypair (in production, retrieve from secure storage)
      // For now, we'll need to implement key retrieval
      // TODO: Implement secure key retrieval
      throw new Error('Keypair retrieval not implemented - requires secure storage integration');

      // Perform transfer
      // const txHash = await sorobanService.transferTokens(userKeypair, toAddress, amount);

      // Log transaction
      // await prisma.auditLog.create({
      //   data: {
      //     userId,
      //     action: 'TOKEN_TRANSFER',
      //     reference: txHash,
      //     details: JSON.stringify({ toAddress, amount, txHash })
      //   }
      // });

      // this.logger.info('Tokens transferred', { userId, toAddress, amount, txHash });
      // return txHash;

    } catch (error) {
      this.logger.error('Failed to transfer tokens', { error, userId, toAddress, amount });
      throw error;
    }
  }

  /**
   * Get wallet transaction history
   */
  async getWalletTransactions(userId: string): Promise<Transaction[]> {
    try {
      await this.validateUserEligibility(userId);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true }
      });

      if (!user?.wallet) {
        return [];
      }

      // For now, return audit logs related to wallet operations
      // In production, integrate with blockchain indexer or store transactions separately
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          userId,
          action: {
            in: ['TOKEN_TRANSFER', 'DST_MINT', 'DST_BURN']
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      // Transform audit logs to transaction format
      const transactions: Transaction[] = auditLogs.map(log => {
        const details = JSON.parse(log.details || '{}');
        return {
          id: log.id,
          type: log.action === 'TOKEN_TRANSFER' ? 'SEND' : 'RECEIVE',
          amount: details.amount?.toString() || '0',
          toAddress: details.toAddress,
          txHash: details.txHash || log.reference || '',
          timestamp: log.createdAt,
          status: 'COMPLETED'
        };
      });

      return transactions;

    } catch (error) {
      this.logger.error('Failed to get wallet transactions', { error, userId });
      throw error;
    }
  }

  /**
   * Validate trading eligibility for wallet operations
   */
  async validateTradingEligibility(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { kycs: true, wallet: true }
      });

      if (!user) return false;
      if (!user.wallet) return false;
      if (user.kycs?.[0]?.status !== 'VERIFIED') return false;
      if (user.amlStatus === 'FLAGGED') return false;

      // Additional role-based checks
      if (user.role === 'INDIA_USER') {
        // Check Indian regulatory compliance
        // e.g., trading limits, documentation requirements
      }

      if (user.role === 'INTERNATIONAL_USER') {
        // Check international compliance
        // e.g., sanctions, regional restrictions
      }

      return true;

    } catch (error) {
      this.logger.error('Failed to validate trading eligibility', { error, userId });
      return false;
    }
  }

  /**
   * Get user's keypair for signing (secure implementation needed)
   */
  private async getUserKeypair(userId: string): Promise<Keypair> {
    // TODO: Implement secure keypair retrieval from HSM or encrypted storage
    // This is a placeholder - in production, never store keys in plain text
    throw new Error('Secure keypair storage not implemented');

    // Example implementation:
    // const encryptedKey = await getEncryptedKeyFromSecureStorage(userId);
    // const secret = this.decrypt(encryptedKey);
    // return Keypair.fromSecret(secret);
  }
}

export const walletService = new WalletService();
