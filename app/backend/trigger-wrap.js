const http = require('http');

const req = http.get('http://localhost:4000/admin/wrap-asset', (res) => {
  let chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => console.log('Response:', Buffer.concat(chunks).toString()));
});

req.on('error', (e) => console.error('Error:', e));
