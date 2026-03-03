const http = require('https');

http.get('https://horizon-testnet.stellar.org/claimable_balances?claimant=GD275XUQFID3TPHVUQSKU3OJXIB5TI3KJOAFWIDSQN3LBLU6EOZMHH7T', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    require('fs').writeFileSync('cbs.json', data);
  });
});
