import { prisma } from "../prisma";

/**
 * Start KYC process
 */
export async function startKYC(userId: string, levelName: string = 'basic-kyc-level') {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  // Check if already in review or verified
  if (user.kycStatus === 'IN_REVIEW' || user.kycStatus === 'VERIFIED') {
    throw new Error("KYC already started or verified");
  }

  // Create KycRecord
  const kycRecord = await prisma.kycRecord.create({
    data: {
      userId,
      kycLevel: levelName,
    },
  });

  // Update user status
  await prisma.user.update({
    where: { id: userId },
    data: { kycStatus: 'IN_REVIEW' },
  });

  return { kycId: kycRecord.id };
}

/**
 * Get KYC status for a user
 */
export async function getKYCStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycStatus: true },
  });

  if (!user) throw new Error("User not found");

  let message = "";
  switch (user.kycStatus) {
    case 'NOT_STARTED':
      message = "KYC not started";
      break;
    case 'IN_REVIEW':
      message = "KYC is under review";
      break;
    case 'VERIFIED':
      message = "KYC verified";
      break;
    case 'REJECTED':
      message = "KYC rejected";
      break;
  }

  return { status: user.kycStatus, message };
}



/**
 * Get all KYC records for admin
 */
export async function getAllKYC() {
  return prisma.user.findMany({
    where: {
      kycStatus: 'IN_REVIEW'
    },
    select: {
      id: true,
      email: true,
      country: true,
      kycStatus: true,
      kycRecords: {
        select: {
          id: true,
          kycLevel: true,
          submittedAt: true,
        },
      },
    },
  });
}

/**
 * Approve KYC for admin
 */
export async function approveKYC(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  await prisma.user.update({
    where: { id: userId },
    data: { kycStatus: 'VERIFIED' },
  });

  return { success: true, message: "KYC approved" };
}

/**
 * Reject KYC for admin
 */
export async function rejectKYC(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  await prisma.user.update({
    where: { id: userId },
    data: { kycStatus: 'REJECTED' },
  });

  return { success: true, message: "KYC rejected" };
}

/**
 * Submit KYC (called when user submits via SDK)
 */
export async function submitKYC(userId: string, documentData?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  // Find the latest KYC record
  let kycRecord = await prisma.kycRecord.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  // If no KYC record exists, create one (fallback for cases where startKYC wasn't called)
  if (!kycRecord) {
    kycRecord = await prisma.kycRecord.create({
      data: {
        userId,
        kycLevel: 'basic-kyc-level',
      },
    });
  }

  // Update KYC record as submitted
  const updateData: any = { submittedAt: new Date() };
  if (documentData) {
    updateData.documentRef = documentData;
  }

  await prisma.kycRecord.update({
    where: { id: kycRecord.id },
    data: updateData,
  });

  // Update user status to IN_REVIEW if not already
  if (user.kycStatus === 'NOT_STARTED') {
    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: 'IN_REVIEW' },
    });
  }

  return { success: true, message: "KYC submitted successfully" };
}
