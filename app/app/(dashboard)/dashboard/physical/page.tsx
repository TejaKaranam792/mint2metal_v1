"use client";

import { useAuth } from "@/lib/auth-context";
import { submitRedemption, getCurrentKYCStatus, getMyRedemptions, getSilverBalance } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PhysicalPage() {
  const { isAuthenticated, userType, userId } = useAuth();
  const [kycStatus, setKycStatus] = useState("Loading...");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [quantity, setQuantity] = useState(500);
  const [confirmed, setConfirmed] = useState(false);

  // Redemption state
  const [myRedemptions, setMyRedemptions] = useState<any[]>([]);

  // Live data from backend
  const [silverBalance, setSilverBalance] = useState(0);
  const eligible = silverBalance >= 500 && userType === "INDIA_USER" && kycStatus === "VERIFIED";

  // Fetch user's redemptions, KYC status and balances
  useEffect(() => {
    if (isAuthenticated && userType === "INDIA_USER") {
      fetchMyRedemptions();
      fetchKYCStatus();
      fetchSilverBalance();
    }
  }, [isAuthenticated, userType]);

  const fetchSilverBalance = async () => {
    try {
      const resp = await getSilverBalance();
      setSilverBalance(resp.balance || 0);
    } catch (error) {
      console.error("Failed to fetch silver balance:", error);
    }
  };

  const fetchMyRedemptions = async () => {
    try {
      const response = await getMyRedemptions();
      setMyRedemptions(response.data || []);
    } catch (error) {
      console.error("Failed to fetch redemptions:", error);
    }
  };

  const fetchKYCStatus = async () => {
    try {
      const kycData = await getCurrentKYCStatus();
      setKycStatus(kycData.status);
    } catch (error) {
      console.error("Failed to fetch KYC status:", error);
      setKycStatus("ERROR");
    }
  };

  // redirect if not logged in
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  // international users should NEVER access redemption
  if (!isAuthenticated) return null;

  if (userType !== "INDIA_USER") {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="card max-w-xl mx-auto bg-card border border-border p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Physical Redemption
          </h2>
          <p className="text-muted-foreground">
            Physical redemption is currently available only for Indian users.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl space-y-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Physical Silver Redemption</h1>
        <p className="text-muted-foreground" style={{ animationDelay: '0.1s' }}>
          Request delivery of your physical silver assets to your verified address
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Physical redemption is a regulated, offline process.
        </p>
      </div>

      {/* Eligibility message */}
      {!eligible && (
        <div className="card mb-6 animate-slideInUp bg-warning/10 border-warning/20" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center p-4">
            <svg className="w-6 h-6 text-warning mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-warning mb-1">Eligibility Requirements</h3>
              <p className="text-sm text-foreground">
                To request physical redemption, you need:
                <br />• Minimum 500g silver balance (current: {silverBalance}g)
                <br />• KYC status: VERIFIED (current: {kycStatus})
                <br />• Indian user account
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Redemption Form */}
        <form className={`card bg-card border border-border p-6 rounded-lg shadow-sm animate-slideInUp ${!eligible ? 'opacity-50 pointer-events-none' : ''}`} style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mr-4 text-primary">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Redemption Request Form</h2>
              <p className="text-sm text-muted-foreground">Please provide accurate delivery information</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">Full Name</label>
              <input
                disabled={!eligible}
                placeholder="Enter your full legal name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none transition-all text-foreground placeholder-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">Phone Number</label>
              <input
                disabled={!eligible}
                placeholder="+91 XXXXX XXXXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none transition-all text-foreground placeholder-muted-foreground"
                required
              />
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <label className="block text-sm font-semibold text-foreground">Delivery Address</label>
            <input
              disabled={!eligible}
              placeholder="Street address, building, apartment"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none transition-all text-foreground placeholder-muted-foreground"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">City</label>
              <input
                disabled={!eligible}
                placeholder="City name"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none transition-all text-foreground placeholder-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">State</label>
              <input
                disabled={!eligible}
                placeholder="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none transition-all text-foreground placeholder-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">Pincode</label>
              <input
                disabled={!eligible}
                placeholder="6-digit pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none transition-all text-foreground placeholder-muted-foreground"
                required
              />
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <label className="block text-sm font-semibold text-foreground">Redemption Quantity</label>
            <input
              disabled={!eligible}
              type="number"
              min={500}
              max={silverBalance}
              placeholder={`Grams (minimum 100g, maximum ${silverBalance}g)`}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none transition-all text-foreground placeholder-muted-foreground"
              required
            />
            <p className="text-xs text-muted-foreground">Available balance: {silverBalance}g • Minimum redemption: 500g</p>
          </div>

          <div className="mb-6">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                disabled={!eligible}
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary focus:ring-2"
              />
              <span className="text-sm leading-relaxed text-muted-foreground">
                I confirm that this redemption request complies with Indian regulatory requirements and that all provided information is accurate and up-to-date.
              </span>
            </label>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-destructive mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}

          <button
            disabled={!eligible || loading || !confirmed}
            className={`w-full py-3 text-lg font-semibold rounded-lg transition-all duration-200 ${eligible && confirmed
              ? "bg-primary text-primary-foreground hover:scale-[1.02]"
              : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            onClick={async (e) => {
              e.preventDefault();
              if (!userId) return;

              setLoading(true);
              setError("");

              try {
                // 1. Prepare Freighter integration
                const FreighterApi = await import('@stellar/freighter-api');
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

                // 2. Build the unsigned XDR from backend to send tokens to Treasury
                // Note: Using treasury address via an environment variable or a known address on the frontend is needed. 
                // We'll rely on the backend to handle the treasury address properly.
                const authHeader = localStorage.getItem('auth');
                const token = authHeader ? JSON.parse(authHeader).token : '';

                const buildRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/user/build-transfer-tx`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    amount: quantity,
                    fromAddress,
                    isTreasuryTransfer: true // specific flag for treasury transfer
                  }),
                });

                if (!buildRes.ok) {
                  const errData = await buildRes.json();
                  throw new Error(errData.error || `Failed to build transfer transaction`);
                }

                const { xdr: unsignedXdr } = await buildRes.json();

                // 3. Sign with Freighter
                const signResult = await FreighterApi.signTransaction(unsignedXdr, {
                  networkPassphrase: 'Test SDF Network ; September 2015',
                });

                console.log("Freighter signResult:", signResult);

                let signedXdr = '';
                if (typeof signResult === 'string') {
                  signedXdr = signResult;
                } else if (typeof signResult === 'object' && signResult !== null) {
                  // Some versions return { signedTxXdr: '...' } while others might just return the object if error
                  if ('error' in signResult) {
                    throw new Error(`Freighter error: ${(signResult as any).error}`);
                  }
                  signedXdr = (signResult as any).signedTxXdr || (signResult as any).tx || '';
                }

                console.log("Extracted signedXdr:", !!signedXdr);

                if (!signedXdr) {
                  throw new Error('User cancelled or failed to extract the signed transaction XDR');
                }

                // 4. Submit the redemption with the signed XDR
                const address = `${fullName}, ${phoneNumber}, ${addressLine1}, ${city}, ${state}, ${pincode}`;

                const submitRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/redemption/request`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ quantity, address, signedXdr }),
                });

                if (!submitRes.ok) {
                  const errData = await submitRes.json();
                  throw new Error(errData.error || errData.message || `Failed to submit redemption request`);
                }

                // Success message
                setFullName("");
                setPhoneNumber("");
                setAddressLine1("");
                setCity("");
                setState("");
                setPincode("");
                setQuantity(500);
                setConfirmed(false);

                // Show success modal or toast
                alert("Redemption request submitted successfully! You will receive a confirmation email shortly.");
              } catch (err) {
                setError((err as Error).message || "Failed to submit redemption request. Please try again.");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2"></div>
                Submitting Request...
              </div>
            ) : (
              "Submit Redemption Request"
            )}
          </button>
        </form>

        {/* Right Column: Redemption Process */}
        <div className="card bg-card border border-border p-6 rounded-lg animate-slideInUp" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-lg font-semibold mb-4 text-foreground">Redemption Process</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${myRedemptions.length > 0 ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                1
              </div>
              <span className={`ml-2 text-sm ${myRedemptions.length > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                Request Redemption
              </span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${myRedemptions.some(r => r.status === 'APPROVED' || r.status === 'FULFILLED' || r.status === 'DISPATCHED')
              ? 'bg-success' : 'bg-muted'
              }`}></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${myRedemptions.some(r => r.status === 'APPROVED' || r.status === 'FULFILLED' || r.status === 'DISPATCHED')
                ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                2
              </div>
              <span className={`ml-2 text-sm ${myRedemptions.some(r => r.status === 'APPROVED' || r.status === 'FULFILLED' || r.status === 'DISPATCHED')
                ? 'text-success' : 'text-muted-foreground'
                }`}>
                Admin Verification
              </span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${myRedemptions.some(r => r.status === 'FULFILLED' || r.status === 'DISPATCHED')
              ? 'bg-success' : 'bg-muted'
              }`}></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${myRedemptions.some(r => r.status === 'FULFILLED' || r.status === 'DISPATCHED')
                ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                3
              </div>
              <span className={`ml-2 text-sm ${myRedemptions.some(r => r.status === 'FULFILLED' || r.status === 'DISPATCHED')
                ? 'text-success' : 'text-muted-foreground'
                }`}>
                Vault Allocation
              </span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${myRedemptions.some(r => r.status === 'DISPATCHED')
              ? 'bg-success' : 'bg-muted'
              }`}></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${myRedemptions.some(r => r.status === 'DISPATCHED')
                ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                4
              </div>
              <span className={`ml-2 text-sm ${myRedemptions.some(r => r.status === 'DISPATCHED')
                ? 'text-success' : 'text-muted-foreground'
                }`}>
                Shipment Initiated
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
