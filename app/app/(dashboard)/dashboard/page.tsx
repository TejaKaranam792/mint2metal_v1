"use client";

import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/context/WalletContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSilverBalance, getDSTBalance, getVaultStatus, getCurrentKYCStatus, submitAML, submitKYC, getUserProfile, getUserOrders, getSilverPriceM2M, getTransparencyData } from "@/lib/api";
import { signDummyTx } from "@/lib/signDummyTx";
import { stellarService } from "@/lib/stellar";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import Table from "@/components/Table";
import Badge from "@/components/Badge";
import StatBox from "@/components/StatBox";
import Link from "next/link";

export default function Dashboard() {
  const { isAuthenticated, userType, user } = useAuth();
  const { publicKey, network } = useWallet();
  const router = useRouter();

  const [silverBalance, setSilverBalance] = useState(0);
  const [dstBalance, setDstBalance] = useState(0);
  const [vaultStatus, setVaultStatus] = useState<any>(null);
  const [kycStatus, setKycStatus] = useState("Loading...");
  const [currentPrice, setCurrentPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<string[][]>([]);

  // Institutional Transparency Metrics
  const [transparencyData, setTransparencyData] = useState({
    totalMinted: 0,
    treasuryBalance: 0,
    circulatingSupply: 0,
    vaultedGrams: 0,
    backingRatio: 0,
    lastPoR: "Loading..."
  });
  const [signedXDR, setSignedXDR] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [sorobanReadResult, setSorobanReadResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    } else {
      fetchData();
    }
  }, [isAuthenticated, router]);

  const fetchData = async () => {
    try {
      // Make API calls sequentially to avoid rate limiting
      const silverRes = await getSilverBalance();
      setSilverBalance(silverRes.balance);

      const dstRes = await getDSTBalance();
      setDstBalance(dstRes.balance);

      const vaultRes = await getVaultStatus();
      setVaultStatus(vaultRes);

      // Fetch admin-set silver price
      try {
        const priceRes = await getSilverPriceM2M();
        if (priceRes?.pricePerGram) setCurrentPrice(priceRes.pricePerGram);
      } catch { /* keep default */ }

      // Fetch institutional transparency data
      try {
        const transparencyRes = await getTransparencyData("XAG");
        if (transparencyRes) {
          setTransparencyData({
            totalMinted: transparencyRes.totalMintedTokens || 0,
            treasuryBalance: transparencyRes.treasuryBalance || 0,
            circulatingSupply: transparencyRes.totalCirculatingTokens || 0,
            vaultedGrams: transparencyRes.totalVaultedGrams || 0,
            backingRatio: transparencyRes.backingRatio || 0,
            lastPoR: transparencyRes.lastPoR || "N/A"
          });
        }
      } catch (err) {
        console.error("Failed to fetch transparency data:", err);
      }

      const kycRes = await getCurrentKYCStatus();
      // Backend returns { success, status: { status: "VERIFIED", message } }
      const rawStatus = typeof kycRes?.status === "string"
        ? kycRes.status
        : kycRes?.status?.status;
      setKycStatus(rawStatus || "UNKNOWN");

      const userProfileRes = await getUserProfile();

      const ordersRes = await getUserOrders();

      // Use real orders data for recent activity
      const orders = ordersRes.data || [];
      const recentActivityData = orders.slice(0, 5).map((order: any) => [
        new Date(order.createdAt).toLocaleDateString(),
        order.type === "BUY" ? "Buy Silver" : "Sell Silver",
        `${order.quantityGrams}g`,
        order.status,
      ]);
      setRecentActivity(recentActivityData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      // Empty state for production
      setRecentActivity([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-muted/20 border-t-foreground rounded-full animate-spin mx-auto"></div>
          <p className="text-lg text-muted-foreground animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Ensure userType is valid (including backward compatibility for old user types)
  const validUserTypes = ['INDIA_USER', 'INTERNATIONAL_USER', 'ADMIN', 'API_INTEGRATOR', 'INDIA', 'INTERNATIONAL'];
  if (!userType || !validUserTypes.includes(userType as string)) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-error">Invalid user type. Please contact support.</p>
      </div>
    </div>;
  }

  // Skip KYC/AML checks for admin users
  let isInternationalPendingAML = false;
  let isIndianPendingKYC = false;

  if (userType !== "ADMIN") {
    // AML check for international users (including backward compatibility)
    isInternationalPendingAML = userType === "INTERNATIONAL_USER" && user?.amlStatus !== "CLEARED";

    // KYC check for Indian users (including backward compatibility)
    isIndianPendingKYC = userType === "INDIA_USER" && kycStatus !== "VERIFIED";
  }

  // Allow dashboard access regardless of KYC status - KYC will be checked when buying/selling

  // Calculate portfolio value in M2M tokens
  const portfolioValueM2M = silverBalance * currentPrice;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Welcome Section */}
        <div className="mb-8 animate-reveal-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Welcome back, {user?.name || 'User'}
              </h1>
              <p className="text-muted-foreground text-lg">Your silver portfolio at a glance</p>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-sm text-muted-foreground mb-1">Portfolio Value</p>
              <p className="text-2xl font-bold text-foreground">{portfolioValueM2M.toLocaleString()} M2M</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Metrics and Actions */}
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 gap-6 animate-reveal-up animation-delay-100">
              <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-emerald-400/80 mb-1">Silver Balance</p>
                      <p className="text-3xl font-bold text-foreground">{silverBalance}g</p>
                    </div>
                    <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                      <span className="text-3xl">🥈</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:border-blue-500/40 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-400/80 mb-1">Silver Price</p>
                      <p className="text-3xl font-bold text-foreground">
                        {currentPrice > 0 ? `${currentPrice.toLocaleString()} M2M/g` : 'Not set'}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center">
                      <span className="text-3xl">📊</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 hover:border-purple-500/40 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-400/80 mb-1">Vault Status</p>
                      <p className="text-lg font-semibold text-foreground">
                        {vaultStatus
                          ? `${vaultStatus.totalAssets ?? 0} assets · ${(vaultStatus.totalWeight ?? 0).toFixed(1)}g`
                          : 'Loading...'}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center">
                      <span className="text-3xl">🏦</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="animate-reveal-up animation-delay-200">
              <CardHeader>
                <CardTitle className="text-2xl">Quick Actions</CardTitle>
                <CardDescription>Manage your silver investments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  <Link href="/dashboard/trading">
                    <Button variant="default" size="lg" className="w-full justify-start gap-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300">
                      <span className="text-xl">💰</span>
                      <span>Buy Silver</span>
                    </Button>
                  </Link>
                  <Link href="/dashboard/trading">
                    <Button variant="outline" size="lg" className="w-full justify-start gap-3 border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/50 transition-all duration-300">
                      <span className="text-xl">📈</span>
                      <span>Sell Silver</span>
                    </Button>
                  </Link>
                  <Link href="/dashboard/loans">
                    <Button variant="outline" size="lg" className="w-full justify-start gap-3 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all duration-300">
                      <span className="text-xl">🏦</span>
                      <span>Get Loan</span>
                    </Button>
                  </Link>
                  {userType === "INDIA_USER" && (
                    <Link href="/dashboard/redemption">
                      <Button variant="outline" size="lg" className="w-full justify-start gap-3 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50 transition-all duration-300">
                        <span className="text-xl">🔄</span>
                        <span>Redeem Physical</span>
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Institutional Transparency Module */}
            <Card className="animate-reveal-up animation-delay-300 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-600/10 hover:border-amber-500/40 transition-all duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl text-amber-500">Institutional Transparency</CardTitle>
                    <CardDescription>Live Treasury Buffer & Supply Reconciliation</CardDescription>
                  </div>
                  <Badge variant="neutral" className="border-amber-500 text-amber-500">Proof of Reserve</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Minted Supply</p>
                    <p className="text-xl font-bold text-foreground">{transparencyData.totalMinted.toLocaleString()} DST</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Treasury Buffer</p>
                    <p className="text-xl font-bold text-foreground">{transparencyData.treasuryBalance.toLocaleString()} DST</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Circulating Supply</p>
                    <p className="text-xl font-bold text-foreground">{transparencyData.circulatingSupply.toLocaleString()} DST</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vaulted Silver </p>
                    <p className="text-xl font-bold text-emerald-400">{transparencyData.vaultedGrams.toLocaleString()}g</p>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-amber-500/20 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Backing Ratio: </span>
                    <span className="font-bold text-emerald-400">{(transparencyData.backingRatio * 100).toFixed(0)}%</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    Latest PoR IPFS: <span className="font-mono text-amber-400/80">{transparencyData.lastPoR}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Recent Activity */}
          <div className="animate-reveal-up animation-delay-300">
            <Card className="border-border/50 hover:border-border transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-2xl text-foreground flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-lg">📊</span>
                  </div>
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Your latest transactions and activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table
                  headers={["Date", "Action", "Amount", "Status"]}
                  rows={recentActivity}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= KYC SUBMISSION PAGE ================= */
function KYCSubmissionPage() {
  const { userId } = useAuth();
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await submitKYC({ userId, documentType, documentNumber });
      setMessage("KYC submitted successfully! Waiting for approval.");
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      setMessage(error.message || "Failed to submit KYC");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full bg-card border-border">
        <div className="text-center mb-6 pt-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl">✓</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">KYC Verification Required</h1>
          <p className="text-muted-foreground">
            As an Indian user, you need to complete KYC verification to access the platform.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">Select document type</option>
              <option value="Passport">Passport</option>
              <option value="ID Card">ID Card</option>
              <option value="Driver License">Driver License</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Document Number</label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Enter document number"
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg ${message.includes('successfully') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600' : 'bg-red-500/10 border border-red-500/20 text-red-600'}`}>
              {message}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !fullName || !documentType || !documentNumber}
            className="w-full"
          >
            {loading ? "Submitting..." : "Submit KYC"}
          </Button>
        </form>


      </Card>
    </div>
  );
}

/* ================= AML SUBMISSION PAGE ================= */
function AMLSubmissionPage() {
  const [documentRef, setDocumentRef] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await submitAML({ documentRef, selectedFile });
      setMessage("AML documents submitted successfully. Your account is now under review.");
      setDocumentRef("");
      setSelectedFile(null);
    } catch (error: any) {
      setMessage(error.message || "Failed to submit AML documents");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full bg-card border-border">
        <div className="text-center mb-6 pt-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">AML Verification Required</h1>
          <p className="text-muted-foreground">
            As an international user, you must complete AML verification to access all platform features.
          </p>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6 mx-6">
          <h3 className="text-lg font-medium text-amber-600 mb-2">Required Documents:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Proof of Identity (Passport, National ID)</li>
            <li>• Proof of Address (Utility Bill, Bank Statement)</li>
            <li>• Source of Funds Declaration</li>
            <li>• Any additional documents as requested</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Upload AML Document
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Accepted formats: PDF, JPG, PNG (max 10MB)
            </p>
            {selectedFile && (
              <p className="text-xs text-emerald-600 mt-1">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Document Reference (Optional)
            </label>
            <input
              type="text"
              value={documentRef}
              onChange={(e) => setDocumentRef(e.target.value)}
              placeholder="Enter document reference or additional notes"
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg ${message.includes('successfully') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600' : 'bg-red-500/10 border border-red-500/20 text-red-600'}`}>
              {message}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || (!selectedFile && !documentRef)}
            className="w-full"
          >
            {loading ? "Submitting..." : "Submit for Review"}
          </Button>
        </form>


      </Card>
    </div>
  );
}
