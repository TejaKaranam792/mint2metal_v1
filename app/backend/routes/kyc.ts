import express from "express";
import { startKYC, getKYCStatus } from "../services/kyc.service";
import { generateAccessToken, verifyWebhookSignature, mapReviewResultToKycStatus, checkApplicantReviewStatus } from "../services/sumsub.service";
import { prisma } from "../prisma";
import jwt from "jsonwebtoken";

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

// Middleware to check admin role
const requireAdmin = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
};

// ===========================================================
//  SUMSUB — Access Token for Web SDK
// ===========================================================
router.post("/access-token", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const levelName = req.body.levelName || 'id-and-liveness';

    console.log(`[KYC] Generating Sumsub access token for user: ${userId}`);

    const result = await generateAccessToken(userId, levelName);

    // Update user KYC status to IN_REVIEW if not already started
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && user.kycStatus === 'NOT_STARTED') {
      await prisma.user.update({
        where: { id: userId },
        data: { kycStatus: 'IN_REVIEW' },
      });
    }

    res.json({
      token: result.token,
      userId: result.userId,
    });
  } catch (error: any) {
    console.error("[KYC] Access token error:", error?.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate Sumsub access token" });
  }
});

// ===========================================================
//  SUMSUB — Check Status (polls Sumsub directly, no webhook needed)
// ===========================================================
router.post("/check-status", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;

    console.log(`[KYC] Checking Sumsub status for user: ${userId}`);

    const sumsubStatus = await checkApplicantReviewStatus(userId);

    // Update local database with the latest status from Sumsub
    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: sumsubStatus },
    });

    // Also update KYC record if exists
    const kycRecord = await prisma.kycRecord.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (kycRecord) {
      await prisma.kycRecord.update({
        where: { id: kycRecord.id },
        data: {
          status: sumsubStatus,
          ...(sumsubStatus === 'VERIFIED' ? { verifiedAt: new Date() } : {}),
        },
      });
    }

    res.json({
      success: true,
      status: sumsubStatus,
      message: sumsubStatus === 'VERIFIED'
        ? 'KYC verified successfully!'
        : sumsubStatus === 'REJECTED'
          ? 'KYC verification was rejected.'
          : 'KYC verification is still pending.',
    });
  } catch (error: any) {
    console.error("[KYC] Check status error:", error?.response?.data || error.message);
    res.status(500).json({ error: "Failed to check verification status" });
  }
});

// ===========================================================
//  SUMSUB — Webhook (receives verification results)
// ===========================================================
router.post("/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-payload-digest'] as string;
    const rawBody = typeof req.body === 'string' ? req.body : req.body.toString();

    // Verify webhook signature (skip in development if no secret set)
    const webhookSecret = process.env.SUMSUB_WEBHOOK_SECRET;
    if (webhookSecret && webhookSecret !== 'your-webhook-secret' && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        console.error("[KYC Webhook] Invalid signature");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
    }

    const payload = JSON.parse(rawBody);
    console.log("[KYC Webhook] Received event:", payload.type);

    // Handle applicant reviewed events
    if (payload.type === 'applicantReviewed' || payload.type === 'applicantPending') {
      const externalUserId = payload.externalUserId;
      const reviewResult = payload.reviewResult;

      if (!externalUserId) {
        console.warn("[KYC Webhook] No externalUserId in payload");
        return res.status(200).json({ ok: true });
      }

      // Map Sumsub result to our KYC status
      const kycStatus = payload.type === 'applicantPending'
        ? 'IN_REVIEW'
        : mapReviewResultToKycStatus(reviewResult);

      console.log(`[KYC Webhook] Updating user ${externalUserId} to ${kycStatus}`);

      // Update user's KYC status
      await prisma.user.update({
        where: { id: externalUserId },
        data: { kycStatus },
      });

      // Also update the latest KYC record
      const kycRecord = await prisma.kycRecord.findFirst({
        where: { userId: externalUserId },
        orderBy: { createdAt: 'desc' },
      });

      if (kycRecord) {
        await prisma.kycRecord.update({
          where: { id: kycRecord.id },
          data: {
            status: kycStatus,
            ...(kycStatus === 'VERIFIED' ? { verifiedAt: new Date() } : {}),
            ...(kycStatus === 'REJECTED' ? { kycRejectedReason: reviewResult?.rejectLabels?.join(', ') || 'Rejected by Sumsub' } : {}),
          },
        });
      }
    }

    res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("[KYC Webhook] Error:", error.message);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ===========================================================
//  EXISTING ROUTES (preserved)
// ===========================================================

// POST /kyc/start
router.post("/start", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await startKYC(req.user!.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /kyc/initiate
router.post("/initiate", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, levelName } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    const result = await startKYC(userId, levelName);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /kyc/status
router.get("/status", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const status = await getKYCStatus(req.user!.userId);
    res.json({ success: true, status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
