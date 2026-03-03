import { PrismaClient } from '@prisma/client';
import { ApiKeyService } from './services/api-key.service';

const prisma = new PrismaClient();

async function testB2B() {
  console.log("Starting B2B API Key Test...");

  // 1. Find or create an API_INTEGRATOR user
  let integrator = await prisma.user.findFirst({
    where: { role: 'API_INTEGRATOR' }
  });

  if (!integrator) {
    console.log("No API_INTEGRATOR found. Searching for Admin...");
    integrator = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!integrator) {
      console.log("Creating temporary test user...");
      integrator = await prisma.user.create({
        data: {
          email: "test_b2b@mint2metal.com",
          role: "API_INTEGRATOR",
          country: "INDIA"
        }
      });
    }
  }

  console.log(`Using User ID for test: ${integrator.id} (${integrator.role})`);

  // 2. Generate an API Key programmatically
  console.log("\nGenerating API Key...");
  const { apiKey, record } = await ApiKeyService.generateApiKey(
    integrator.id,
    "Test Integration Script",
    ["READ_ONLY", "TRADE"]
  );

  console.log(`✅ Plaintext API Key Generated: ${apiKey}`);
  console.log(`✅ Database Key Hash: ${record.keyHash}`);

  // 3. Test Validation Logic directly
  console.log("\nTesting Validation Logic...");
  const validated = await ApiKeyService.validateApiKey(apiKey);

  if (validated && validated.user.id === integrator.id) {
    console.log("✅ API Key successfully validated by service!");
  } else {
    console.error("❌ API Key validation FAILED.");
    process.exit(1);
  }

  const badKey = await ApiKeyService.validateApiKey("m2m_invalid_key_123");
  if (!badKey) {
    console.log("✅ Invalid API Key correctly rejected.");
  } else {
    console.error("❌ Invalid API Key incorrectly accepted!");
    process.exit(1);
  }

  // 4. Test revocation
  console.log("\nRevoking Key...");
  await prisma.apiKey.update({
    where: { id: record.id },
    data: { isActive: false }
  });

  const revokedValidation = await ApiKeyService.validateApiKey(apiKey);
  if (!revokedValidation) {
    console.log("✅ Revoked API Key correctly rejected.");
  } else {
    console.error("❌ Revoked API Key incorrectly accepted!");
    process.exit(1);
  }

  console.log("\n🎉 All B2B backend logic tests PASSED.");
}

testB2B().catch(console.error).finally(() => prisma.$disconnect());
