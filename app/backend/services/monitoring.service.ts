import { prisma } from '../prisma';

export class MonitoringService {
  async getSystemStats() {
    try {
      const userCount = await prisma.user.count();
      const mintCount = await prisma.dSTMint.count();
      const loanCount = await prisma.loan.count();

      return {
        userCount,
        mintCount,
        loanCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching system stats:', error);
      throw new Error('Failed to fetch system statistics');
    }
  }

  async getTransactionVolume(timeframe: string = '30d') {
    try {
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const mints = await prisma.dSTMint.findMany({
        where: {
          mintedAt: {
            gte: startDate,
          },
          status: 'MINTED',
        },
        select: {
          amount: true,
          mintedAt: true,
        },
      });

      return mints;
    } catch (error) {
      console.error('Error fetching transaction volume:', error);
      throw new Error('Failed to fetch transaction volume');
    }
  }

  async getUserActivity() {
    try {
      // Count users who have logged in within the last 30 days based on audit logs
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const activeUserIds = await prisma.auditLog.findMany({
        where: {
          action: 'USER_LOGIN',
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
        select: {
          userId: true,
        },
        distinct: ['userId'],
      });

      const activeUsers = activeUserIds.length;

      return {
        activeUsers,
        totalUsers: await prisma.user.count(),
      };
    } catch (error) {
      console.error('Error fetching user activity:', error);
      throw new Error('Failed to fetch user activity');
    }
  }
}
