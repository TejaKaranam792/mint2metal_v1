import express from "express";
import { requestRedemption, getUserRedemptions, approveRedemption, shipRedemption, rejectRedemption } from "../services/redemption.service";
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

// POST /redemption/request
router.post("/request", authenticateToken, async (req, res) => {
  try {
    const { quantity, address } = req.body;

    if (!quantity || quantity <= 0 || !address) {
      return res.status(400).json({ success: false, message: "Valid quantity and address required" });
    }

    const redemptionRequest = await requestRedemption(req.user.id, { quantity, address });
    res.json({ success: true, data: redemptionRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /redemption/my
router.get("/my", authenticateToken, async (req, res) => {
  try {
    const redemptions = await getUserRedemptions(req.user.id);
    res.json({ success: true, data: redemptions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Admin: POST /admin/redemption/:id/approve
router.post("/:id/approve", requireAdmin, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const result = await approveRedemption(req.user!.userId, req.params.id);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Admin: POST /admin/redemption/:id/ship
router.post("/:id/ship", requireAdmin, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { trackingNumber } = req.body;
    if (!trackingNumber) {
      return res.status(400).json({ success: false, message: "Tracking number is required" });
    }
    const result = await shipRedemption(req.user!.userId, req.params.id, trackingNumber);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Admin: POST /admin/redemption/:id/reject
router.post("/:id/reject", requireAdmin, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const result = await rejectRedemption(req.params.id);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
