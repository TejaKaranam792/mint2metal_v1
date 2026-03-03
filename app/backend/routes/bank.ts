import express, { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import crypto from 'crypto';

const router = Router();
const BANK_WEBHOOK_SECRET = process.env.BANK_WEBHOOK_SECRET || 'placeholder-local-secret';

// Helper to verify X-Bank-Signature
const verifyBankSignature = (payload: string, signature: string): boolean => {
  if (!signature) return false;

  // Format: "timestamp.hmac" (prevent replay attacks)
  const parts = signature.split('.');
  if (parts.length !== 2) return false;

  const [timestamp, expectedHmac] = parts;

  // Prevent replay attacks (5 minute window)
  const now = Date.now();
  if (Math.abs(now - parseInt(timestamp, 10)) > 5 * 60 * 1000) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', BANK_WEBHOOK_SECRET);
  // Signature covers timestamp.payload
  const computedHash = hmac.update(`${timestamp}.${payload}`).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'utf8'), Buffer.from(expectedHmac, 'utf8'));
  } catch (e) {
    return false;
  }
};

router.post('/webhook', express.text({ type: '*/*' }), async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-bank-signature'] as string;

    // We expect raw text body to compute HMAC
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (!verifyBankSignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid or missing signature' });
    }

    const payload = JSON.parse(rawBody);
    const { reference, status, amount } = payload;

    if (!reference || !status) {
      return res.status(400).json({ error: 'Invalid payload: missing reference or status' });
    }

    const tx = await prisma.anchorTransaction.findUnique({
      where: { bankReference: reference }
    });

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found for this reference' });
    }

    if (status === 'SUCCESS') {
      await prisma.anchorTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'completed',
          amount: amount || tx.amountExpected,
          completedAt: new Date()
        }
      });
      console.log(`[Bank Webhook] Transaction ${tx.transactionId} marked as completed.`);
    } else if (status === 'FAILED') {
      await prisma.anchorTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'error',
          message: 'Bank transfer failed'
        }
      });
      console.log(`[Bank Webhook] Transaction ${tx.transactionId} marked as error.`);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Bank Webhook Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
