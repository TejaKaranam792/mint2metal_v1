import { checkContractConnection } from './lib/checkContractConnection';

async function test() {
  try {
    const result = await checkContractConnection();
    console.log('Contract connection status:', result);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();
