import express from "express";
import { createBuyOrder, createSellOrder, getUserOrders } from "../services/order.service";
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

    // Update order status to SETTLED
    const order = await prisma.order.updateMany({
      where: {
        id,
        userId,
        status: "PENDING"
      },
      data: {
        status: "SETTLED"
      }
    });

    if (order.count === 0) {
      return res.status(404).json({ success: false, message: "Order not found or already confirmed" });
    }

    res.json({ success: true, message: "Order confirmed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
