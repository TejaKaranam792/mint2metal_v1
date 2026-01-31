import { Router } from "express";
import { AuthService } from "../services/auth.service";
import { prisma } from "../prisma";

const router = Router();

router.post("/signup", async (req, res) => {
  const { email, password, country } = req.body;

  // Validate input
  if (!email || !password || !country) {
    return res.status(400).json({ error: "Email, password, and country are required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long" });
  }

  try {
    // Use AuthService for registration
    const user = await AuthService.register({ email, password, country });

    // Determine AML status based on country and update
    const amlStatus = country === "INDIA" ? "CLEARED" : "CLEARED";
    await prisma.user.update({
      where: { id: user.id },
      data: { amlStatus },
    });

    res.status(201).json({ user });
  } catch (error: any) {
    console.error("Signup error:", error);
    res.status(400).json({ error: error.message || "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password, twoFactorCode } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // Use AuthService for all logins (including admin)
    const result = await AuthService.login({ email, password, twoFactorCode });

    if (result.requiresTwoFactor) {
      return res.status(200).json({ requiresTwoFactor: true, userId: result.userId });
    }

    // Fetch KYC status
    const kyc = await prisma.kyc.findFirst({
      where: { userId: result.user!.id },
    });

    // Return user with KYC status
    res.status(200).json({
      user: { ...result.user, kyc },
      token: result.token
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(401).json({ error: error.message || "Invalid credentials" });
  }
});

// 2FA Setup Route
router.post("/2fa/setup", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const result = await AuthService.setupTwoFactor(userId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("2FA setup error:", error);
    res.status(400).json({ error: error.message });
  }
});

// 2FA Enable Route
router.post("/2fa/enable", async (req, res) => {
  const { userId, secret, token } = req.body;

  if (!userId || !secret || !token) {
    return res.status(400).json({ error: "User ID, secret, and token are required" });
  }

  try {
    const result = await AuthService.enableTwoFactor(userId, secret, token);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("2FA enable error:", error);
    res.status(400).json({ error: error.message });
  }
});

// 2FA Disable Route
router.post("/2fa/disable", async (req, res) => {
  const { userId, token } = req.body;

  if (!userId || !token) {
    return res.status(400).json({ error: "User ID and token are required" });
  }

  try {
    const result = await AuthService.disableTwoFactor(userId, token);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("2FA disable error:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
