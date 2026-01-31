import { prisma } from "../prisma";

/**
 * Request a loan
 */
export async function requestLoan(userId: string, collateralGrams: number, requestedAmount: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  // Admin users are exempt from KYC requirements
  if (user.role !== 'ADMIN' && user.kycStatus !== 'VERIFIED') {
    throw new Error("KYC must be verified to request a loan");
  }

  const loanRequest = await prisma.loanRequest.create({
    data: {
      userId,
      collateralGrams,
      requestedAmount,
    },
  });

  return loanRequest;
}

/**
 * Get user's loan requests
 */
export async function getUserLoans(userId: string) {
  return prisma.loanRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Approve loan request (admin)
 */
export async function approveLoan(loanId: string) {
  const loan = await prisma.loanRequest.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error("Loan request not found");

  await prisma.loanRequest.update({
    where: { id: loanId },
    data: { status: 'APPROVED' },
  });

  return { success: true, message: "Loan approved" };
}

/**
 * Reject loan request (admin)
 */
export async function rejectLoan(loanId: string) {
  const loan = await prisma.loanRequest.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error("Loan request not found");

  await prisma.loanRequest.update({
    where: { id: loanId },
    data: { status: 'REJECTED' },
  });

  return { success: true, message: "Loan rejected" };
}

/**
 * Alias for requestLoan
 */
export async function applyForLoan(userId: string, collateralGrams: number, requestedAmount: number) {
  return requestLoan(userId, collateralGrams, requestedAmount);
}

/**
 * Calculate loan terms (placeholder implementation)
 */
export async function calculateLoanTerms(collateralGrams: number, requestedAmount: number) {
  // Simple calculation: loan amount = collateral * 0.8 (80% LTV)
  const maxLoanAmount = collateralGrams * 0.8;
  const interestRate = 0.05; // 5% annual interest
  const termMonths = 12;

  if (requestedAmount > maxLoanAmount) {
    throw new Error(`Requested amount exceeds maximum loan amount of ${maxLoanAmount}`);
  }

  return {
    maxLoanAmount,
    requestedAmount,
    interestRate,
    termMonths,
    monthlyPayment: (requestedAmount * (1 + interestRate)) / termMonths,
  };
}

/**
 * Get pending loan requests (admin)
 */
export async function getPendingLoanRequests() {
  return prisma.loanRequest.findMany({
    where: { status: 'PENDING_APPROVAL' },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          kycStatus: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Approve loan request (admin)
 */
export async function approveLoanRequest(loanId: string, adminId: string) {
  const loan = await prisma.loanRequest.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error("Loan request not found");

  await prisma.loanRequest.update({
    where: { id: loanId },
    data: {
      status: 'APPROVED',
    },
  });

  return { success: true, message: "Loan request approved" };
}

/**
 * Reject loan request (admin)
 */
export async function rejectLoanRequest(loanId: string, adminId: string) {
  const loan = await prisma.loanRequest.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error("Loan request not found");

  await prisma.loanRequest.update({
    where: { id: loanId },
    data: {
      status: 'REJECTED',
    },
  });

  return { success: true, message: "Loan request rejected" };
}

export const loanService = {
  requestLoan,
  applyForLoan,
  getUserLoans,
  approveLoan,
  rejectLoan,
  calculateLoanTerms,
  getPendingLoanRequests,
  approveLoanRequest,
  rejectLoanRequest,
};
