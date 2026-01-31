import { prisma } from './prisma';
import bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

async function createAdminUser() {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@admin.com' }
    });

    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@admin.com',
        password: hashedPassword,
        role: UserRole.ADMIN,
        country: 'INDIA',
        kycStatus: 'VERIFIED',
        amlStatus: 'CLEARED'
      }
    });

    console.log('Admin user created successfully:', adminUser.email);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
