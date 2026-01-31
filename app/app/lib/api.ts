/* =====================================================
   GLOBAL CONFIG
===================================================== */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/* =====================================================
   GLOBAL LOGOUT HANDLING
===================================================== */
let globalLogout: (() => void) | null = null;

export function setGlobalLogout(logoutFn: () => void) {
  globalLogout = logoutFn;
}

/* =====================================================
   AUTH HEADERS
===================================================== */
function getAuthHeaders(): Record<string, string> {
  try {
    const stored = localStorage.getItem("auth");
    if (!stored) return { "Content-Type": "application/json" };

    const { token } = JSON.parse(stored);
    if (!token) return { "Content-Type": "application/json" };

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

/* =====================================================
   API FETCH WRAPPER
===================================================== */
async function apiFetch(
  url: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<Response> {
  const maxRetries = 3;
  const baseDelay = 1000;

  try {
    const res = await fetch(url, options);

    if (res.status === 429 && retryCount < maxRetries) {
      await new Promise((r) =>
        setTimeout(r, baseDelay * Math.pow(2, retryCount))
      );
      return apiFetch(url, options, retryCount + 1);
    }

    if (res.status === 401 || res.status === 403) {
      console.warn("Auth error → logging out");
      globalLogout?.();
    }

    return res;
  } catch (err) {
    if (retryCount < maxRetries) {
      await new Promise((r) =>
        setTimeout(r, baseDelay * Math.pow(2, retryCount))
      );
      return apiFetch(url, options, retryCount + 1);
    }
    throw err;
  }
}

/* =====================================================
   AUTH
===================================================== */
export async function signup(email: string, password: string, country: string) {
  const res = await apiFetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, country }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data?.error : data?.error?.message || "Signup failed");
  return data;
}

export async function login(
  email: string,
  password: string,
  twoFactorCode?: string
) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, twoFactorCode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data?.error : data?.error?.message || "Login failed");

  if (data?.token) {
    localStorage.setItem("auth", JSON.stringify({ token: data.token }));
  }
  return data;
}

