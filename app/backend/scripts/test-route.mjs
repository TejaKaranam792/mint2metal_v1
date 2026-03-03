async function test() {
  try {
    const res = await fetch('http://localhost:4000/admin/treasury/balance');
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.slice(0, 100));
  } catch (e) {
    console.error('Failed to fetch:', e);
  }
}
test();
