import fetch from 'node-fetch';

async function testMintAPI() {
  try {
    console.log('Testing mint intent API...');

    // First, login to get a token
    const loginResponse = await fetch('http://localhost:4000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'hashedpassword' // This won't work, but let's see the error
      }),
    });

    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);

    if (!loginResponse.ok) {
      console.log('Login failed, trying admin login...');

      const adminLoginResponse = await fetch('http://localhost:4000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@admin.com',
          password: 'admin123'
        }),
      });

      const adminLoginData = await adminLoginResponse.json();
      console.log('Admin login response:', adminLoginData);

      if (adminLoginResponse.ok && adminLoginData.token) {
        // Now try mint intent
        const mintResponse = await fetch('http://localhost:4000/mint/initiate-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminLoginData.token}`
          },
          body: JSON.stringify({ requestedGrams: 100 }),
        });

        const mintData = await mintResponse.json();
        console.log('Mint intent response:', mintData);
        console.log('Mint intent status:', mintResponse.status);
      }
    }

  } catch (error) {
    console.error('API test failed:', error);
  }
}

testMintAPI();