/* =====================================================
   KYC (USER)
===================================================== */
export async function getKYCStatus() {
  const res = await apiFetch(`${API_URL}/kyc/status`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch KYC status");
  return data;
}

export async function startKYC() {
  const res = await apiFetch(`${API_URL}/kyc/start`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to start KYC");
  return data;
}

export async function submitKYC(data: any) {
  const res = await apiFetch(`${API_URL}/kyc/submit`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "KYC submission failed");
  return json;
}

/* =====================================================
   ADMIN – KYC
===================================================== */
export async function getAllKYC() {
  const res = await apiFetch(`${API_URL}/admin/kyc`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch KYC records");
  return Array.isArray(data) ? data : data?.data ?? [];
}

export async function adminApproveKYC(userId: string) {
  const res = await apiFetch(`${API_URL}/admin/kyc/${userId}/approve`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Approve KYC failed");
  return data;
}

export async function adminRejectKYC(userId: string, reason: string) {
  const res = await apiFetch(`${API_URL}/admin/kyc/${userId}/reject`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Reject KYC failed");
  return data;
}

/* =====================================================
   ADMIN – USERS
===================================================== */
export async function getAdminUsers() {
  const res = await apiFetch(`${API_URL}/admin/users`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch users");
  return data;
}

export async function updateUserRole(userId: string, role: string) {
  const res = await apiFetch(`${API_URL}/admin/user/${userId}/role`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Update role failed");
  return data;
}

export async function freezeUser(userId: string, frozen: boolean) {
  const res = await apiFetch(`${API_URL}/admin/user/${userId}/freeze`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ frozen }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Freeze user failed");
  return data;
}

/* =====================================================
   ADMIN – TRANSACTIONS & ANALYTICS
===================================================== */
export async function getAdminTransactions() {
  const res = await apiFetch(`${API_URL}/admin/transactions`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch transactions");
  return data;
}

export async function updateTransactionStatus(
  transactionId: string,
  status: string
) {
  const res = await apiFetch(
    `${API_URL}/admin/transaction/${transactionId}/status`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Update transaction failed");
  return data;
}

export async function getAdminAnalytics() {
  const res = await apiFetch(`${API_URL}/admin/analytics`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch analytics");
  return data;
}

/* =====================================================
   BALANCES
===================================================== */
export async function getSilverBalance() {
  const res = await apiFetch(`${API_URL}/silver/balance`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch silver balance");
  return data;
}

export async function getDSTBalance() {
  const res = await apiFetch(`${API_URL}/user/dst-balance`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch DST balance");
  return data;
}

/* =====================================================
   ORDERS / TRADING
===================================================== */
export async function createBuyOrder(quantityGrams: number) {
  const res = await apiFetch(`${API_URL}/orders/buy`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ quantityGrams }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Create order failed");
  return data;
}

export async function confirmOrder(orderId: string) {
  const res = await apiFetch(`${API_URL}/orders/${orderId}/confirm`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Confirm order failed");
  return data;
}

export async function getUserOrders() {
  const res = await apiFetch(`${API_URL}/orders/my`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Fetch orders failed");
  return data;
}

export async function submitTradeIntent(data: any) {
  const res = await apiFetch(`${API_URL}/trading/intent`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Trade failed");
  return json;
}

export async function getIndicativePrice() {
  const res = await apiFetch(`${API_URL}/trading/price`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Price fetch failed");
  return data;
}

/* =====================================================
   ADMIN – LOANS (🔥 FIXED)
===================================================== */
export async function getPendingLoanRequests() {
  const res = await apiFetch(`${API_URL}/loans/admin/loan-requests`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data?.error || "Failed to fetch pending loans");
  return Array.isArray(data) ? data : data?.data ?? [];
}

export async function approveLoanRequest(loanId: string) {
  const res = await apiFetch(
    `${API_URL}/loans/admin/loan-requests/${loanId}/approve`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    }
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(data?.error || "Approve loan failed");
  return data;
}

export async function rejectLoanRequest(loanId: string) {
  const res = await apiFetch(
    `${API_URL}/loans/admin/loan-requests/${loanId}/reject`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    }
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(data?.error || "Reject loan failed");
  return data;
}

/* =====================================================
   ALIASES (BACKWARD COMPATIBILITY)
===================================================== */
export const getCurrentKYCStatus = getKYCStatus;
export const getMyOrders = getUserOrders;

/* =====================================================
   ADDITIONAL MISSING EXPORTS
===================================================== */
export async function getPendingRedemptions() {
  const res = await apiFetch(`${API_URL}/admin/redemption-queue`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch pending redemptions");
  return data;
}

export async function approveRedemption(redemptionId: string) {
  const res = await apiFetch(`${API_URL}/admin/redemption/${redemptionId}/approve`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Approve redemption failed");
  return data;
}

export async function getPendingAML() {
  const res = await apiFetch(`${API_URL}/admin/pending-aml`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch pending AML");
  return data;
}

export async function clearAMLFlag(userId: string, reason: string) {
  const res = await apiFetch(`${API_URL}/admin/aml/${userId}/clear`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Clear AML flag failed");
  return data;
}

export async function getSilverPrice() {
  const res = await apiFetch(`${API_URL}/admin/silver-price`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch silver price");
  return data;
}

export async function setSilverPrice(pricePerGram: number, currency: string = "INR") {
  const res = await apiFetch(`${API_URL}/admin/silver-price`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ pricePerGram, currency }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to set silver price");
  return data;
}

export async function createSilverAsset(vaultId: string, weightGrams: number, purity: number) {
  const res = await apiFetch(`${API_URL}/admin/silver-asset`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ vaultId, weightGrams, purity }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Create silver asset failed");
  return data;
}

export async function getVaultInventory() {
  const res = await apiFetch(`${API_URL}/admin/vault-inventory`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch vault inventory");
  return data;
}

export async function getMintEligibility() {
  const res = await apiFetch(`${API_URL}/admin/mint-eligibility`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch mint eligibility");
  return data;
}

export async function getFlaggedUsers() {
  const res = await apiFetch(`${API_URL}/admin/aml-flagged`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch flagged users");
  return data;
}

export async function adminApproveRedemption(redemptionId: string) {
  const res = await apiFetch(`${API_URL}/admin/redemption/${redemptionId}/approve`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Admin approve redemption failed");
  return data;
}

export async function adminExecuteRedemption(redemptionId: string, adminSecret: string) {
  const res = await apiFetch(`${API_URL}/admin/redemption/${redemptionId}/execute`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ adminSecret }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Admin execute redemption failed");
  return data;
}

export async function adminDispatchRedemption(redemptionId: string, trackingNumber: string) {
  const res = await apiFetch(`${API_URL}/admin/redemption/${redemptionId}/dispatch`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ trackingNumber }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Admin dispatch redemption failed");
  return data;
}

export async function getRedemptionQueue() {
  const res = await apiFetch(`${API_URL}/admin/redemption-queue`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch redemption queue");
  return data;
}

export async function getTransactionHistory() {
  // Mock for now
  return { transactions: [] };
}

export async function transferBalance(amount: number, toUserId: string) {
  // Mock
  throw new Error("Not implemented");
}

export async function getUserLoans() {
  const res = await apiFetch(`${API_URL}/loans/status`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch user loans");
  return data.loans;
}

export async function calculateLoanTerms(amount: number, collateralAmount: number) {
  const res = await apiFetch(`${API_URL}/loans/calculate`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ amount, collateralAmount }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to calculate loan terms");
  return data;
}

export async function submitLoanApplication(data: any) {
  const res = await apiFetch(`${API_URL}/loans/apply`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Loan application failed");
  return json;
}

export async function getUserProfile() {
  // Mock
  return {};
}

export async function getVaultStatus() {
  // Mock
  return { status: "OK" };
}

export async function submitAML(data: any) {
  // Mock
  return {};
}

export async function submitRedemption(quantity: number, address: string) {
  const res = await apiFetch(`${API_URL}/redemption/request`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ quantity, address }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Submit redemption failed");
  return data;
}

export async function getMyRedemptions() {
  const res = await apiFetch(`${API_URL}/redemption/my`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch my redemptions");
  return data.data;
}

export async function setupTwoFactor(userId: string) {
  const res = await apiFetch(`${API_URL}/auth/2fa/setup`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Setup 2FA failed");
  return data;
}

export async function enableTwoFactor(userId: string, secret: string, token: string) {
  const res = await apiFetch(`${API_URL}/auth/2fa/enable`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId, secret, token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Enable 2FA failed");
  return data;
}

export async function disableTwoFactor(userId: string, token: string) {
  const res = await apiFetch(`${API_URL}/auth/2fa/disable`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId, token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Disable 2FA failed");
  return data;
}

/* =====================================================
   WALLET
===================================================== */
export async function connectExternalWallet(address: string, network: string) {
  const res = await apiFetch(`${API_URL}/wallet/connect-external`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ address, network }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to connect external wallet");
  return data;
}
