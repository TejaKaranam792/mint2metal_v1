import { PrismaClient } from '@prisma/client';
import { sign } from 'jsonwebtoken';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const root = __dirname;
const env = readFileSync(join(root, '.env'), 'utf8');
const jwtSecretMatch = env.match(/JWT_SECRET="?([^"\n\r]+)"?/);
const jwtSecret = jwtSecretMatch ? jwtSecretMatch[1] : 'fallback';

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  if (!admin) {
    writeFileSync(join(root, 'token.txt'), 'No Admin User Found', 'utf8');
    return;
  }

  const token = sign(
    { id: admin.id, role: admin.role, email: admin.email },
    jwtSecret,
    { expiresIn: '1h' }
  );

  writeFileSync(join(root, 'token.txt'), token, 'utf8');
}

main()
  .catch(e => {
    writeFileSync(join(root, 'token.txt'), 'ERROR: ' + e.message, 'utf8');
  })
  .finally(() => prisma.$disconnect());
