import { Router } from "express";
import { authenticateTokenOrApiKey } from "../middleware/auth.middleware";
import { ApiKeyService } from "../services/api-key.service";

const router = Router();

// Get all active API keys for the authenticated user
router.get("/", authenticateTokenOrApiKey, async (req: any, res) => {
  try {
    const userId = req.user.userId || req.user.id; // JWT uses userId, API key auth uses id
    const role = req.user.role;

    const query: any = { isActive: true };
    // If Admin, show all keys. If not, the previous check already handled returning []
    // but we can be explicit here too in case requirements change.
    if (role !== "ADMIN") {
      return res.json([]);
    }

    const { prisma } = await import("../prisma");
    const keys = await prisma.apiKey.findMany({
      where: query,
      select: {
        id: true,
        name: true,
        userId: true,
        permissions: true,
        rateLimit: true,
        lastUsedAt: true,
        createdAt: true,
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(keys);
  } catch (error: any) {
    console.error("Error fetching API keys:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Generate a new API key
router.post("/generate", authenticateTokenOrApiKey, async (req: any, res) => {
  try {
    const userId = req.user.userId || req.user.id; // JWT uses userId, API key auth uses id
    const { name, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ error: "API Key name is required" });
    }

    // Access is granted to every user as requested
    // Previously restricted to API_INTEGRATOR or ADMIN. Now open to ALL authenticated users.

    const { apiKey, record } = await ApiKeyService.generateApiKey(
      userId,
      name,
      permissions || ["READ_ONLY"]
    );

    res.status(201).json({
      message: "API Key generated successfully. Save this secret, it will only be shown once.",
      apiKey, // Extracted secret, only returned once
      keyRecord: {
        id: record.id,
        name: record.name,
        permissions: record.permissions,
        createdAt: record.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Error generating API key:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Revoke/Delete an API key
router.delete("/:id", authenticateTokenOrApiKey, async (req: any, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const keyId = req.params.id;
    const role = req.user.role;

    const { prisma } = await import("../prisma");

    // Deactivate it instead of hard delete for audit purposes
    // Admins can revoke any key, users only their own
    const record = await prisma.apiKey.updateMany({
      where: role === "ADMIN" ? { id: keyId } : { id: keyId, userId },
      data: { isActive: false },
    });

    if (record.count === 0) {
      return res.status(404).json({ error: "API key not found or you don't have permission" });
    }

    res.json({ message: "API key revoked successfully" });
  } catch (error: any) {
    console.error("Error revoking API key:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
