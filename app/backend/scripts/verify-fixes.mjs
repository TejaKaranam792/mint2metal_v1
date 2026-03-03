import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { sorobanService } from '../services/soroban.service.js';

async function verify() {
  const treasuryPub = process.env.TREASURY_PUBLIC_KEY;
  if (!treasuryPub) {
    console.error('❌ TREASURY_PUBLIC_KEY not found');
    return;
  }

  console.log(`⏳ Fetching balance for ${treasuryPub}...`);
  try {
    const balance = await sorobanService.getBalance(treasuryPub);
    console.log(`✅ Balance: ${balance} grams`);
  } catch (e) {
    console.error('❌ Failed:', e);
  }
}

verify();
