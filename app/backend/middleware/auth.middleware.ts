import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiKeyService } from "../services/api-key.service";

export interface AuthenticatedUser {
  id: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  apiKey?: any;
}

/**
 * Middleware that authenticates either via standard JWT (Bearer) OR API Key (x-api-key header)
 */
export const authenticateTokenOrApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // 1. Check for API Key first (common for B2B/Institutional integrators)
  const apiKeyHeader = req.headers["x-api-key"] as string;

  if (apiKeyHeader) {
    try {
      const apiKeyRecord = await ApiKeyService.validateApiKey(apiKeyHeader);
      if (!apiKeyRecord) {
        return res.status(401).json({ error: "Invalid or expired API Key" });
      }

      // Mount the user from the API Key record
      req.user = {
        id: apiKeyRecord.user.id,
        role: apiKeyRecord.user.role,
      };
      req.apiKey = apiKeyRecord; // Store full permissions etc.
      return next();
    } catch (error) {
      console.error("API Key Validation Error:", error);
      return res.status(500).json({ error: "Internal Server Error during API Key validation" });
    }
  }

  // 2. Fallback to standard JWT (for dashboard users)
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token or API Key required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
    req.user = decoded as AuthenticatedUser;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired access token" });
  }
};

/**
 * Strict middleware demanding ONLY an API Key. Suitable for high-privilege infrastructure APIs.
 */
export const requireApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const apiKeyHeader = req.headers["x-api-key"] as string;

  if (!apiKeyHeader) {
    return res.status(401).json({ error: "API Key required for this endpoint" });
  }

  try {
    const apiKeyRecord = await ApiKeyService.validateApiKey(apiKeyHeader);
    if (!apiKeyRecord) {
      return res.status(401).json({ error: "Invalid or expired API Key" });
    }

    req.user = {
      id: apiKeyRecord.user.id,
      role: apiKeyRecord.user.role,
    };
    req.apiKey = apiKeyRecord;
    next();
  } catch (error) {
    console.error("API Key Validation Error:", error);
    return res.status(500).json({ error: "Internal Server Error during API Key validation" });
  }
};
