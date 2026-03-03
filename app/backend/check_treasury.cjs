const https = require('https');
const fs = require('fs');

https.get('https://horizon-testnet.stellar.org/accounts/GAQSTTMR5P4YBJ3ZVE3HQ46QA2RED3VSNHGVLF5PHBDVOXW5Z5SSPPG2', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('treasury-flags.json', data);
    console.log("File written");
  });
}).on('error', (e) => {
  console.error(e);
});
