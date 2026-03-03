import { Keypair } from '@stellar/stellar-sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually
const envText = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const [k, ...v] = l.split('=');
      return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')];
    })
);

const adminSecret = env['STELLAR_ADMIN_SECRET'] || env['ADMIN_SECRET'];
if (!adminSecret) {
  console.error('❌ No STELLAR_ADMIN_SECRET in .env');
  process.exit(1);
}

const adminPub = Keypair.fromSecret(adminSecret).publicKey();
console.log('Admin public key:', adminPub);

// Check if account exists on testnet
const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${adminPub}`);
if (res.status === 404) {
  console.log('💰 Account not found. Funding via Friendbot...');
  const fundRes = await fetch(`https://friendbot.stellar.org?addr=${adminPub}`);
  const fundData = await fundRes.json();
  if (fundRes.ok) {
    console.log('✅ Funded! Tx hash:', fundData.hash || fundData.id);
  } else {
    console.error('❌ Friendbot failed:', JSON.stringify(fundData));
    process.exit(1);
  }
} else {
  const data = await res.json();
  const xlmBalance = data.balances?.find(b => b.asset_type === 'native')?.balance || '0';
  console.log('✅ Account exists. XLM Balance:', xlmBalance);
  if (parseFloat(xlmBalance) < 10) {
    console.log('⚠️ Low balance. Topping up via Friendbot...');
    await fetch(`https://friendbot.stellar.org?addr=${adminPub}`);
    console.log('✅ Top-up requested.');
  }
}

// Also generate treasury keypair info if missing
if (!env['TREASURY_SECRET']) {
  const kp = Keypair.random();
  console.log('\n🏦 New Treasury Buffer wallet generated (add to .env):');
  console.log(`TREASURY_SECRET=${kp.secret()}`);
  console.log(`TREASURY_PUBLIC_KEY=${kp.publicKey()}`);
  console.log('\n⚠️ Fund the Treasury wallet too via: https://friendbot.stellar.org?addr=' + kp.publicKey());
} else {
  const treasuryPub = Keypair.fromSecret(env['TREASURY_SECRET']).publicKey();
  console.log('\n🏦 Treasury public key:', treasuryPub);
}
