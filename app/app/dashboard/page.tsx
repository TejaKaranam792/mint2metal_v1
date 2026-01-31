"use client";

import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/context/WalletContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSilverBalance, getDSTBalance, getVaultStatus, getCurrentKYCStatus, submitAML, submitKYC, getUserProfile, getUserOrders } from "@/lib/api";
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
  const [vaultStatus, setVaultStatus] = useState("Loading...");
  const [kycStatus, setKycStatus] = useState("Loading...");
  const [currentPrice, setCurrentPrice] = useState(7500); // INR per gram
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<string[][]>([]);
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
      setVaultStatus(vaultRes.status);

      const kycRes = await getCurrentKYCStatus();
      setKycStatus(kycRes.status);

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
      // Fallback to mock data if API fails
      setRecentActivity([
        ["2024-01-15", "Buy Silver", "10g", "Completed"],
        ["2024-01-10", "Sell Silver", "5g", "Completed"],
        ["2024-01-05", "Redeem Physical", "2g", "Pending"],
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-lg text-secondary-text animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Ensure userType is valid (including backward compatibility for old user types)
  if (!userType || (userType !== 'INDIA_USER' && userType !== 'INTERNATIONAL_USER' && userType !== 'ADMIN' && userType !== 'INDIA' && userType !== 'INTERNATIONAL')) {
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
    isIndianPendingKYC = userType === "INDIA_USER" && user?.kyc?.status !== "VERIFIED";
  }

  // Allow dashboard access regardless of KYC status - KYC will be checked when buying/selling

  // Calculate portfolio value (mock calculation)
  const portfolioValueINR = silverBalance * 7500; // Assuming 7500 INR per gram
  const portfolioValueUSD = silverBalance * 90; // Assuming 90 USD per gram

  const handleSignDummyTx = async () => {
    if (!publicKey) return;
    try {
      const signedXDR = await signDummyTx(publicKey);
      console.log('Signed XDR:', signedXDR);
      setSignedXDR(signedXDR);
    } catch (error) {
      console.error('Failed to sign transaction:', error);
    }
  };

  const handleTestTransaction = async () => {
    if (!publicKey || network !== 'TESTNET') return;
    setTxStatus('pending');
    try {
      const result = await stellarService.performTestTransaction(publicKey);
      setLastTxHash(result.hash);
      setTxStatus(result.successful ? 'success' : 'failed');
    } catch (error) {
      console.error('Failed to perform test transaction:', error);
      setTxStatus('failed');
    }
  };

  const handleSorobanReadCall = async () => {
    try {
      // Use placeholder contract ID for now
      const result = await stellarService.performSorobanReadCall('PLACEHOLDER_CONTRACT_ID');
      setSorobanReadResult(result);
    } catch (error) {
      console.error('Failed to perform Soroban read call:', error);
      setSorobanReadResult('Failed to read from contract');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      

      <div className="container py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary-text mb-1">
                Welcome back, {user?.name || 'User'}
              </h1>
              <p className="text-accent">Your silver portfolio at a glance</p>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-sm text-secondary-text">Portfolio Value</p>
              <p className="text-xl font-bold text-primary-text">₹{portfolioValueINR.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in-0 duration-500">
          {/* Left Column: Metrics and Actions */}
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-left-4 duration-700 delay-100">
              <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-emerald-400/80 mb-1">Silver Balance</p>
                      <p className="text-2xl font-bold text-white">{silverBalance}g</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">🥈</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-400/80 mb-1">Current Price</p>
                      <p className="text-2xl font-bold text-white">₹{currentPrice.toLocaleString()}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">📊</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-400/80 mb-1">Vault Status</p>
                      <p className="text-lg font-semibold text-white">{vaultStatus}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">🏦</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card variant="elevated" icon="⚡">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Manage your silver investments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  <Link href="/dashboard/trading">
                    <Button variant="success" size="lg" className="w-full justify-start">
                      <span>💰</span>
                      Buy Silver
                    </Button>
                  </Link>
                  <Link href="/dashboard/trading">
                    <Button variant="outline" size="lg" className="w-full justify-start border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
                      <span>📈</span>
                      Sell Silver
                    </Button>
                  </Link>
                  <Link href="/dashboard/loans">
                    <Button variant="outline" size="lg" className="w-full justify-start border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                      <span>🏦</span>
                      Get Loan
                    </Button>
                  </Link>
                  <Link href="/dashboard/redemption">
                    <Button variant="outline" size="lg" className="w-full justify-start border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
                      <span>🔄</span>
                      Redeem Physical
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Recent Activity */}
          <div>
            <Card className="border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-2xl text-white flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">📊</span>
                  </div>
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-slate-400">
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
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-[#10B981]/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl">✓</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#f1f5f9] mb-2">KYC Verification Required</h1>
          <p className="text-[#9CA3AF]">
            As an Indian user, you need to complete KYC verification to access the platform.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full px-3 py-2 border border-[#1F2937] rounded-lg bg-[#121826] text-[#f1f5f9] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#9CA3AF]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-3 py-2 border border-[#1F2937] rounded-lg bg-[#121826] text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#9CA3AF]"
              required
            >
              <option value="">Select document type</option>
              <option value="Passport">Passport</option>
              <option value="ID Card">ID Card</option>
              <option value="Driver License">Driver License</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Document Number</label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Enter document number"
              className="w-full px-3 py-2 border border-[#1F2937] rounded-lg bg-[#121826] text-[#f1f5f9] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#9CA3AF]"
              required
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg ${message.includes('successfully') ? 'bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444]'}`}>
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
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-[#F59E0B]/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#f1f5f9] mb-2">AML Verification Required</h1>
          <p className="text-[#9CA3AF]">
            As an international user, you must complete AML verification to access all platform features.
          </p>
        </div>

        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium text-[#F59E0B] mb-2">Required Documents:</h3>
          <ul className="text-sm text-[#9CA3AF] space-y-1">
            <li>• Proof of Identity (Passport, National ID)</li>
            <li>• Proof of Address (Utility Bill, Bank Statement)</li>
            <li>• Source of Funds Declaration</li>
            <li>• Any additional documents as requested</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
              Upload AML Document
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-[#1F2937] rounded-lg bg-[#121826] text-[#f1f5f9] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#9CA3AF] file:text-[#0B0F14] hover:file:bg-[#64748B]"
            />
            <p className="text-xs text-[#64748B] mt-1">
              Accepted formats: PDF, JPG, PNG (max 10MB)
            </p>
            {selectedFile && (
              <p className="text-xs text-[#10B981] mt-1">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
              Document Reference (Optional)
            </label>
            <input
              type="text"
              value={documentRef}
              onChange={(e) => setDocumentRef(e.target.value)}
              placeholder="Enter document reference or additional notes"
              className="w-full px-3 py-2 border border-[#1F2937] rounded-lg bg-[#121826] text-[#f1f5f9] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#9CA3AF]"
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg ${message.includes('successfully') ? 'bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444]'}`}>
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
