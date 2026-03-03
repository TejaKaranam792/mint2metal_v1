'use strict';
const { writeFileSync } = require('fs');
try {
  writeFileSync('probe-test.txt', 'PROBE OK: ' + new Date().toISOString(), 'utf8');
} catch (e) {
  // nothing
}
