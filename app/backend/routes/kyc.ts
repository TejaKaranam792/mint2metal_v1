import express from "express";
import { startKYC, getKYCStatus, getAllKYC, approveKYC, rejectKYC } from "../services/kyc.service";
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

// GET /kyc/all - Admin route to get all KYC records
router.get("/all", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const kycRecords = await getAllKYC();
    res.json(kycRecords);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /admin/kyc/:userId/approve - Admin route to approve KYC
router.post("/:userId/approve", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const result = await approveKYC(userId);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /admin/kyc/:userId/reject - Admin route to reject KYC
router.post("/:userId/reject", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const result = await rejectKYC(userId);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
