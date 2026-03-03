import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const treasuryPub = process.env.TREASURY_PUBLIC_KEY;

async function fund() {
  if (!treasuryPub) {
    console.error('❌ TREASURY_PUBLIC_KEY not found in .env');
    process.exit(1);
  }

  console.log(`⏳ Funding ${treasuryPub} via Friendbot...`);
  try {
    const res = await fetch(`https://friendbot.stellar.org/?addr=${treasuryPub}`);
    const data = await res.json();
    console.log('✅ Friendbot response:', data);
  } catch (e) {
    console.error('❌ Failed to fund:', e);
  }
}

fund();
