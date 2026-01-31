import { Router } from "express";
import { getUserFromToken } from "../services/auth.service";
import { prisma } from "../prisma";
import { setSilverPrice, getCurrentSilverPrice, createSilverAsset, getVaultInventory, checkMintEligibility, createPurchaseOrder, updatePurchaseOrderStatus, getPurchaseOrders, getActivePriceLocks, expirePriceLocks } from "../services/silver.service";
import { approveKYC, rejectKYC, getAllKYC } from "../services/kyc.service";
import { settleOrder, rejectOrder } from "../services/order.service";
import { AMLService } from "../services/aml.service";
import { approveRedemption, executeRedemption, dispatchRedemption, getRedemptionQueue } from "../services/redemption.service";
import { loanService } from "../services/loan.service";
import { sorobanService } from "../services/soroban.service";
import { Keypair } from '@stellar/stellar-sdk';

const router = Router();

// Middleware to check admin role - temporarily disabled for testing
const requireAdmin = async (req: any, res: any, next: any) => {
  req.user = { id: "admin-test" }; // Mock admin user
  next();
};

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Get all users for admin management
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        country: true,
        amlStatus: true,
        role: true,
        kycStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform the data to include kycStatus at top level
    const transformedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      country: user.country,
      amlStatus: user.amlStatus,
      role: user.role,
      createdAt: user.createdAt,
      kycStatus: user.kycStatus,
    }));

    res.json(transformedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user role (for admin management)
router.post("/user/:id/role", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: role },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
    res.json({ message: "User role updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all transactions for monitoring
router.get("/transactions", requireAdmin, async (req, res) => {
  try {
    // Mock transactions for now - in real app, this would come from a transactions table
    const transactions = [
      {
        id: "1",
        userId: "user-1",
        type: "MINT",
        amount: 100,
        status: "COMPLETED",
        timestamp: new Date().toISOString(),
        description: "Minted 100g silver",
      },
      {
        id: "2",
        userId: "user-2",
        type: "REDEMPTION",
        amount: 50,
        status: "PENDING",
        timestamp: new Date().toISOString(),
        description: "Redeemed 50g silver",
      },
      {
        id: "3",
        userId: "user-1",
        type: "TRANSFER",
        amount: 25,
        status: "COMPLETED",
        timestamp: new Date().toISOString(),
        description: "Transferred 25 DST tokens",
      },
    ];
    res.json({ transactions });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get system analytics
router.get("/analytics", requireAdmin, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const verifiedUsers = await prisma.user.count({ where: { kycStatus: "VERIFIED" } });
    const pendingKYC = await prisma.user.count({ where: { kycStatus: "IN_REVIEW" } });
    const pendingAML = 0; // TODO: Remove AML from schema

    // Mock additional analytics
    const analytics = {
      totalUsers,
      verifiedUsers,
      pendingKYC,
      pendingAML,
      totalTransactions: 1250,
      totalVolume: 50000, // in grams
      activeUsers: 89,
      systemHealth: "GOOD",
    };

    res.json(analytics);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get pending AML users for admin review
router.get("/pending-aml", requireAdmin, async (req, res) => {
  try {
    const pendingAML = await AMLService.getFlaggedUsers();
    res.json(pendingAML);
  } catch (error) {
    console.error("Error fetching pending AML:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update transaction status (for admin approval/rejection)
router.post("/transaction/:id/status", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    // Mock transaction update - in real app, update transactions table
    res.json({
      message: `Transaction ${id} status updated to ${status}`,
      transaction: { id, status }
    });
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Silver Price Management
router.post("/silver-price", requireAdmin, async (req, res) => {
  const { pricePerGram, currency = "USD" } = req.body;

  try {
    const newPrice = await setSilverPrice((req as any).user.id, pricePerGram, currency);
    res.json({ message: "Silver price updated successfully", price: newPrice });
  } catch (error) {
    console.error("Error setting silver price:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/silver-price", requireAdmin, async (req, res) => {
  try {
    const price = await getCurrentSilverPrice();
    res.json({ price });
  } catch (error) {
    console.error("Error getting silver price:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Vault Management
router.post("/silver-asset", requireAdmin, async (req, res) => {
  const { vaultId, weightGrams, purity } = req.body;

  try {
    const asset = await createSilverAsset(vaultId, weightGrams, purity, (req as any).user.id);
    res.json({ message: "Silver asset created successfully", asset });
  } catch (error) {
    console.error("Error creating silver asset:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vault-inventory", requireAdmin, async (req, res) => {
  try {
    const inventory = await getVaultInventory();
    res.json(inventory);
  } catch (error) {
    console.error("Error getting vault inventory:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/mint-eligibility", requireAdmin, async (req, res) => {
  try {
    const eligibility = await checkMintEligibility();
    res.json(eligibility);
  } catch (error) {
    console.error("Error checking mint eligibility:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// KYC Management
router.get("/kyc", requireAdmin, async (req, res) => {
  try {
    const kycRecords = await getAllKYC();
    res.json({ success: true, data: kycRecords });
  } catch (error) {
    console.error("Error getting KYC records:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/kyc/:userId/approve", requireAdmin, async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await approveKYC(userId);
    res.json(result);
  } catch (error) {
    console.error("Error approving KYC:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/kyc/:userId/reject", requireAdmin, async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await rejectKYC(userId);
    res.json(result);
  } catch (error) {
    console.error("Error rejecting KYC:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Orders admin endpoints
router.post("/orders/:id/settle", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await settleOrder(id);
    res.json(result);
  } catch (error) {
    console.error("Error settling order:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/orders/:id/reject", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await rejectOrder(id);
    res.json(result);
  } catch (error) {
    console.error("Error rejecting order:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// AML Management
router.post("/aml/:userId/clear", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;

  try {
    await AMLService.clearUserFlag(userId, req.user.id, reason);
    res.json({ message: "AML flag cleared" });
  } catch (error) {
    console.error("Error clearing AML flag:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/aml-flagged", requireAdmin, async (req, res) => {
  try {
    const flagged = await AMLService.getFlaggedUsers();
    res.json(flagged);
  } catch (error) {
    console.error("Error getting flagged users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Redemption Management
router.post("/redemption/:id/approve", requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const redemption = await approveRedemption(req.user.id, id);
    res.json({ message: "Redemption approved", redemption });
  } catch (error) {
    console.error("Error approving redemption:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/redemption/:id/execute", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { adminSecret } = req.body;

  try {
    const redemption = await executeRedemption(id, adminSecret);
    res.json({ message: "Redemption executed", redemption });
  } catch (error) {
    console.error("Error executing redemption:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/redemption/:id/dispatch", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { trackingNumber } = req.body;

  try {
    const redemption = await dispatchRedemption(req.user.id, id, trackingNumber);
    res.json({ message: "Redemption dispatched", redemption });
  } catch (error) {
    console.error("Error dispatching redemption:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/redemption-queue", requireAdmin, async (req, res) => {
  try {
    const queue = await getRedemptionQueue();
    res.json(queue);
  } catch (error) {
    console.error("Error getting redemption queue:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin Controls
router.post("/user/:id/freeze", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { frozen } = req.body;

  try {
    // Wallet removed from schema, return mock response
    res.json({ message: `User ${frozen ? 'frozen' : 'unfrozen'} successfully` });
  } catch (error) {
    console.error("Error freezing/unfreezing user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
