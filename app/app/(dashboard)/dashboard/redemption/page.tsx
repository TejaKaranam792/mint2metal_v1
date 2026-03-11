"use client";

import { useAuth } from "@/lib/auth-context";
import { submitRedemption, getCurrentKYCStatus, getMyRedemptions, getSilverBalance, getSilverPriceM2M } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RedemptionPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  const [kycStatus, setKycStatus] = useState("Loading...");
  const [silverBalance, setSilverBalance] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [quantity, setQuantity] = useState(10);
  const [confirmed, setConfirmed] = useState(false);

  // Redemption history
  const [myRedemptions, setMyRedemptions] = useState<any[]>([]);

  // Fetch data on mount
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    fetchData();
  }, [isAuthenticated, router]);

  const fetchData = async () => {
    try {
      const [silverRes, kycRes, priceRes] = await Promise.all([
        getSilverBalance(),
        getCurrentKYCStatus(),
        getSilverPriceM2M(),
      ]);

      setSilverBalance(silverRes?.balance || 0);

      const rawStatus = typeof kycRes?.status === "string"
        ? kycRes.status
        : kycRes?.status?.status;
      setKycStatus(rawStatus || "UNKNOWN");

      if (priceRes?.pricePerGram) setCurrentPrice(priceRes.pricePerGram);

      // Fetch redemption history
      try {
        const redemptions = await getMyRedemptions();
        setMyRedemptions(Array.isArray(redemptions) ? redemptions : redemptions?.data || []);
      } catch { /* no redemptions yet */ }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setPageLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-muted/20 border-t-foreground rounded-full animate-spin mx-auto"></div>
          <p className="text-lg text-muted-foreground animate-pulse">Loading redemption...</p>
        </div>
      </div>
    );
  }

  const eligible = silverBalance >= 10 && kycStatus === "VERIFIED";
  const portfolioValue = silverBalance * currentPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eligible || !confirmed) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const address = `${fullName}, ${phoneNumber}, ${addressLine1}, ${city}, ${state}, ${pincode}`;

      let signedXdr = "";
      // If STRICT_ONCHAIN_MODE is active on backend, it requires a signedXdr transferring tokens to the treasury
      try {
        const FreighterApi = await import('@stellar/freighter-api');
        const connectedResult = await FreighterApi.isConnected();
        const isConnected = typeof connectedResult === 'object' ? (connectedResult as any).isConnected : connectedResult;

        if (isConnected) {
          await FreighterApi.requestAccess();
          const pubKeyResult = await FreighterApi.getAddress();
          const fromAddress = typeof pubKeyResult === 'object' ? (pubKeyResult as any).address : pubKeyResult as string;

          if (fromAddress) {
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
                isTreasuryTransfer: true
              }),
            });

            if (buildRes.ok) {
              const { xdr: unsignedXdr } = await buildRes.json();
              const signResult = await FreighterApi.signTransaction(unsignedXdr, {
                networkPassphrase: 'Test SDF Network ; September 2015',
              });

              if (typeof signResult === 'string') {
                signedXdr = signResult;
              } else if (typeof signResult === 'object' && signResult !== null) {
                if ('error' in signResult) {
                  throw new Error(`Freighter error: ${(signResult as any).error}`);
                }
                signedXdr = (signResult as any).signedTxXdr || (signResult as any).tx || '';
              }
            } else {
              const errData = await buildRes.json();
              throw new Error(errData.error || `Failed to build transfer transaction`);
            }
          } else {
            throw new Error('Could not get address from Freighter');
          }
        } else {
          throw new Error('Freighter is not installed or connected');
        }
      } catch (freighterErr) {
        console.error("Freighter signing error:", freighterErr);
        throw new Error((freighterErr as Error).message || "Failed to sign transaction with Freighter");
      }

      if (!signedXdr) {
        throw new Error('User cancelled or failed to extract the signed transaction XDR');
      }

      await submitRedemption(quantity, address, signedXdr);

      setSuccess(`Redemption request for ${quantity}g submitted! You'll receive confirmation shortly.`);
      setFullName("");
      setPhoneNumber("");
      setAddressLine1("");
      setCity("");
      setState("");
      setPincode("");
      setQuantity(10);
      setConfirmed(false);

      // Refresh redemption history
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to submit redemption request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Physical Silver Redemption</h1>
          <p className="text-muted-foreground">
            Convert your digital silver tokens into physical silver delivered to your address
          </p>
        </div>

        {/* Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-5">
            <p className="text-sm text-emerald-400/80 mb-1">Silver Balance</p>
            <p className="text-2xl font-bold text-foreground">{silverBalance}g</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-5">
            <p className="text-sm text-blue-400/80 mb-1">Portfolio Value</p>
            <p className="text-2xl font-bold text-foreground">{portfolioValue.toLocaleString()} M2M</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-5">
            <p className="text-sm text-purple-400/80 mb-1">KYC Status</p>
            <p className={`text-2xl font-bold ${kycStatus === "VERIFIED" ? "text-emerald-400" : "text-amber-400"}`}>
              {kycStatus}
            </p>
          </div>
        </div>

        {/* Eligibility Warning */}
        {!eligible && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <h3 className="text-lg font-semibold text-amber-400 mb-2">Eligibility Requirements</h3>
            <ul className="text-sm text-foreground space-y-1">
              <li className={silverBalance >= 10 ? "text-emerald-400" : "text-red-400"}>
                {silverBalance >= 10 ? "✅" : "❌"} Minimum 10g silver balance (you have: {silverBalance}g)
              </li>
              <li className={kycStatus === "VERIFIED" ? "text-emerald-400" : "text-red-400"}>
                {kycStatus === "VERIFIED" ? "✅" : "❌"} KYC status: VERIFIED (current: {kycStatus})
              </li>
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Form (takes 2 cols) */}
          <form
            onSubmit={handleSubmit}
            className={`lg:col-span-2 bg-card border border-border p-6 rounded-xl space-y-6 ${!eligible ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-2xl">📦</div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Redemption Request</h2>
                <p className="text-sm text-muted-foreground">Fill in your delivery details</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">Full Name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none text-foreground placeholder-muted-foreground"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">Phone Number</label>
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none text-foreground placeholder-muted-foreground"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Delivery Address</label>
              <input
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Street address, building, apartment"
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none text-foreground placeholder-muted-foreground"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">City</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none text-foreground placeholder-muted-foreground"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">State</label>
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none text-foreground placeholder-muted-foreground"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">Pincode</label>
                <input
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="6-digit pincode"
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none text-foreground placeholder-muted-foreground"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Redemption Quantity (grams)</label>
              <input
                type="number"
                min={10}
                max={silverBalance}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary focus:outline-none text-foreground placeholder-muted-foreground"
                required
              />
              <p className="text-xs text-muted-foreground">
                Available: {silverBalance}g • Min: 10g • Value: {(quantity * currentPrice).toLocaleString()} M2M
              </p>
            </div>

            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary"
              />
              <span className="text-sm text-muted-foreground">
                I confirm that all information is accurate and I agree to the redemption terms. Physical delivery may take 7-14 business days.
              </span>
            </label>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">❌ {error}</p>
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-sm text-emerald-400">✅ {success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!eligible || loading || !confirmed || quantity < 10 || quantity > silverBalance}
              className="w-full py-3 text-lg font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Submitting...
                </span>
              ) : (
                `Redeem ${quantity}g Physical Silver`
              )}
            </button>
          </form>

          {/* Right Column: Process + History */}
          <div className="space-y-6">
            {/* Process Steps */}
            <div className="bg-card border border-border p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-foreground mb-4">Redemption Process</h3>
              <div className="space-y-4">
                {[
                  { step: 1, label: "Request Submitted", check: myRedemptions.length > 0 },
                  { step: 2, label: "Admin Verification", check: myRedemptions.some(r => ["APPROVED", "TOKENS_BURNED", "FULFILLED", "DISPATCHED"].includes(r.status)) },
                  { step: 3, label: "Tokens Burned", check: myRedemptions.some(r => ["TOKENS_BURNED", "FULFILLED", "DISPATCHED"].includes(r.status)) },
                  { step: 4, label: "Shipment Initiated", check: myRedemptions.some(r => ["DISPATCHED", "FULFILLED"].includes(r.status)) },
                ].map(({ step, label, check }) => (
                  <div key={step} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${check ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                      {check ? "✓" : step}
                    </div>
                    <span className={`text-sm ${check ? 'text-emerald-400' : 'text-muted-foreground'}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Redemption History */}
            {myRedemptions.length > 0 && (
              <div className="bg-card border border-border p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-foreground mb-4">Your Redemptions</h3>
                <div className="space-y-3">
                  {myRedemptions.map((r: any) => (
                    <div key={r.id} className="p-3 bg-surface rounded-lg border border-border">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-foreground">{r.quantity}g</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.status === "PENDING" ? "bg-amber-500/20 text-amber-400" :
                          r.status === "APPROVED" ? "bg-blue-500/20 text-blue-400" :
                            r.status === "TOKENS_BURNED" ? "bg-orange-500/20 text-orange-400" :
                              r.status === "FULFILLED" ? "bg-emerald-500/20 text-emerald-400" :
                                r.status === "DISPATCHED" ? "bg-purple-500/20 text-purple-400" :
                                  "bg-red-500/20 text-red-400"
                          }`}>
                          {r.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(r.requestedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
