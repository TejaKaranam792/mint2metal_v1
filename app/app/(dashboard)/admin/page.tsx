
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getPendingRedemptions,
  approveRedemption,
  getAdminUsers,
  updateUserRole,
  getAdminTransactions,
  getAdminAnalytics,
  updateTransactionStatus,
  getOraclePrice,
  getOracleStatus,
  getOracleHistory,
  emergencyPauseOracle,
  unpauseOracle,
  createSilverAsset,
  getVaultInventory,
  getMintEligibility,
  adminApproveRedemption,
  adminExecuteRedemption,
  adminDispatchRedemption,
  getRedemptionQueue,
  freezeUser,
  getPendingLoanRequests,
  approveLoanRequest,
  rejectLoanRequest,
  getTreasuryBalance,
  requestMint,
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus
} from "@/lib/api";

import Card from "@/components/Card";
import StatBox from "@/components/StatBox";
import Table from "@/components/Table";
import Badge from "@/components/Badge";
import DeveloperPortal from "../dashboard/developer/page";

interface User {
  id: string;
  email: string;
  country: string;
  kycStatus: string;
  amlStatus: string;
  role: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  status: string;
  timestamp: string;
  description: string;
}

interface Analytics {
  totalUsers: number;
  verifiedUsers: number;
  totalTransactions: number;
  totalVolume: number;
  activeUsers: number;
  systemHealth: string;
}

interface OraclePriceData {
  pricePerGram: number;
  pricePerOz: number;
  lastUpdatedAt: string;
  lastUpdatedAgo: string;
  isPaused: boolean;
  isStale: boolean;
  source: string;
  health?: string;
}

interface OracleStatusData {
  health: string;
  currentPrice: number;
  lastUpdatedAt: string;
  lastUpdatedAgo: string;
  isPaused: boolean;
  source: string;
  scheduler: { isRunning: boolean; consecutiveFailures: number; schedule: string };
  stats: {
    totalAccepted: number;
    totalRejected: number;
    lastSubmission: any;
  };
}

interface VaultInventory {
  assets: any[];
  totalWeight: number;
  totalValue: number;
  count: number;
}

const getStatusVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'verified':
    case 'completed':
    case 'cleared':
      return 'success';
    case 'pending':
      return 'warning';
    case 'rejected':
    case 'failed':
      return 'error';
    default:
      return 'neutral';
  }
};

