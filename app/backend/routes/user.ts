import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { AMLService } from "../services/aml.service";
import { AuditService, AuditAction } from "../services/audit.service";
import { submitKYC } from "../services/kyc.service";
import { sorobanService } from "../services/soroban.service";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";

interface AuthenticatedUser {
  userId: string;
  email: string;
  role?: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/aml");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `amlDocument-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and PDF files are allowed"));
    }
  }
});

// Middleware to verify JWT token
const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

// Get user profile
router.get("/me", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        country: true,
        role: true,
        amlStatus: true,
        createdAt: true,
        kycs: {
          select: {
            status: true,
            verifiedAt: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get silver balance
router.get("/silver-balance", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get total silver assets owned by user (through mints)
    const totalSilver = await prisma.dSTMint.aggregate({
      where: {
        wallet: { userId },
        status: "MINTED"
      },
      _sum: {
        amount: true
      }
    });

    res.json({ balance: totalSilver._sum.amount || 0 });
  } catch (error) {
    console.error("Error fetching silver balance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get DST balance
router.get("/dst-balance", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get total DST tokens minted for user
    const totalDST = await prisma.dSTMint.aggregate({
      where: {
        wallet: { userId },
        status: "MINTED"
      },
      _sum: {
        amount: true
      }
    });

    res.json({ balance: totalDST._sum.amount || 0 });
  } catch (error) {
    console.error("Error fetching DST balance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get vault status
router.get("/vault-status", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get user's silver assets in vault
    const vaultAssets = await prisma.silverAsset.findMany({
      where: {
        dstmints: {
          some: {
            wallet: { userId },
            status: "MINTED"
          }
        }
      }
    });

    const totalWeight = vaultAssets.reduce((sum, asset) => sum + asset.weightGrams, 0);
    const totalValue = vaultAssets.reduce((sum, asset) => sum + (asset.weightGrams * asset.purity), 0);

    res.json({
      totalAssets: vaultAssets.length,
      totalWeight,
      totalValue,
      assets: vaultAssets
    });
  } catch (error) {
    console.error("Error fetching vault status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get KYC status
router.get("/kyc-status", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, kycs: { select: { verifiedAt: true } } }
    });

    const kyc = user?.kycs[0];

    res.json({
      status: user?.kycStatus || "NOT_STARTED",
      verifiedAt: kyc?.verifiedAt
    });
  } catch (error) {
    console.error("Error fetching KYC status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get pending AML
router.get("/pending-aml", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { amlStatus: true, amlDocument: true }
    });

    res.json({
      status: user?.amlStatus || "PENDING",
      documentRef: user?.amlDocument
    });
  } catch (error) {
    console.error("Error fetching AML status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Approve AML (admin only)
router.post("/approve-aml/:userId", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const adminId = req.user!.userId;

    // Check if requester is admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true }
    });

    if (admin?.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin access required" });
    }

    await AMLService.clearUserFlag(userId, adminId, "Approved by admin");

    res.json({ message: "AML approved successfully" });
  } catch (error: unknown) {
    console.error("Error approving AML:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// Submit AML
router.post("/submit-aml", authenticateToken, upload.single('amlDocument'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { documentRef } = req.body;
    const file = req.file;

    let amlDocument = documentRef;
    if (file) {
      amlDocument = file.filename;
    }

    if (!amlDocument) {
      return res.status(400).json({ error: "Document reference or file is required" });
    }

    // Update user AML status to pending
    await prisma.user.update({
      where: { id: userId },
      data: {
        amlStatus: "CLEARED",
        amlDocument
      }
    });

    // Log AML submission
    await AuditService.logAction(
      userId,
      AuditAction.AML_SUBMITTED,
      undefined,
      { documentRef: amlDocument },
      undefined,
      undefined
    );

    res.json({
      message: "AML document submitted successfully",
      documentRef: amlDocument
    });
  } catch (error: unknown) {
    console.error("Error submitting AML:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// Get transaction history
router.get("/transaction-history", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const transactions = await AMLService.getUserTransactionHistory(userId);

    res.json({ transactions });
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Submit KYC
router.post("/submit-kyc", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { documentData } = req.body;

    const result = await submitKYC(userId, documentData);

    // Log KYC submission
    await AuditService.logAction(
      userId,
      AuditAction.KYC_SUBMITTED,
      undefined,
      { documentData },
      undefined,
      undefined
    );

    res.json(result);
  } catch (error: unknown) {
    console.error("Error submitting KYC:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// Transfer balance
router.post("/transfer-balance", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { amount, recipientAddress, signedXdr } = req.body;

    if (!amount || !recipientAddress) {
      return res.status(400).json({ error: "Amount and recipient address are required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Amount must be positive" });
    }

    // Get user's wallet
    const userWallet = await prisma.wallet.findUnique({
      where: { userId }
    });

    if (!userWallet) {
      return res.status(400).json({ error: "User wallet not found" });
    }

    // Check blockchain balance
    const blockchainBalance = await sorobanService.getBalance(userWallet.address);
    if (parseFloat(blockchainBalance) < amount) {
      return res.status(400).json({ error: "Insufficient blockchain balance" });
    }

    let txHash: string;

    if (signedXdr) {
      // Submit signed transaction from frontend
      const { SorobanRpc } = await import('@stellar/stellar-sdk');
      const server = new SorobanRpc.Server(process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org');
      const result = await server.sendTransaction(signedXdr);
      txHash = result.hash;
    } else {
      // For server-generated wallets (not implemented yet)
      throw new Error("Server-side transfers not implemented - use signed XDR from frontend");
    }

    // Log the successful transfer
    await AuditService.logAction(
      userId,
      AuditAction.BALANCE_TRANSFER,
      txHash,
      { amount, recipientAddress, txHash },
      undefined,
      undefined
    );

    res.json({
      message: "Transfer completed successfully",
      amount,
      recipientAddress,
      txHash
    });
  } catch (error: unknown) {
    console.error("Error transferring balance:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

export default router;
