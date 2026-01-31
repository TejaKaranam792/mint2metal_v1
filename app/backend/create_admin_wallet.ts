import fetch from 'node-fetch';

async function createAdminWallet() {
  try {
    console.log('Creating wallet for admin user...');

    // First, login as admin
    const loginResponse = await fetch('http://localhost:4000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@admin.com',
        password: 'admin123'
      }),
    });

    const loginData = await loginResponse.json();
    console.log('Admin login response:', loginData);

    if (!loginResponse.ok || !loginData.token) {
      console.error('Admin login failed');
      return;
    }

    // Now create wallet
    const walletResponse = await fetch('http://localhost:4000/wallet/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.token}`
      },
    });

    const walletData = await walletResponse.json();
    console.log('Wallet creation response:', walletData);
    console.log('Wallet creation status:', walletResponse.status);

  } catch (error) {
    console.error('Wallet creation failed:', error);
  }
}

createAdminWallet();