export default function AdminDashboard() {
  const router = useRouter();
  const { isAuthenticated, userType, user } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [pendingRedemptions, setPendingRedemptions] = useState<any[]>([]);
  const [pendingLoanRequests, setPendingLoanRequests] = useState<any[]>([]);
  const [oraclePriceData, setOraclePriceData] = useState<OraclePriceData | null>(null);
  const [oracleStatus, setOracleStatus] = useState<OracleStatusData | null>(null);
  const [oracleHistory, setOracleHistory] = useState<any[]>([]);
  const [oracleLoading, setOracleLoading] = useState(false);
  const [oracleActionLoading, setOracleActionLoading] = useState(false);
  const [vaultInventory, setVaultInventory] = useState<VaultInventory | null>(null);
  const [redemptionQueue, setRedemptionQueue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [treasuryBalance, setTreasuryBalance] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState('');
  const [vaultId, setVaultId] = useState('');
  const [vaultName, setVaultName] = useState('');
  const [ipfsCid, setIpfsCid] = useState('');
  const [commodityType, setCommodityType] = useState('XAG');
  const [gramsSecured, setGramsSecured] = useState('');
  const [isMinting, setIsMinting] = useState(false);

  // Vault/Purchase Order states
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({ dealerName: '', weightGrams: '', pricePerGram: '' });

  useEffect(() => {
    if (!isAuthenticated || userType !== 'ADMIN') {
      router.push('/auth/login');
    } else {
      fetchData();
    }
  }, [isAuthenticated, userType, router]);

  const fetchData = async () => {
    try {
      const [usersRes, transactionsRes, analyticsRes, pendingRedemptionsRes, pendingLoanRequestsRes, vaultInvRes, ordersRes] = await Promise.all([
        userType === 'ADMIN' ? getAdminUsers() : Promise.resolve([]),
        userType === 'ADMIN' ? getAdminTransactions() : Promise.resolve([]),
        userType === 'ADMIN' ? getAdminAnalytics() : Promise.resolve(null),
        userType === 'ADMIN' ? getPendingRedemptions() : Promise.resolve([]),
        userType === 'ADMIN' ? getPendingLoanRequests() : Promise.resolve([]),
        userType === 'ADMIN' ? getVaultInventory() : Promise.resolve(null),
        userType === 'ADMIN' ? getPurchaseOrders() : Promise.resolve([]),
      ]);
      setUsers(usersRes);
      setTransactions(transactionsRes);
      setAnalytics(analyticsRes);
      setPendingRedemptions(pendingRedemptionsRes.pendingRedemptions || []);
      setPendingLoanRequests(pendingLoanRequestsRes);
      setVaultInventory(vaultInvRes);
      setPurchaseOrders(ordersRes);

      if (userType === 'ADMIN') {
        const treasuryRes = await getTreasuryBalance();
        setTreasuryBalance(treasuryRes.balance);
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOracleData = async () => {
    setOracleLoading(true);
    try {
      const [priceData, statusData, historyData] = await Promise.all([
        getOraclePrice().catch(() => null),
        getOracleStatus().catch(() => null),
        getOracleHistory(10).catch(() => ({ submissions: [] })),
      ]);
      if (priceData) setOraclePriceData(priceData);
      if (statusData) setOracleStatus(statusData);
      setOracleHistory(historyData?.submissions ?? []);
    } catch (error) {
      console.error('Failed to fetch oracle data:', error);
    } finally {
      setOracleLoading(false);
    }
  };



  const handleApproveRedemption = async (redemptionId: string) => {
    try {
      await adminApproveRedemption(redemptionId);
      alert('Redemption approved — delivery process initiated. (Tokens were burned during the user request phase)');
      fetchData();
    } catch (error: any) {
      const msg = error?.message || 'Unknown error';
      console.error('Failed to approve redemption:', msg);

      if (msg.includes('force override') || msg.includes('op_not_clawback_enabled')) {
        const force = window.confirm(`Approval failed due to a legacy token balance that cannot be burned: \n\n${msg}\n\nDo you want to FORCE approve this redemption anyway? (The tokens will NOT be burned on-chain)`);
        if (force) {
          try {
            await adminApproveRedemption(redemptionId, true);
            alert('Redemption FORCE approved — shipment initiated (tokens were NOT burned).');
            fetchData();
          } catch (forceError: any) {
            alert(`Force Approval failed: ${forceError?.message || 'Unknown error'}`);
          }
        }
      } else {
        alert(`Approval failed: ${msg}`);
      }
    }
  };



  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      await updateUserRole(userId, role);
      fetchData();
    } catch (error) {
      console.error('Failed to update user role:', error);
    }
  };

  const handleUpdateTransactionStatus = async (transactionId: string, status: string) => {
    try {
      await updateTransactionStatus(transactionId, status);
      fetchData();
    } catch (error) {
      console.error('Failed to update transaction status:', error);
    }
  };

  const handleApproveLoanRequest = async (loanId: string) => {
    try {
      await approveLoanRequest(loanId);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Failed to approve loan request:', error);
    }
  };

  const handleRejectLoanRequest = async (loanId: string) => {
    try {
      await rejectLoanRequest(loanId);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Failed to reject loan request:', error);
    }
  };

  const handleMintToTreasury = async () => {
    if (!receiptId || !vaultId || !gramsSecured || parseFloat(gramsSecured) <= 0) {
      alert('Please fill all fields for custody verification (Receipt ID, Vault ID, Weight).');
      return;
    }

    // ─── IPFS CID validation (mirrors backend) ────────────────────────────────
    const trimmedCid = ipfsCid.trim();
    if (!trimmedCid) {
      alert('IPFS CID is required.\n\nUpload your proof-of-reserve document to IPFS (e.g. via nft.storage or pinata.cloud) and paste the resulting CID here.');
      return;
    }
    if (!trimmedCid.startsWith('Qm') && !trimmedCid.startsWith('bafy') && !trimmedCid.startsWith('bafk')) {
      alert(`Invalid IPFS CID format.\nCIDs must start with "Qm" (v0) or "bafy"/"bafk" (v1).\nYou entered: "${trimmedCid}"`);
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    setIsMinting(true);
    try {
      const res = await requestMint(gramsSecured, receiptId, vaultId, trimmedCid, vaultName || vaultId);

      const txShort = (res.txHash || 'Unknown').slice(0, 8);
      const ipfsLink = res.ipfsUrl || `https://ipfs.io/ipfs/${trimmedCid}`;
      alert(
        `✅ Successfully minted ${gramsSecured} ${commodityType}!\n` +
        `Tx: ${txShort}...\n` +
        `New Treasury Balance: ${res.newBalance} XAG\n\n` +
        `📎 Proof of Reserve (IPFS):\n${ipfsLink}\n\n` +
        `🔗 CID anchored on Stellar treasury account data.`
      );
      const treasuryRes = await getTreasuryBalance();
      setTreasuryBalance(treasuryRes.balance);
      setReceiptId('');
      setVaultId('');
      setVaultName('');
      setIpfsCid('');
      setGramsSecured('');
    } catch (error: any) {
      console.error('Minting failed:', error);
      alert(`Minting failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsMinting(false);
    }
  };


  const handleCreatePurchaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPurchaseOrder(newOrder.dealerName, parseFloat(newOrder.weightGrams), parseFloat(newOrder.pricePerGram));
      setIsCreatingOrder(false);
      setNewOrder({ dealerName: '', weightGrams: '', pricePerGram: '' });
      fetchData(); // Refresh orders
      alert("Purchase order created successfully.");
    } catch (error: any) {
      console.error('Failed to create purchase order:', error);
      alert(`Failed to create order: ${error.message || 'Unknown error'}`);
    }
  };

  const handleUpdatePurchaseOrderStatus = async (orderId: string, status: 'RECEIVED' | 'CANCELLED') => {
    try {
      // If received, we ideally need to provide serial numbers/assay reports, but for the mock/simplicity we'll pass empty arrays or defaults
      const serialNumbers = status === 'RECEIVED' ? [`SN-${Date.now()}`] : undefined;
      await updatePurchaseOrderStatus(orderId, status, serialNumbers);
      fetchData(); // Refresh orders and inventory
      alert(`Purchase order marked as ${status}.`);
    } catch (error: any) {
      console.error(`Failed to update order status to ${status}:`, error);
      alert(`Failed to update order to ${status}: ${error.message || 'Unknown error'}`);
    }
  };

  if (!isAuthenticated || userType !== 'ADMIN') return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-lg text-muted-foreground">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">


      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center mb-4">
          <p className="text-muted-foreground">Role: Vault, KYC & Settlement Authority</p>
        </div>
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-8">
          {['overview', 'users', 'transactions', 'pending', 'price', 'treasury', 'vault', 'developer'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'price') fetchOracleData();
              }}
              className={`px-4 py-2 rounded-lg capitalize ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'bg-surface hover:bg-surface-elevated text-muted-foreground'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && analytics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatBox title="Total Users" value={analytics.totalUsers.toString()} />
            <StatBox title="Verified Users" value={analytics.verifiedUsers.toString()} />
            <StatBox title="System Health" value={analytics.systemHealth} />
          </div>
        )}

        {activeTab === 'users' && (
          <Card title="User Management">
            <Table
              headers={['Email', 'Country', 'KYC Status', 'AML Status', 'Role', 'Actions']}
              rows={users.map((user) => [
                user.email,
                user.country,
                <Badge key={`kyc-${user.id}`} variant={getStatusVariant(user.kycStatus)}>{user.kycStatus}</Badge>,
                <Badge key={`aml-${user.id}`} variant={getStatusVariant(user.amlStatus)}>{user.amlStatus}</Badge>,
                user.role,
                <div key={`actions-${user.id}`} className="space-x-2">
                  <select
                    value={user.role}
                    onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                    className="bg-surface text-foreground border border-border px-2 py-1 rounded"
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              ])}
            />
          </Card>
        )}

        {activeTab === 'transactions' && (
          <Card title="Transaction Management">
            <Table
              headers={['ID', 'User ID', 'Type', 'Amount', 'Status', 'Timestamp', 'Actions']}
              rows={transactions.map((tx) => [
                tx.id,
                tx.userId,
                tx.type,
                tx.amount.toString(),
                <Badge key={`tx-${tx.id}`} variant={getStatusVariant(tx.status)}>{tx.status}</Badge>,
                tx.timestamp,
                <div key={`tx-actions-${tx.id}`} className="space-x-2">
                  <select
                    value={tx.status}
                    onChange={(e) => handleUpdateTransactionStatus(tx.id, e.target.value)}
                    className="bg-surface text-foreground border border-border px-2 py-1 rounded"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>
              ])}
            />
          </Card>
        )}

        {activeTab === 'pending' && (
          <div className="space-y-8">
            <Card title="Pending Redemptions">
              <Table
                headers={['ID', 'User ID', 'Amount', 'Status', 'Actions']}
                rows={pendingRedemptions.map((item: any) => [
                  item.id,
                  item.userId,
                  item.quantity?.toString() || '0',
                  item.status,
                  <button
                    key={`redemption-approve-${item.id}`}
                    onClick={() => handleApproveRedemption(item.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Approve
                  </button>
                ])}
              />
            </Card>

            <Card title="Pending Loan Requests">
              <Table
                headers={['ID', 'User ID', 'Collateral (g)', 'Requested Amount', 'Status', 'Actions']}
                rows={pendingLoanRequests.map((item: any) => [
                  item.id,
                  item.userId,
                  item.collateralGrams.toString(),
                  item.requestedAmount.toString(),
                  <Badge key={`loan-${item.id}`} variant={getStatusVariant(item.status)}>{item.status}</Badge>,
                  <div key={`loan-actions-${item.id}`} className="space-x-2">
                    <button
                      onClick={() => handleApproveLoanRequest(item.id)}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectLoanRequest(item.id)}
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                ])}
              />
            </Card>
          </div>
        )}

        {activeTab === 'price' && (
          <div className="space-y-6">
            {/* Oracle Status Header */}
            <Card title="Oracle Price Feed">
              <div className="space-y-6">

                {/* Health + Price Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* Current Price */}
                  <div className="bg-surface p-5 rounded-xl border border-border col-span-1 md:col-span-1">
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Live Silver Price</p>
                    <div className="text-3xl font-bold text-foreground">
                      {oraclePriceData ? `$${oraclePriceData.pricePerGram.toFixed(4)}` : oracleLoading ? '...' : 'N/A'}
                      <span className="text-base font-normal text-muted-foreground ml-1">/gram</span>
                    </div>
                    {oraclePriceData && (
                      <p className="text-sm text-muted-foreground mt-1">${oraclePriceData.pricePerOz.toFixed(2)}/oz (troy)</p>
                    )}
                  </div>

                  {/* Oracle Health */}
                  <div className="bg-surface p-5 rounded-xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Oracle Health</p>
                    <div className={`text-2xl font-bold ${oracleStatus?.health === 'HEALTHY' ? 'text-emerald-400' :
                      oracleStatus?.health === 'PAUSED' ? 'text-red-400' :
                        oracleStatus?.health === 'STALE' ? 'text-amber-400' : 'text-orange-400'
                      }`}>
                      {oracleStatus?.health ?? (oracleLoading ? '...' : 'UNKNOWN')}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {oracleStatus?.scheduler?.consecutiveFailures
                        ? `${oracleStatus.scheduler.consecutiveFailures} consecutive failures`
                        : 'No recent failures'}
                    </p>
                  </div>

                  {/* Source + Last Update */}
                  <div className="bg-surface p-5 rounded-xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Source</p>
                    <div className="text-lg font-semibold text-foreground">{oraclePriceData?.source ?? 'Median Oracle'}</div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Updated: {oraclePriceData?.lastUpdatedAgo ?? 'Never'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Schedule: {oracleStatus?.scheduler?.schedule ?? 'Every 5 min'}
                    </p>
                  </div>
                </div>

                {/* Stats Row */}
                {oracleStatus?.stats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-surface p-3 rounded-lg border border-border text-center">
                      <div className="text-lg font-bold text-emerald-400">{oracleStatus.stats.totalAccepted}</div>
                      <div className="text-xs text-muted-foreground">Accepted Prices</div>
                    </div>
                    <div className="bg-surface p-3 rounded-lg border border-border text-center">
                      <div className="text-lg font-bold text-red-400">{oracleStatus.stats.totalRejected}</div>
                      <div className="text-xs text-muted-foreground">Rejected Prices</div>
                    </div>
                    <div className="bg-surface p-3 rounded-lg border border-border text-center">
                      <div className="text-lg font-bold text-foreground">{oracleStatus.stats.lastSubmission?.source ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">Last Sources</div>
                    </div>
                    <div className="bg-surface p-3 rounded-lg border border-border text-center">
                      <div className={`text-lg font-bold ${oracleStatus.isPaused ? 'text-red-400' : 'text-emerald-400'}`}>
                        {oracleStatus.isPaused ? 'PAUSED' : 'ACTIVE'}
                      </div>
                      <div className="text-xs text-muted-foreground">Submission Status</div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={fetchOracleData}
                    disabled={oracleLoading}
                    className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-foreground hover:bg-surface-elevated transition-colors"
                  >
                    {oracleLoading ? 'Refreshing...' : '🔄 Refresh Status'}
                  </button>

                  {oracleStatus?.isPaused ? (
                    <button
                      onClick={async () => {
                        if (!confirm('Unpause the oracle? Price submissions will resume immediately.')) return;
                        setOracleActionLoading(true);
                        try {
                          await unpauseOracle();
                          alert('Oracle unpaused. Price updates will resume shortly.');
                          fetchOracleData();
                        } catch (e: any) {
                          alert(`Failed to unpause: ${e.message}`);
                        } finally { setOracleActionLoading(false); }
                      }}
                      disabled={oracleActionLoading}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors"
                    >
                      ✅ Unpause Oracle
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        if (!confirm('⚠️ EMERGENCY PAUSE: This will halt all price updates. Confirm?')) return;
                        setOracleActionLoading(true);
                        try {
                          await emergencyPauseOracle();
                          alert('Oracle paused. No price updates will occur until manually unpaused.');
                          fetchOracleData();
                        } catch (e: any) {
                          alert(`Failed to pause: ${e.message}`);
                        } finally { setOracleActionLoading(false); }
                      }}
                      disabled={oracleActionLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                    >
                      ⏸ Emergency Pause
                    </button>
                  )}
                </div>

                {/* Information Note */}
                <div className="bg-surface p-4 rounded-lg border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-2">🔒 Decentralized Oracle Pricing</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Price is fetched every 5 minutes from 2 independent sources (Metals.live + Yahoo Finance/ER-API)</li>
                    <li>• Median of both sources is computed before submission to Soroban contract</li>
                    <li>• Contract rejects price if deviation &gt;5% from last accepted price (tamper protection)</li>
                    <li>• Contract rejects price if timestamp is older than 1 hour (freshness guard)</li>
                    <li>• Circuit breaker auto-pauses oracle after 3 consecutive anomalies</li>
                    <li>• <strong>Admin cannot manually set prices</strong> — only oracle can update pricing</li>
                  </ul>
                </div>

                {/* Recent History Table */}
                {oracleHistory.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Recent Price Submissions</h4>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-surface-elevated text-muted-foreground text-left">
                            <th className="px-3 py-2">Time</th>
                            <th className="px-3 py-2">Price/g</th>
                            <th className="px-3 py-2">Source</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">TxHash</th>
                          </tr>
                        </thead>
                        <tbody>
                          {oracleHistory.map((row: any) => (
                            <tr key={row.id} className="border-t border-border hover:bg-surface-elevated/50">
                              <td className="px-3 py-2 text-muted-foreground">
                                {new Date(row.submittedAt).toLocaleTimeString()}
                              </td>
                              <td className="px-3 py-2 font-mono">${row.pricePerGram.toFixed(4)}</td>
                              <td className="px-3 py-2 text-muted-foreground">{row.source}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.accepted ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                                  }`}>
                                  {row.accepted ? '✓ ACCEPTED' : '✗ REJECTED'}
                                </span>
                                {row.rejectedReason && (
                                  <span className="ml-2 text-xs text-muted-foreground">{row.rejectedReason}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                {row.txHash ? `${row.txHash.slice(0, 8)}...` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'treasury' && (
          <div className="space-y-8">
            <Card title="Treasury Buffer Management">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-surface p-6 rounded-lg border border-border">
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Current Treasury Balance
                    </label>
                    <div className="text-4xl font-bold text-foreground">
                      {treasuryBalance !== null ? `${parseFloat(treasuryBalance).toLocaleString()} g` : 'Loading...'}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Locked tokens awaiting user purchase (1:1 silver backed)
                    </p>
                  </div>

                  <div className="bg-surface p-6 rounded-lg border border-border">
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Tokenize Asset (Custody Proof)</h3>
                    <div className="space-y-4">

                      {/* Row 1: Receipt ID + Asset */}
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-muted-foreground mb-1">Receipt ID</label>
                          <input
                            type="text"
                            value={receiptId}
                            onChange={(e) => setReceiptId(e.target.value)}
                            placeholder="e.g. VR-1002"
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                          />
                        </div>
                        <div className="w-1/3">
                          <label className="block text-sm font-medium text-muted-foreground mb-1">Asset</label>
                          <select
                            value={commodityType}
                            onChange={(e) => setCommodityType(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                          >
                            <option value="XAG">XAG (Silver)</option>
                            <option value="XAU">XAU (Gold)</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Vault ID + Vault Name */}
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-muted-foreground mb-1">Vault ID</label>
                          <input
                            type="text"
                            value={vaultId}
                            onChange={(e) => setVaultId(e.target.value)}
                            placeholder="e.g. brinks-ny-01"
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-muted-foreground mb-1">Vault Name</label>
                          <input
                            type="text"
                            value={vaultName}
                            onChange={(e) => setVaultName(e.target.value)}
                            placeholder="e.g. Brinks New York"
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                          />
                        </div>
                      </div>

                      {/* Row 3: Weight */}
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Weight / Amount (grams)</label>
                        <input
                          type="number"
                          value={gramsSecured}
                          onChange={(e) => setGramsSecured(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>

                      {/* Row 4: IPFS CID — REQUIRED */}
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-warning, #f59e0b)' }}>
                          🔗 IPFS CID <span className="text-xs font-normal text-muted-foreground">(required — proof of reserve document)</span>
                        </label>
                        <input
                          type="text"
                          value={ipfsCid}
                          onChange={(e) => setIpfsCid(e.target.value)}
                          placeholder="bafyreib2ujsuymsyqnk3ys3ard7hv4ppbyugkqkynha5buuqmhqnwzlhq"
                          className={`w-full px-3 py-2 bg-background border rounded-lg text-foreground font-mono text-sm focus:ring-2 focus:ring-primary outline-none ${ipfsCid && !ipfsCid.trim().startsWith('Qm') && !ipfsCid.trim().startsWith('bafy') && !ipfsCid.trim().startsWith('bafk')
                              ? 'border-red-500 focus:ring-red-500'
                              : ipfsCid.trim()
                                ? 'border-emerald-500 focus:ring-emerald-500'
                                : 'border-border'
                            }`}
                        />
                        {ipfsCid.trim() && (
                          <div className="mt-1 flex items-center gap-2">
                            {(ipfsCid.trim().startsWith('Qm') || ipfsCid.trim().startsWith('bafy') || ipfsCid.trim().startsWith('bafk')) ? (
                              <>
                                <span className="text-xs text-emerald-400">✓ Valid CID</span>
                                <a
                                  href={`https://ipfs.io/ipfs/${ipfsCid.trim()}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary underline"
                                >
                                  Preview on IPFS ↗
                                </a>
                              </>
                            ) : (
                              <span className="text-xs text-red-400">✗ Invalid CID — must start with Qm, bafy, or bafk</span>
                            )}
                          </div>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Upload to{' '}
                          <a href="https://nft.storage" target="_blank" rel="noopener noreferrer" className="text-primary underline">nft.storage</a>{' '}or{' '}
                          <a href="https://pinata.cloud" target="_blank" rel="noopener noreferrer" className="text-primary underline">Pinata</a>{' '}
                          and paste the CID. It will be anchored immutably on the Stellar treasury account.
                        </p>
                      </div>

                      <button
                        onClick={handleMintToTreasury}
                        disabled={isMinting}
                        className={`w-full py-3 rounded-lg font-bold transition-all ${isMinting
                          ? 'bg-muted cursor-not-allowed text-muted-foreground'
                          : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-95'
                          }`}
                      >
                        {isMinting ? 'Anchoring CID & Minting...' : '🔒 Confirm Custody & Mint'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-surface p-4 rounded-lg border border-border">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Treasury Buffer Model Guidelines</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• **Minting** creates new DST tokens on-chain but retains them in the protocol treasury.</li>
                    <li>• No tokens should ever be minted without corresponding physical silver grams in the vault.</li>
                    <li>• The 1:1 backing ratio is enforced by the smart contract's transparency layer.</li>
                    <li>• All minting transactions are visible to the public on the Stellar network.</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'vault' && (
          <div className="space-y-8">
            <Card title="Vault Physical Inventory">
              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatBox title="Unminted Silver" value={`${vaultInventory?.totalWeight?.toLocaleString() ?? 0} g`} />
                <StatBox title="Active Assets" value={(vaultInventory?.count ?? 0).toString()} />
                <StatBox title="Estimated Value" value={`$${((vaultInventory?.totalWeight ?? 0) * currentPrice).toLocaleString()}`} />
              </div>

              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">Purchase Orders (Dealer &lt;-&gt; Vault)</h3>
                <button
                  onClick={() => setIsCreatingOrder(true)}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                  + New Order
                </button>
              </div>

              {isCreatingOrder && (
                <div className="bg-surface p-6 rounded-lg border border-border mb-6">
                  <h4 className="text-md font-medium text-foreground mb-4">Create Physical Purchase Order</h4>
                  <form onSubmit={handleCreatePurchaseOrder} className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-muted-foreground mb-1">Dealer/Supplier Name</label>
                      <input
                        type="text"
                        required
                        value={newOrder.dealerName}
                        onChange={(e) => setNewOrder({ ...newOrder, dealerName: e.target.value })}
                        placeholder="e.g. APMEX, local dealer"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-muted-foreground mb-1">Total Weight (g)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={newOrder.weightGrams}
                        onChange={(e) => setNewOrder({ ...newOrder, weightGrams: e.target.value })}
                        placeholder="1000"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-muted-foreground mb-1">Cost per Gram ($)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.0001"
                        value={newOrder.pricePerGram}
                        onChange={(e) => setNewOrder({ ...newOrder, pricePerGram: e.target.value })}
                        placeholder="0.80"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">Submit</button>
                      <button type="button" onClick={() => setIsCreatingOrder(false)} className="bg-surface-elevated text-foreground border border-border px-4 py-2 rounded-lg hover:bg-muted">Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              <Table
                headers={['Order ID', 'Date', 'Dealer', 'Weight (g)', 'Total Cost', 'Status', 'Actions']}
                rows={purchaseOrders.map((order) => [
                  order.id,
                  new Date(order.orderDate).toLocaleDateString(),
                  order.dealerName,
                  order.weightGrams,
                  `$${order.totalAmount.toFixed(2)}`,
                  <Badge key={order.id} variant={getStatusVariant(order.status === 'RECEIVED' ? 'COMPLETED' : order.status === 'ORDERED' ? 'PENDING' : order.status)}>{order.status}</Badge>,
                  order.status === 'ORDERED' || order.status === 'CONFIRMED' ? (
                    <div key={`acts-${order.id}`} className="flex space-x-2">
                      <button onClick={() => handleUpdatePurchaseOrderStatus(order.id, 'RECEIVED')} className="text-xs bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 px-2 py-1 rounded hover:bg-emerald-600/30">Mark Received</button>
                      <button onClick={() => handleUpdatePurchaseOrderStatus(order.id, 'CANCELLED')} className="text-xs bg-red-600/20 text-red-500 border border-red-500/30 px-2 py-1 rounded hover:bg-red-600/30">Cancel</button>
                    </div>
                  ) : <span key={`acted-${order.id}`} className="text-muted-foreground text-xs">No actions</span>
                ])}
              />
            </Card>
          </div>
        )}

        {/* Developer API Management Tab */}
        {activeTab === 'developer' && (
          <div className="bg-surface rounded-lg w-full">
            <DeveloperPortal embedded={true} />
          </div>
        )}
      </main>
    </div>
  );
}

