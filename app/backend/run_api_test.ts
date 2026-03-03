const API_KEY = "m2m_69916217cd5131b7e6b439b4149ad2485d9fd7c2071d7696bc109e67d0bff2dd";
const BASE = "http://localhost:4000";

async function test(label: string, url: string, expectOk: boolean) {
  try {
    const res = await fetch(url, { headers: { "x-api-key": API_KEY } });
    const body = await res.json();
    const ok = res.ok === expectOk;
    console.log(`${ok ? "✅" : "❌"} [${res.status}] ${label}:`, JSON.stringify(body).slice(0, 200));
  } catch (err: any) {
    console.error(`❌ ${label} ERROR:`, err.message);
  }
}

async function testBlocked(label: string, url: string) {
  try {
    const res = await fetch(url); // No API key
    const body = await res.json();
    const blocked = res.status === 401;
    console.log(`${blocked ? "✅" : "❌"} [${res.status}] ${label} (no key, should be 401):`, JSON.stringify(body).slice(0, 100));
  } catch (err: any) {
    console.error(`❌ ${label} ERROR:`, err.message);
  }
}

(async () => {
  console.log("=== B2B API Key Integration Test ===\n");

  // Valid key tests
  await test("GET /b2b/silver-price (with key)", `${BASE}/b2b/silver-price`, true);
  await test("GET /b2b/vault-status (with key)", `${BASE}/b2b/vault-status`, true);
  await test("GET /b2b/treasury-balance (with key)", `${BASE}/b2b/treasury-balance`, true);

  // Blocked without key
  await testBlocked("GET /b2b/silver-price (no key)", `${BASE}/b2b/silver-price`);
  await testBlocked("GET /b2b/vault-status (no key)", `${BASE}/b2b/vault-status`);

  console.log("\n=== Test Complete ===");
})();
