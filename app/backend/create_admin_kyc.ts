import { prisma } from './prisma';

async function createAdminKyc() {
  try {
    // Find the admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@admin.com' }
    });

    if (!adminUser) {
      console.log('Admin user not found');
      return;
    }

    // Check if KYC already exists
    const existingKyc = await prisma.kyc.findFirst({
      where: { userId: adminUser.id }
    });

    if (existingKyc) {
      console.log('Admin KYC already exists');
      return;
    }

    // Create KYC record
    const kyc = await prisma.kyc.create({
      data: {
        userId: adminUser.id,
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verificationSource: 'ADMIN_SETUP',
        verifiedBy: 'SYSTEM'
      }
    });

    console.log('Admin KYC created successfully:', kyc);
  } catch (error) {
    console.error('Error creating admin KYC:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminKyc();
