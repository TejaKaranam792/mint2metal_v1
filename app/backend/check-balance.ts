// check-balance.ts
import { sorobanService } from './services/soroban.service';
import * as dotenv from 'dotenv';
dotenv.config();

async function check() {
  const b = await sorobanService.getBalance(process.env.TREASURY_PUBLIC_KEY!);
  console.log("TREASURY BALANCE:", b);
}
check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
