import { prisma } from "../prisma";
import { AuditService, AuditAction } from "./audit.service";

export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum AMLStatus {
  PENDING = "PENDING",
  CLEARED = "CLEARED",
  FLAGGED = "FLAGGED",
  BLOCKED = "BLOCKED",
}

export class AMLService {
  // Risk scoring factors
  private static readonly HIGH_RISK_COUNTRIES = [
    "AFGHANISTAN", "IRAN", "NORTH KOREA", "SYRIA", "CUBA", "VENEZUELA"
  ];

  private static readonly MEDIUM_RISK_COUNTRIES = [
    "RUSSIA", "CHINA", "PAKISTAN", "SAUDI ARABIA", "UAE", "QATAR"
  ];

  private static readonly SUSPICIOUS_KEYWORDS = [
    "crypto", "bitcoin", "ethereum", "money laundering", "tax evasion",
    "sanctions", "terrorism", "fraud", "scam", "hack"
  ];

  static async calculateRiskScore(user: any, transactionAmount?: number): Promise<{ score: number; level: RiskLevel; reasons: string[] }> {
    let score = 0;
    const reasons: string[] = [];

    // Country-based risk
    if (this.HIGH_RISK_COUNTRIES.includes(user.country?.toUpperCase())) {
      score += 50;
      reasons.push(`High-risk country: ${user.country}`);
    } else if (this.MEDIUM_RISK_COUNTRIES.includes(user.country?.toUpperCase())) {
      score += 25;
      reasons.push(`Medium-risk country: ${user.country}`);
    }

    // Transaction amount risk
    if (transactionAmount) {
      if (transactionAmount > 100000) {
        score += 40;
        reasons.push(`Large transaction amount: $${transactionAmount}`);
      } else if (transactionAmount > 50000) {
        score += 20;
        reasons.push(`Medium transaction amount: $${transactionAmount}`);
      }
    }

    // User behavior patterns
    const userTransactions = await this.getUserTransactionHistory(user.id);
    const recentTransactions = userTransactions.filter(t =>
      new Date(t.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    if (recentTransactions.length > 10) {
      score += 15;
      reasons.push(`High transaction frequency: ${recentTransactions.length} in 24h`);
    }

    // Check for suspicious patterns
    const totalVolume = recentTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    if (totalVolume > 50000) {
      score += 20;
      reasons.push(`High daily volume: $${totalVolume}`);
    }

    // Determine risk level
    let level: RiskLevel;
    if (score >= 70) level = RiskLevel.CRITICAL;
    else if (score >= 40) level = RiskLevel.HIGH;
    else if (score >= 20) level = RiskLevel.MEDIUM;
    else level = RiskLevel.LOW;

    return { score, level, reasons };
  }

  static async assessUserRisk(userId: string): Promise<{ status: AMLStatus; riskLevel: RiskLevel; score: number; reasons: string[] }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { auditLogs: { orderBy: { createdAt: "desc" }, take: 20 } }
    });

    if (!user) {
      throw new Error("User not found");
    }

    const { score, level, reasons } = await this.calculateRiskScore(user);

    // Update user AML status based on risk
    let status = AMLStatus.CLEARED;
    if (level === RiskLevel.CRITICAL) {
      status = AMLStatus.BLOCKED;
    } else if (level === RiskLevel.HIGH) {
      status = AMLStatus.FLAGGED;
    }

    // Update user record
    await prisma.user.update({
      where: { id: userId },
      data: { amlStatus: status as any }
    });

    // Log AML assessment
    await AuditService.logAction(
      userId,
      status === AMLStatus.BLOCKED ? AuditAction.AML_FLAG_RAISED : AuditAction.AML_CLEARED,
      undefined,
      { riskScore: score, riskLevel: level, reasons, newStatus: status },
      undefined,
      undefined
    );

    return { status, riskLevel: level, score, reasons };
  }

  static async monitorTransaction(userId: string, transactionType: string, amount: number, details?: any): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;

    const riskAssessment = await this.calculateRiskScore(user, amount);

    // Flag high-risk transactions
    if (riskAssessment.level === RiskLevel.CRITICAL || riskAssessment.level === RiskLevel.HIGH) {
      await AuditService.logAction(
        userId,
        AuditAction.AML_FLAG_RAISED,
        transactionType,
        {
          amount,
          riskScore: riskAssessment.score,
          riskLevel: riskAssessment.level,
          reasons: riskAssessment.reasons,
          ...details
        },
        undefined,
        undefined
      );

      // Update user status if critical
      if (riskAssessment.level === RiskLevel.CRITICAL) {
        await prisma.user.update({
          where: { id: userId },
          data: { amlStatus: "BLOCKED" as any }
        });
      }

      return true; // Transaction flagged
    }

    return false; // Transaction approved
  }

  static async getFlaggedUsers(): Promise<any[]> {
    return prisma.user.findMany({
      where: {
        OR: [
          { amlStatus: "FLAGGED" as any },
          { amlStatus: "BLOCKED" as any }
        ]
      },
      include: {
        auditLogs: {
          where: {
            action: {
              in: [AuditAction.AML_FLAG_RAISED, AuditAction.AML_CLEARED]
            }
          },
          orderBy: { createdAt: "desc" },
          take: 5
        }
      }
    });
  }

  static async clearUserFlag(userId: string, adminId: string, reason: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { amlStatus: "CLEARED" as any }
    });

    await AuditService.logAction(
      userId,
      AuditAction.AML_CLEARED,
      undefined,
      { clearedBy: adminId, reason },
      undefined,
      undefined
    );
  }

  static async getUserTransactionHistory(userId: string): Promise<any[]> {
    // Get all financial transactions for the user
    const [mints, redemptions, loans] = await Promise.all([
      prisma.dSTMint.findMany({
        where: { wallet: { userId } },
        select: { amount: true, mintedAt: true }
      }),
      prisma.redemption.findMany({
        where: { userId },
        select: { quantity: true, requestedAt: true }
      }),
      prisma.loan.findMany({
        where: { userId },
        select: { amount: true, createdAt: true }
      })
    ]);

    return [
      ...mints.map(m => ({ type: 'mint', amount: m.amount, createdAt: m.mintedAt })),
      ...redemptions.map(r => ({ type: 'redemption', amount: r.quantity, createdAt: r.requestedAt })),
      ...loans.map(l => ({ type: 'loan', amount: l.amount, createdAt: l.createdAt }))
    ].sort((a, b) => new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime());
  }

  static async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    const flaggedUsers = await this.getFlaggedUsers();
    const suspiciousActivities = await AuditService.getSuspiciousActivities();

    const totalUsers = await prisma.user.count();
    const clearedUsers = await prisma.user.count({ where: { amlStatus: "CLEARED" } });
    const flaggedCount = await prisma.user.count({ where: { amlStatus: "FLAGGED" } });
    const blockedCount = await prisma.user.count({ where: { amlStatus: "BLOCKED" as any } });

    return {
      period: { startDate, endDate },
      summary: {
        totalUsers,
        clearedUsers,
        flaggedUsers: flaggedCount,
        blockedUsers: blockedCount,
        complianceRate: (clearedUsers / totalUsers) * 100
      },
      flaggedUsers,
      suspiciousActivities,
      generatedAt: new Date()
    };
  }
}
