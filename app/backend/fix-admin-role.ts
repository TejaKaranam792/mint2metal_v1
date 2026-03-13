import { prisma } from './prisma';
import { UserRole } from '@prisma/client';

async function checkAndFixAdmin() {
  const email = 'admin@admin.com';
  console.log(`Checking user: ${email}`);

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    console.log(`User ${email} not found.`);
    return;
  }

  console.log(`Current role: ${user.role}`);

  if (user.role !== UserRole.ADMIN) {
    console.log(`Updating role to ADMIN...`);
    await prisma.user.update({
      where: { email },
      data: { role: UserRole.ADMIN }
    });
    console.log(`Role updated successfully.`);
  } else {
    console.log(`User already has ADMIN role.`);
  }
}

checkAndFixAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
