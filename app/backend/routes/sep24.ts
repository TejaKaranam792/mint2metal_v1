import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to authenticate SEP-10 JWT
const requireSep10Auth = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded; // Contains sub (Stellar public key)
    next();
  } catch (err) {
    console.error("SEP-10 Token Verification Error", err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

router.get('/info', (req: Request, res: Response) => {
  res.json({
    receive: {
      USD: {
        enabled: true,
        fee_fixed: 0,
        fee_percent: 1,
        min_amount: 10,
        max_amount: 10000
      }
    },
    withdraw: {
      USD: {
        enabled: true,
        fee_fixed: 0,
        fee_percent: 1,
        min_amount: 10,
        max_amount: 10000
      }
    },
    fee: {
      enabled: true,
      description: "Standard 1% fee on operations."
    }
  });
});

router.post('/transactions/deposit/interactive', requireSep10Auth, async (req: any, res: Response) => {
  try {
    const { asset_code, amount, account } = req.body;
    const stellarAccountId = req.user.sub;

    if (asset_code !== 'USD' && asset_code !== 'XAG') {
      return res.status(400).json({ error: 'Unsupported asset. Use USD or XAG.' });
    }

    // Interactive SEP-24 deposits require an initial incomplete record
    const anchorTx = await prisma.anchorTransaction.create({
      data: {
        transactionId: crypto.randomUUID(),
        stellarAccountId,
        type: 'deposit',
        status: 'incomplete', // The user hasn't finished interactive inputs
        assetCode: asset_code,
        amountExpected: amount ? parseFloat(amount) : null,
      }
    });

    const domain = process.env.ANCHOR_DOMAIN || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    // Usually this URL goes to a KYC / Deposit instructions popup
    const interactiveUrl = `${protocol}://${domain}/interactive/deposit?tx=${anchorTx.transactionId}`;

    res.json({
      type: "interactive_customer_info_needed",
      url: interactiveUrl,
      id: anchorTx.transactionId
    });
  } catch (error: any) {
    console.error("Deposit Init Error", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post('/transactions/withdraw/interactive', requireSep10Auth, async (req: any, res: Response) => {
  try {
    const { asset_code, amount, account } = req.body;
    const stellarAccountId = req.user.sub;

    if (asset_code !== 'USD' && asset_code !== 'XAG') {
      return res.status(400).json({ error: 'Unsupported asset. Use USD or XAG.' });
    }

    const anchorTx = await prisma.anchorTransaction.create({
      data: {
        transactionId: crypto.randomUUID(),
        stellarAccountId,
        type: 'withdrawal',
        status: 'incomplete',
        assetCode: asset_code,
        amountExpected: amount ? parseFloat(amount) : null,
      }
    });

    const domain = process.env.ANCHOR_DOMAIN || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const interactiveUrl = `${protocol}://${domain}/interactive/withdraw?tx=${anchorTx.transactionId}`;

    res.json({
      type: "interactive_customer_info_needed",
      url: interactiveUrl,
      id: anchorTx.transactionId
    });
  } catch (error: any) {
    console.error("Withdraw Init Error", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get('/transaction', requireSep10Auth, async (req: any, res: Response) => {
  try {
    const id = req.query.id as string;
    const stellar_transaction_id = req.query.stellar_transaction_id as string;
    const external_transaction_id = req.query.external_transaction_id as string;
    const stellarAccountId = req.user.sub;

    if (!id && !stellar_transaction_id && !external_transaction_id) {
      return res.status(400).json({ error: 'id, stellar_transaction_id, or external_transaction_id required' });
    }

    const tx = await prisma.anchorTransaction.findFirst({
      where: {
        stellarAccountId,
        OR: [
          { transactionId: id },
          { externalId: external_transaction_id }
        ]
      }
    });

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      transaction: {
        id: tx.transactionId,
        kind: tx.type,
        status: tx.status,
        amount_in: tx.amount,
        amount_out: tx.amount, // Same for simplicity without fees implemented locally
        amount_fee: "0",
        asset_code: tx.assetCode,
        stellar_account_id: tx.stellarAccountId,
        external_transaction_id: tx.externalId,
        message: tx.message,
        started_at: tx.startedAt.toISOString(),
        completed_at: tx.completedAt ? tx.completedAt.toISOString() : null,
      }
    });
  } catch (error: any) {
    console.error("Get Transaction Error", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
