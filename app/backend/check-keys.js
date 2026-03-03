const { Keypair } = require('@stellar/stellar-sdk');
const fs = require('fs');

const pk1 = Keypair.fromSecret('SCUR3RJGLFHLHQQZNZCKPURBDI4CVN437GGHK53QMFA7GNEH2VAJXCCL').publicKey();
const pk2 = Keypair.fromSecret('SAUNYDIJ2PFY6BPKERHOUWR26HRN7HPVZNQ2TA4BBOK2MUPO6CKUJWTF').publicKey();

fs.writeFileSync('keys.txt', `STELLAR_ADMIN_SECRET: ${pk1}\nTREASURY_SECRET: ${pk2}\n`);
