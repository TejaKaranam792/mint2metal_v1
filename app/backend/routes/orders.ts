import express from "express";
import { createBuyOrder, createSellOrder, getUserOrders } from "../services/order.service";
import { prisma } from "../prisma";
import jwt from "jsonwebtoken";
import { sorobanService } from "../services/soroban.service";
import { Keypair } from "@stellar/stellar-sdk";

const router = express.Router();

interface AuthenticatedUser {
  userId: string;
  email: string;
  role?: string;
}

interface AuthenticatedRequest extends express.Request {
  user?: AuthenticatedUser;
}

// Middleware to verify JWT token
const authenticateToken = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

  jwt.verify(token, JWT_SECRET, (err: jwt.VerifyErrors | null, decoded: unknown) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded as AuthenticatedUser;
    next();
  });
};

// POST /orders/buy
router.post("/buy", authenticateToken, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { quantityGrams } = req.body;

    if (!quantityGrams || quantityGrams <= 0) {
      return res.status(400).json({ success: false, message: "Valid quantityGrams required" });
    }

    const order = await createBuyOrder(req.user!.userId, quantityGrams);
    res.json({ success: true, data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /orders/sell
router.post("/sell", authenticateToken, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { quantityGrams } = req.body;

    if (!quantityGrams || quantityGrams <= 0) {
      return res.status(400).json({ success: false, message: "Valid quantityGrams required" });
    }

    const order = await createSellOrder(req.user!.userId, quantityGrams);
    res.json({ success: true, data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /orders/my
router.get("/my", authenticateToken, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const orders = await getUserOrders(req.user!.userId);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /orders/:id/confirm
router.post("/:id/confirm", authenticateToken, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    console.log(`[Confirm Order API] Received confirm request for orderId: ${id}, req.body:`, req.body);

    const order = await prisma.order.findFirst({
      where: {
        id,
        userId,
        status: "PENDING"
      },
      include: { user: { include: { wallet: true } } }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found or already confirmed" });
    }

    if (order.type === "BUY") {
      // 1. Attempt on-chain transfer from Treasury to User
      try {
        const treasurySecret = process.env.STELLAR_ADMIN_SECRET;
        if (treasurySecret && order.user.wallet?.address) {
          const treasuryKeypair = Keypair.fromSecret(treasurySecret);
          await sorobanService.transferTokens(
            treasuryKeypair,
            order.user.wallet.address,
            parseFloat(order.quantityGrams.toFixed(7)).toString(),
            'XAG'
          );
        }
      } catch (onChainError: any) {
        console.warn(`[Treasury Transfer] On-chain transfer failed (likely no trustline): ${onChainError.message}`);
      }

      // 2. Manage Database Fallback and link to Vault Inventory (reduces reserves)
      try {
        if (order.user.wallet?.id) {
          // Find un-minted physical assets in the vault to "back" this transfer
          const availableAssets = await prisma.commodityAsset.findMany({
            where: { mint: null },
            take: Math.ceil(order.quantityGrams / 100), // Approximate how many rows we might need
          });

          // For simplicity in this demo, we'll just link the first available asset
          const assetToLink = availableAssets.length > 0 ? availableAssets[0].id : undefined;

          await prisma.dSTMint.create({
            data: {
              userId: order.userId,
              walletId: order.user.wallet.id,
              amount: order.quantityGrams,
              status: "MINTED",
              txHash: "internal-transfer-" + Date.now(),
              commodityAssetId: assetToLink // This link removes it from vault reserves calculating queries
            }
          });
        }
      } catch (dbError) {
        console.error("Failed to log DSTMint / attach CommodityAsset backing", dbError);
      }
    } else if (order.type === "SELL") {
      // 1. Burn XAG from user's wallet to Treasury
      try {
        const treasurySecret = process.env.STELLAR_ADMIN_SECRET;
        if (treasurySecret && order.user.wallet?.address) {
          const treasuryKeypair = Keypair.fromSecret(treasurySecret);
          await sorobanService.burnTokens(
            treasuryKeypair,
            order.user.wallet.address,
            order.quantityGrams.toString()
          );
        }
      } catch (burnError: any) {
        if (req.body?.force) {
          console.warn(`[Sell Order] Token burn failed due to legacy tokens, but force=true. Bypassing error: ${burnError.message}`);
        } else {
          console.error(`[Sell Order] Token burn failed: ${burnError.message}`);
          return res.status(400).json({
            success: false,
            message: `Token burn failed: ${burnError.message}`,
            code: "op_not_clawback_enabled"
          });
        }
      }

      // 2. Transfer Native XLM back to user
      try {
        const treasurySecret = process.env.STELLAR_ADMIN_SECRET;
        if (treasurySecret && order.user.wallet?.address) {
          const treasuryKeypair = Keypair.fromSecret(treasurySecret);
          const totalValue = order.quantityGrams * (order.priceLocked || 0);

          const stellarSdk = require('@stellar/stellar-sdk');
          const horizon = new stellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
          const account = await horizon.loadAccount(treasuryKeypair.publicKey());

          const tx = new stellarSdk.TransactionBuilder(account, {
            fee: '100000',
            networkPassphrase: stellarSdk.Networks.TESTNET
          })
            .addOperation(stellarSdk.Operation.payment({
              destination: order.user.wallet.address,
              asset: stellarSdk.Asset.native(),
              amount: parseFloat(totalValue.toFixed(7)).toString()
            }))
            .setTimeout(60)
            .build();

          tx.sign(treasuryKeypair);
          await horizon.submitTransaction(tx);
        }
      } catch (paymentError: any) {
        console.error(`[Sell Order] XLM Payment failed: ${paymentError.message}`);
        // We log the error but don't fail the overall operation if we already burned their tokens, 
        // to avoid them being in a weird state. Real app would handle this via a retry queue.
      }
    }

    // Update order status to SETTLED
    await prisma.order.update({
      where: { id },
      data: { status: "SETTLED" }
    });

    res.json({ success: true, message: "Order confirmed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
