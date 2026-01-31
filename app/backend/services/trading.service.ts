import { prisma } from '../prisma';
import { sorobanService } from './soroban.service';
import { walletService } from './wallet.service';
import { Keypair } from '@stellar/stellar-sdk';
import winston from 'winston';

export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum IntentStatus {
  PENDING = 'PENDING',
  EXECUTED = 'EXECUTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}

export enum TradeStatus {
  PENDING = 'PENDING',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export class TradingService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'trading.log' })
      ]
    });
  }

  /**
   * Submit a trade intent
   */
  async submitTradeIntent(
    userId: string,
    type: TradeType,
    amount: number,
    price: number,
    estimatedTokens: number
  ) {
    try {
      // Validate user has wallet
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true, kycs: true }
      });

      if (!user) throw new Error('User not found');
      if (!user.wallet) throw new Error('User has no wallet');
      if (!user.kycs || user.kycs.length === 0 || user.kycs[0].status !== 'VERIFIED') throw new Error('KYC not verified');

      // For sell orders, check if user has sufficient balance
      if (type === TradeType.SELL) {
        if (!user.wallet) throw new Error('User has no wallet');
        const dstBalance = await sorobanService.getBalance(user.wallet.address);
        if (parseFloat(dstBalance) < estimatedTokens) {
          throw new Error('Insufficient DST token balance');
        }
      }

      // Create trade intent
      const intent = await prisma.tradeIntent.create({
        data: {
          userId,
          type,
          amount,
          price,
          totalValue: amount * price,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      });

      // Log the intent
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'TRADE_INTENT_SUBMITTED',
          reference: intent.id,
          details: JSON.stringify({ type, amount, price, totalValue: amount * price })
        }
      });

      this.logger.info('Trade intent submitted', { userId, intentId: intent.id, type, amount, price });
      return intent;
    } catch (error) {
      this.logger.error('Failed to submit trade intent', { error, userId, type, amount, price });
      throw error;
    }
  }

  /**
   * Execute a trade between buyer and seller
   */
  async executeTrade(
    intentId: string,
    adminKeypair: Keypair
  ) {
    try {
      const intent = await prisma.tradeIntent.findUnique({
        where: { id: intentId },
        include: { user: { include: { wallet: true } } }
      });

      if (!intent) throw new Error('Trade intent not found');
      if (intent.status !== IntentStatus.PENDING) throw new Error('Intent already processed');

      // Find matching counter-party
      const counterIntent = await this.findMatchingIntent(intent);

      if (!counterIntent) {
        throw new Error('No matching trade found');
      }

      // Execute the trade on blockchain
      const tradeAmount = Math.min(intent.amount, counterIntent.amount);
      const tradePrice = intent.type === TradeType.BUY ? intent.price : counterIntent.price;

      // For simplicity, assume direct token transfer
      // In a real implementation, this would involve escrow and settlement
      let txHash: string;

      if (intent.type === TradeType.BUY) {
        // Buyer pays seller
        txHash = await sorobanService.transferTokens(
          Keypair.fromSecret(process.env.BUYER_PRIVATE_KEY!), // Would be user's keypair
          counterIntent.user.wallet!.address,
          tradeAmount.toString()
        );
      } else {
        // Seller transfers to buyer
        txHash = await sorobanService.transferTokens(
          Keypair.fromSecret(process.env.SELLER_PRIVATE_KEY!), // Would be user's keypair
          counterIntent.user.wallet!.address,
          tradeAmount.toString()
        );
      }

      // Create trade record
      const trade = await prisma.trade.create({
        data: {
          userId: intent.userId,
          intentId: intent.id,
          buyerId: intent.type === TradeType.BUY ? intent.userId : counterIntent.userId,
          sellerId: intent.type === TradeType.SELL ? intent.userId : counterIntent.userId,
          type: intent.type,
          amount: tradeAmount,
          price: tradePrice,
          status: TradeStatus.EXECUTED
        }
      });

      // Update intents
      await prisma.tradeIntent.update({
        where: { id: intent.id },
        data: {
          status: IntentStatus.EXECUTED,
          executedAt: new Date()
        }
      });

      await prisma.tradeIntent.update({
        where: { id: counterIntent.id },
        data: {
          status: IntentStatus.EXECUTED,
          executedAt: new Date()
        }
      });

      // Log the trade
      await prisma.auditLog.create({
        data: {
          userId: intent.userId,
          action: 'TRADE_EXECUTED',
          reference: trade.id,
          details: JSON.stringify({
            tradeId: trade.id,
            amount: tradeAmount,
            price: tradePrice,
            totalValue: tradeAmount * tradePrice,
            txHash
          })
        }
      });

      this.logger.info('Trade executed', { tradeId: trade.id, intentId, amount: tradeAmount, price: tradePrice, txHash });
      return trade;
    } catch (error) {
      this.logger.error('Failed to execute trade', { error, intentId });
      throw error;
    }
  }

  /**
   * Find matching trade intent
   */
  private async findMatchingIntent(intent: any) {
    const oppositeType = intent.type === TradeType.BUY ? TradeType.SELL : TradeType.BUY;

    return await prisma.tradeIntent.findFirst({
      where: {
        type: oppositeType,
        status: IntentStatus.PENDING,
        amount: { gte: intent.amount },
        price: intent.type === TradeType.BUY
          ? { lte: intent.price } // Seller price <= buyer price
          : { gte: intent.price } // Buyer price >= seller price
      },
      include: { user: { include: { wallet: true } } },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Cancel trade intent
   */
  async cancelTradeIntent(intentId: string, userId: string) {
    try {
      const intent = await prisma.tradeIntent.findUnique({
        where: { id: intentId }
      });

      if (!intent) throw new Error('Trade intent not found');
      if (intent.userId !== userId) throw new Error('Unauthorized');
      if (intent.status !== IntentStatus.PENDING) throw new Error('Intent cannot be cancelled');

      await prisma.tradeIntent.update({
        where: { id: intentId },
        data: { status: IntentStatus.CANCELLED }
      });

      // Log cancellation
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'TRADE_INTENT_CANCELLED',
          reference: intentId,
          details: JSON.stringify({ intentId })
        }
      });

      this.logger.info('Trade intent cancelled', { intentId, userId });
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to cancel trade intent', { error, intentId, userId });
      throw error;
    }
  }

  /**
   * Get user's trade history
   */
  async getUserTrades(userId: string) {
    try {
      const trades = await prisma.trade.findMany({
        where: {
          OR: [
            { buyerId: userId },
            { sellerId: userId }
          ]
        },
        include: {
          buyer: { select: { id: true, email: true } },
          seller: { select: { id: true, email: true } },
          tradeIntent: true
        },
        orderBy: { executedAt: 'desc' }
      });

      return trades;
    } catch (error) {
      this.logger.error('Failed to get user trades', { error, userId });
      throw error;
    }
  }

  /**
   * Get pending trade intents
   */
  async getPendingIntents(userId?: string) {
    try {
      const where = userId ? { userId, status: IntentStatus.PENDING } : { status: IntentStatus.PENDING };

      const intents = await prisma.tradeIntent.findMany({
        where,
        include: { user: { select: { id: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' }
      });

      return intents;
    } catch (error) {
      this.logger.error('Failed to get pending intents', { error, userId });
      throw error;
    }
  }

  /**
   * Validate trade for compliance
   */
  async validateTrade(userId: string, amount: number, type: TradeType) {
    try {
      // Use wallet service for comprehensive validation
      const isEligible = await walletService.validateTradingEligibility(userId);
      if (!isEligible) {
        throw new Error('User not eligible for trading');
      }

      // Additional trade-specific validations
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true }
      });

      if (!user?.wallet) throw new Error('Wallet not found');

      // Check balance for sell orders
      if (type === TradeType.SELL) {
        const dstBalance = await sorobanService.getBalance(user.wallet.address);
        if (parseFloat(dstBalance) < amount) {
          throw new Error('Insufficient DST token balance');
        }
      }

      // Role-based trading limits
      if (user.role === 'INDIA_USER') {
        // Indian user specific trading limits
        // e.g., maximum trade amounts, frequency limits
        if (amount > 1000) { // Example limit
          throw new Error('Trade amount exceeds Indian regulatory limits');
        }
      } else if (user.role === 'INTERNATIONAL_USER') {
        // International user specific checks
        // e.g., sanctions compliance, regional restrictions
        if (amount > 5000) { // Example limit
          throw new Error('Trade amount exceeds international limits');
        }
      }

      return { valid: true };
    } catch (error) {
      this.logger.error('Trade validation failed', { error, userId, amount, type });
      throw error;
    }
  }
}

export const tradingService = new TradingService();
