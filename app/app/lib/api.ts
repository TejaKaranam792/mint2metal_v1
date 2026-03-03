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

async function apiCall(url: string, options: RequestInit = {}) {
  const res = await apiFetch(url, options);

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data?.message || (typeof data?.error === 'string' ? data.error : data?.error?.message) || `API request failed with status ${res.status}`;
      throw new Error(data?.code ? `[${data.code}] ${errorMsg}` : errorMsg);
    }
    return data;
  } else {
    // Handle non-JSON response (likely HTML error page)
    const text = await res.text();
    if (!res.ok) throw new Error(`API Request Failed (${res.status}): The server returned an invalid response (non-JSON).`);
    return { message: "Success", text }; // Fallback for simple OK responses if any
  }
}

/* =====================================================
   AUTH
===================================================== */
export async function signup(email: string, password: string, country: string) {
  return apiCall(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, country }),
  });
}

export async function googleLogin(credential: string) {
  const data = await apiCall(`${API_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });

  if (data?.token) {
    localStorage.setItem("auth", JSON.stringify({ token: data.token }));
  }
  return data;
}

export async function login(
  email: string,
  password: string,
  twoFactorCode?: string
) {
  const data = await apiCall(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, twoFactorCode }),
  });

  if (data?.token) {
    localStorage.setItem("auth", JSON.stringify({ token: data.token }));
  }
  return data;
}

/* =====================================================
   KYC (USER)
===================================================== */
export async function getKYCStatus() {
  return apiCall(`${API_URL}/kyc/status`, {
    headers: getAuthHeaders(),
  });
}

export async function getSumsubAccessToken(levelName: string = 'id-and-liveness') {
  return apiCall(`${API_URL}/kyc/access-token`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ levelName }),
  });
}

export async function checkKYCStatusFromSumsub() {
  return apiCall(`${API_URL}/kyc/check-status`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
}

export async function startKYC() {
  return apiCall(`${API_URL}/kyc/start`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
}

export async function submitKYC(data: any) {
  return apiCall(`${API_URL}/kyc/submit`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
}


/* =====================================================
   ADMIN – USERS
===================================================== */
export async function getAdminUsers() {
  return apiCall(`${API_URL}/admin/users`, {
    headers: getAuthHeaders(),
  });
}

export async function updateUserRole(userId: string, role: string) {
  return apiCall(`${API_URL}/admin/user/${userId}/role`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ role }),
  });
}

export async function freezeUser(userId: string, frozen: boolean) {
  return apiCall(`${API_URL}/admin/user/${userId}/freeze`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ frozen }),
  });
}

/* =====================================================
   ADMIN – TRANSACTIONS & ANALYTICS
===================================================== */
export async function getAdminTransactions() {
  const data = await apiCall(`${API_URL}/admin/transactions`, {
    headers: getAuthHeaders(),
  });
  return data.transactions || [];
}

export async function updateTransactionStatus(
  transactionId: string,
  status: string
) {
  return apiCall(
    `${API_URL}/admin/transaction/${transactionId}/status`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }
  );
}

export async function getAdminAnalytics() {
  return apiCall(`${API_URL}/admin/analytics`, {
    headers: getAuthHeaders(),
  });
}

/* =====================================================
   BALANCES
===================================================== */
export async function getSilverBalance() {
  return apiCall(`${API_URL}/user/silver-balance`, {
    headers: getAuthHeaders(),
  });
}

export async function getDSTBalance() {
  return apiCall(`${API_URL}/user/dst-balance`, {
    headers: getAuthHeaders(),
  });
}

/* =====================================================
   ORDERS / TRADING
===================================================== */
export async function createBuyOrder(quantityGrams: number) {
  return apiCall(`${API_URL}/orders/buy`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ quantityGrams }),
  });
}

export async function createSellOrder(quantityGrams: number) {
  return apiCall(`${API_URL}/orders/sell`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ quantityGrams }),
  });
}

export async function confirmOrder(orderId: string, force?: boolean) {
  return apiCall(`${API_URL}/orders/${orderId}/confirm`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: force ? JSON.stringify({ force }) : undefined,
  });
}

export async function getUserOrders() {
  return apiCall(`${API_URL}/orders/my`, {
    headers: getAuthHeaders(),
  });
}

export async function submitTradeIntent(data: any) {
  return apiCall(`${API_URL}/trading/intent`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
}

export async function getIndicativePrice() {
  return apiCall(`${API_URL}/trading/price`, {
    headers: getAuthHeaders(),
  });
}

/* =====================================================
   ADMIN – LOANS (🔥 FIXED)
===================================================== */
export async function getPendingLoanRequests() {
  const data = await apiCall(`${API_URL}/loans/admin/loan-requests`, {
    headers: getAuthHeaders(),
  });
  return Array.isArray(data) ? data : data?.data ?? [];
}

export async function approveLoanRequest(loanId: string) {
  return apiCall(
    `${API_URL}/loans/admin/loan-requests/${loanId}/approve`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    }
  );
}

export async function rejectLoanRequest(loanId: string) {
  return apiCall(
    `${API_URL}/loans/admin/loan-requests/${loanId}/reject`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    }
  );
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
  return apiCall(`${API_URL}/admin/redemption-queue`, {
    headers: getAuthHeaders(),
  });
}

export async function approveRedemption(redemptionId: string, force: boolean = false) {
  return apiCall(`${API_URL}/admin/redemption/${redemptionId}/approve`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ force }),
  });
}


export async function getSilverPrice() {
  // Now proxies to oracle — kept for backward compatibility
  return getOraclePrice();
}

/** @deprecated Manual price override is disabled — oracle controls pricing */
export async function setSilverPrice(pricePerGram: number, currency: string = "USD") {
  console.warn("[Deprecated] setSilverPrice: Manual price override is disabled. Oracle controls pricing.");
  return { deprecated: true, message: "Use oracle pricing." };
}

/* =====================================================
   ORACLE PRICE FEED
===================================================== */

/** Get the current oracle-aggregated silver price. Public endpoint. */
export async function getOraclePrice() {
  return apiCall(`${API_URL}/api/oracle/price`, {
    headers: { "Content-Type": "application/json" },
  });
}

/** Get full oracle health status (HEALTHY/STALE/PAUSED/DEGRADED). */
export async function getOracleStatus() {
  return apiCall(`${API_URL}/api/oracle/status`, {
    headers: { "Content-Type": "application/json" },
  });
}

/** Get oracle submission history (admin only). */
export async function getOracleHistory(limit: number = 50) {
  return apiCall(`${API_URL}/api/oracle/history?limit=${limit}`, {
    headers: getAuthHeaders(),
  });
}

/** Emergency pause the oracle (admin only). */
export async function emergencyPauseOracle() {
  return apiCall(`${API_URL}/api/oracle/emergency-pause`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
}

/** Unpause the oracle after inspection (admin only). */
export async function unpauseOracle() {
  return apiCall(`${API_URL}/api/oracle/unpause`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
}


export async function createSilverAsset(vaultId: string, weightGrams: number, purity: number) {
  return apiCall(`${API_URL}/admin/silver-asset`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ vaultId, weightGrams, purity }),
  });
}

export async function getVaultInventory() {
  return apiCall(`${API_URL}/admin/vault-inventory`, {
    headers: getAuthHeaders(),
  });
}

export async function getMintEligibility() {
  return apiCall(`${API_URL}/admin/mint-eligibility`, {
    headers: getAuthHeaders(),
  });
}

/* =====================================================
   ADMIN VAULT MANAGEMENT: PURCHASE ORDERS
===================================================== */
export async function getPurchaseOrders(status?: string) {
  const url = status
    ? `${API_URL}/admin/purchase-orders?status=${status}`
    : `${API_URL}/admin/purchase-orders`;
  return apiCall(url, {
    headers: getAuthHeaders(),
  });
}

export async function createPurchaseOrder(dealerName: string, weightGrams: number, pricePerGram: number) {
  return apiCall(`${API_URL}/admin/purchase-order`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ dealerName, weightGrams, pricePerGram }),
  });
}

export async function updatePurchaseOrderStatus(
  purchaseOrderId: string,
  status: "CONFIRMED" | "RECEIVED" | "CANCELLED",
  serialNumbers?: string[],
  assayReports?: string[]
) {
  return apiCall(`${API_URL}/admin/purchase-order/${purchaseOrderId}/status`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status, serialNumbers, assayReports }),
  });
}


export async function adminApproveRedemption(redemptionId: string, force: boolean = false) {
  return apiCall(`${API_URL}/admin/redemption/${redemptionId}/approve`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ force }),
  });
}

export async function adminExecuteRedemption(redemptionId: string, adminSecret: string) {
  return apiCall(`${API_URL}/admin/redemption/${redemptionId}/execute`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ adminSecret }),
  });
}

export async function adminDispatchRedemption(redemptionId: string, trackingNumber: string) {
  return apiCall(`${API_URL}/admin/redemption/${redemptionId}/dispatch`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ trackingNumber }),
  });
}

export async function getRedemptionQueue() {
  return apiCall(`${API_URL}/admin/redemption-queue`, {
    headers: getAuthHeaders(),
  });
}

export async function getTransactionHistory() {
  const data = await apiCall(`${API_URL}/admin/transactions`, {
    headers: getAuthHeaders(),
  });
  return data.transactions || [];
}

export async function transferBalance(amount: number, toAddress: string) {
  const FreighterApi = await import('@stellar/freighter-api');

  // 1. Verify Freighter is connected and get the sender's public key
  const connectedResult = await FreighterApi.isConnected();
  const isConnected = typeof connectedResult === 'object'
    ? (connectedResult as any).isConnected
    : connectedResult;
  if (!isConnected) throw new Error('Freighter is not installed or connected');

  await FreighterApi.requestAccess();
  const pubKeyResult = await FreighterApi.getAddress();
  const fromAddress = typeof pubKeyResult === 'object'
    ? (pubKeyResult as any).address
    : pubKeyResult as string;

  if (!fromAddress) throw new Error('Could not get address from Freighter');

  // 2. Ask backend to build the unsigned XDR using the Freighter address as sender
  const buildRes = await apiCall(`${API_URL}/user/build-transfer-tx`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ toAddress, amount, fromAddress }),
  });
  const { xdr: unsignedXdr } = buildRes;

  // 3. Sign with Freighter
  const signResult = await FreighterApi.signTransaction(unsignedXdr, {
    networkPassphrase: 'Test SDF Network ; September 2015',
  });
  const signedXdr = typeof signResult === 'object'
    ? (signResult as any).signedTxXdr ?? signResult
    : signResult;

  // 4. Submit signed XDR to backend for broadcast + audit log
  return apiCall(`${API_URL}/user/transfer-balance`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ amount, recipientAddress: toAddress, signedXdr }),
  });
}




export async function getUserLoans() {
  const data = await apiCall(`${API_URL}/loans/status`, {
    headers: getAuthHeaders(),
  });
  return data.loans;
}

export async function calculateLoanTerms(amount: number, collateralAmount: number) {
  return apiCall(`${API_URL}/loans/calculate`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ amount, collateralAmount }),
  });
}

export async function submitLoanApplication(data: any) {
  return apiCall(`${API_URL}/loans/apply`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
}

export async function getUserProfile() {
  return apiCall(`${API_URL}/user/me`, {
    headers: getAuthHeaders(),
  });
}

export async function getVaultStatus() {
  try {
    const data = await apiCall(`${API_URL}/user/vault-status`, {
      headers: getAuthHeaders(),
    });
    return data; // { totalAssets, totalWeight, totalValue, assets }
  } catch (error) {
    console.error("Failed to fetch vault status", error);
    return { totalAssets: 0, totalWeight: 0, totalValue: 0, assets: [] };
  }
}

export async function submitAML(data: any) {
  return apiCall(`${API_URL}/kyc/aml/submit`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
}

export async function submitRedemption(quantity: number, address: string, signedXdr?: string) {
  return apiCall(`${API_URL}/redemption/request`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ quantity, address, signedXdr }),
  });
}

export async function getMyRedemptions() {
  const data = await apiCall(`${API_URL}/redemption/my`, {
    headers: getAuthHeaders(),
  });
  return data.data;
}

export async function setupTwoFactor(userId: string) {
  return apiCall(`${API_URL}/auth/2fa/setup`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId }),
  });
}

export async function enableTwoFactor(userId: string, secret: string, token: string) {
  return apiCall(`${API_URL}/auth/2fa/enable`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId, secret, token }),
  });
}

export async function disableTwoFactor(userId: string, token: string) {
  return apiCall(`${API_URL}/auth/2fa/disable`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId, token }),
  });
}

/* =====================================================
   WALLET
===================================================== */
export async function connectExternalWallet(address: string, network: string) {
  return apiCall(`${API_URL}/wallet/connect-external`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ address, network }),
  });
}

export async function getLinkedWallet() {
  return apiCall(`${API_URL}/user/linked-wallet`, {
    headers: getAuthHeaders(),
  });
}


/* =====================================================
   BUY SILVER — PRICE & MINT
===================================================== */
export async function getSilverPriceM2M() {
  return apiCall(`${API_URL}/api/oracle/price`, {
    headers: getAuthHeaders(),
  });
}

export async function getTransparencyData(commodity: string = "XAG") {
  return apiCall(`${API_URL}/api/v1/transparency/${commodity}`, {
    headers: getAuthHeaders(),
  });
}

/* =====================================================
   ADMIN TREASURY MANAGEMENT
===================================================== */
export async function getTreasuryBalance() {
  return apiCall(`${API_URL}/admin/treasury/balance`, {
    headers: getAuthHeaders(),
  });
}

export async function requestMint(
  amount: string | number,
  reservesProof: string,
  vaultId?: string,
  ipfsCid?: string,
  vaultName?: string,
) {
  return apiCall(`${API_URL}/admin/treasury/mint`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ amount, reservesProof, vaultId, ipfsCid, vaultName }),
  });
}


/* =====================================================
   B2B API KEY MANAGEMENT
===================================================== */
export async function getApiKeys() {
  return apiCall(`${API_URL}/api-keys`, {
    headers: getAuthHeaders(),
  });
}

export async function generateApiKey(name: string, permissions: string[] = ["READ_ONLY"]) {
  return apiCall(`${API_URL}/api-keys/generate`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, permissions }),
  });
}

export async function revokeApiKey(id: string) {
  return apiCall(`${API_URL}/api-keys/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
}

export async function repayLoan(loanId: string, amount: number, txHash: string) {
  return apiCall(`${API_URL}/loans/repay`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ loanId, amount, txHash }),
  });
}
