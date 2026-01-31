import { prisma } from "../prisma";

export enum AuditAction {
  USER_REGISTERED = "USER_REGISTERED",
  USER_LOGIN = "USER_LOGIN",
  USER_LOGOUT = "USER_LOGOUT",
  KYC_SUBMITTED = "KYC_SUBMITTED",
  KYC_APPROVED = "KYC_APPROVED",
  KYC_REJECTED = "KYC_REJECTED",
  MINT_REQUESTED = "MINT_REQUESTED",
  MINT_APPROVED = "MINT_APPROVED",
  MINT_COMPLETED = "MINT_COMPLETED",
  DST_MINT = "DST_MINT",
  DST_BURN = "DST_BURN",
  REDEMPTION_REQUESTED = "REDEMPTION_REQUESTED",
  REDEMPTION_APPROVED = "REDEMPTION_APPROVED",
  REDEMPTION_COMPLETED = "REDEMPTION_COMPLETED",
  REDEMPTION_REJECTED = "REDEMPTION_REJECTED",
  LOAN_REQUESTED = "LOAN_REQUESTED",
  LOAN_APPROVED = "LOAN_APPROVED",
  LOAN_REPAID = "LOAN_REPAID",
  LOAN_LIQUIDATED = "LOAN_LIQUIDATED",
  TRADE_EXECUTED = "TRADE_EXECUTED",
  BALANCE_TRANSFER = "BALANCE_TRANSFER",
  TWO_FA_ENABLED = "TWO_FA_ENABLED",
  TWO_FA_DISABLED = "TWO_FA_DISABLED",
  ADMIN_ACTION = "ADMIN_ACTION",
  AML_FLAG_RAISED = "AML_FLAG_RAISED",
  AML_CLEARED = "AML_CLEARED",
  AML_SUBMITTED = "AML_SUBMITTED",
}

export class AuditService {
  static async logAction(
    userId: string,
    action: AuditAction,
    reference?: string,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          reference,
          details: details ? JSON.stringify(details) : undefined,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      console.error("Failed to log audit action:", error);
      // Don't throw error to avoid breaking main flow
    }
  }

  static async getUserAuditLogs(userId: string, limit: number = 50) {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  static async getAuditLogsByAction(action: AuditAction, limit: number = 100) {
    return prisma.auditLog.findMany({
      where: { action },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  static async getAuditLogsByDateRange(startDate: Date, endDate: Date) {
    return prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getSuspiciousActivities() {
    // Get logs for high-risk actions in the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return prisma.auditLog.findMany({
      where: {
        action: {
          in: [AuditAction.AML_FLAG_RAISED, AuditAction.KYC_REJECTED],
        },
        createdAt: {
          gte: yesterday,
        },
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
