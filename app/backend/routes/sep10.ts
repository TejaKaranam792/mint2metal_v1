import { Router, Request, Response } from 'express';
import { Keypair } from '@stellar/stellar-sdk';
import { WebAuth } from '@stellar/stellar-sdk';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Required for SEP-10
const SERVER_SIGNING_KEY = process.env.TREASURY_SECRET;
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
const DOMAIN = process.env.ANCHOR_DOMAIN || 'localhost';

router.get('/', (req: Request, res: Response) => {
  try {
    if (!SERVER_SIGNING_KEY) {
      throw new Error("Server missing TREASURY_SECRET to sign SEP-10 challenge");
    }
    const serverKeyPair = Keypair.fromSecret(SERVER_SIGNING_KEY);
    const account = req.query.account as string;

    if (!account) {
      return res.status(400).json({ error: 'account is required' });
    }

    const challenge = WebAuth.buildChallengeTx(
      serverKeyPair,
      account,
      DOMAIN,
      300, // 5 minutes expiration
      NETWORK_PASSPHRASE,
      DOMAIN
    );

    res.json({
      transaction: challenge,
      network_passphrase: NETWORK_PASSPHRASE
    });
  } catch (error: any) {
    console.error('SEP-10 Challenge Error:', error);
    res.status(400).json({ error: error.message || 'Failed to build challenge' });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    if (!SERVER_SIGNING_KEY) {
      throw new Error("Server missing TREASURY_SECRET to sign SEP-10 challenge");
    }
    const { transaction } = req.body;
    if (!transaction) {
      return res.status(400).json({ error: 'transaction is required' });
    }

    // Read and verify the challenge transaction
    const parsed = WebAuth.readChallengeTx(
      transaction,
      Keypair.fromSecret(SERVER_SIGNING_KEY).publicKey(),
      NETWORK_PASSPHRASE,
      DOMAIN,
      DOMAIN
    );

    // Verify signatures
    const verified = WebAuth.verifyChallengeTxThreshold(
      transaction,
      Keypair.fromSecret(SERVER_SIGNING_KEY).publicKey(),
      NETWORK_PASSPHRASE,
      1, // Basic threshold
      [
        {
          key: parsed.clientAccountID,
          weight: 1,
          type: 'ed25519_public_key'
        }
      ],
      DOMAIN,
      DOMAIN
    );

    if (!verified || verified.length === 0) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    const clientAccountID = parsed.clientAccountID;

    // Optional: map to an internal user
    const token = jwt.sign(
      { sub: clientAccountID, userId: clientAccountID, role: 'USER' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (error: any) {
    console.error('SEP-10 Verification Error:', error);
    res.status(401).json({ error: error.message || 'Invalid challenge transaction' });
  }
});

export default router;
