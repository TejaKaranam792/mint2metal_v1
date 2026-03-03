import { prisma } from "../prisma";
import crypto from "crypto";

export class ApiKeyService {
  /**
   * Generate a new API Key for a user (API_INTEGRATOR)
   */
  static async generateApiKey(userId: string, name: string, permissions: string[] = ["READ_ONLY"]) {
    // Generate a secure random key
    const rawKey = crypto.randomBytes(32).toString("hex");
    const keyPrefix = "m2m_";
    const apiKey = `${keyPrefix}${rawKey}`;

    // Hash the key for storage
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    // Store in DB
    const record = await prisma.apiKey.create({
      data: {
        userId,
        keyHash,
        name,
        permissions,
      },
    });

    return { apiKey, record }; // The raw apiKey is only returned once
  }

  /**
   * Validate an API Key
   */
  static async validateApiKey(apiKey: string) {
    if (!apiKey || !apiKey.startsWith("m2m_")) return null;

    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    const record = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!record || !record.isActive) return null;

    if (record.expiresAt && record.expiresAt < new Date()) {
      return null;
    }

    // Update last used (fire and forget to not block the request)
    prisma.apiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    }).catch((err: any) => console.error("Failed to update API key lastUsedAt:", err));

    return record;
  }
}
