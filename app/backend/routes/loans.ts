import { Router } from "express";
import { getUserFromToken } from "../services/auth.service";
import { loanService } from "../services/loan.service";

const router = Router();

// Middleware to check admin role
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const user = await getUserFromToken(req);
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden - Admin access required" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or missing authentication token" });
  }
};

// Apply for loan
router.post("/apply", async (req, res) => {
  const user = await getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { amount, collateralAmount } = req.body;

  if (!amount || !collateralAmount) {
    return res.status(400).json({ error: "Amount and collateral amount are required" });
  }

  if (amount <= 0 || collateralAmount <= 0) {
    return res.status(400).json({ error: "Amount and collateral must be positive" });
  }

  // Calculate LTV (Loan to Value)
  const ltv = (amount / collateralAmount) * 100;
  if (ltv > 50) {
    return res.status(400).json({ error: "Loan amount exceeds maximum LTV of 50%" });
  }

  try {
    const loanApplication = await loanService.applyForLoan(
      user.id,
      collateralAmount,
      amount
    );

    res.json({ message: "Loan application submitted", loan: loanApplication });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message || "Failed to apply for loan" });
  }
});

// Get loan status
router.get("/status", async (req, res) => {
  const user = await getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const loans = await loanService.getUserLoans(user.id);
    res.json({ loans });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch loan status" });
  }
});

// Repay loan
router.post("/repay", async (req, res) => {
  const user = await getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { loanId, amount } = req.body;

  if (!loanId || !amount) {
    return res.status(400).json({ error: "Loan ID and amount are required" });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: "Repayment amount must be positive" });
  }

  try {
    // TODO: Implement proper keypair handling for user-signed transactions
    // Currently, this requires the user's private key which should be handled on frontend
    // For now, return an error indicating this needs frontend implementation
    res.status(501).json({
      error: "Repayment requires frontend transaction signing",
      message: "Please implement frontend transaction signing for loan repayment"
    });

    // Future implementation:
    // const result = await loanService.repayLoan(userKeypair, loanId, amount.toString());
    // res.json({ message: "Repayment processed successfully", txHash: result });
  } catch (error) {
    res.status(500).json({ error: "Failed to process repayment" });
  }
});

// Calculate loan terms
router.post("/calculate", async (req, res) => {
  const user = await getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { amount, collateralAmount } = req.body;

  if (!amount || !collateralAmount) {
    return res.status(400).json({ error: "Amount and collateral amount are required" });
  }

  try {
    const calculation = loanService.calculateLoanTerms(collateralAmount, amount);
    res.json(calculation);
  } catch (error) {
    res.status(500).json({ error: "Failed to calculate loan terms" });
  }
});

// Admin endpoints
router.get("/admin/loan-requests", requireAdmin, async (req, res) => {
  try {
    const pendingLoans = await loanService.getPendingLoanRequests();
    res.json(pendingLoans);
  } catch (error) {
    console.error("Error fetching pending loan requests:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/loan-requests/:id/approve", requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await loanService.approveLoanRequest(id, req.user.id);
    res.json({ message: "Loan request approved", loan: result });
  } catch (error) {
    console.error("Error approving loan request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/loan-requests/:id/reject", requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await loanService.rejectLoanRequest(id, req.user.id);
    res.json({ message: "Loan request rejected", loan: result });
  } catch (error) {
    console.error("Error rejecting loan request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
