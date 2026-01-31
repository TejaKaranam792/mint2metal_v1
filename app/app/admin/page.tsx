
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getPendingRedemptions,
  approveRedemption,
  getPendingAML,
  clearAMLFlag,
  getAdminUsers,
  updateUserRole,
  getAdminTransactions,
  getAdminAnalytics,
  updateTransactionStatus,
  getSilverPrice,
  setSilverPrice,
  createSilverAsset,
  getVaultInventory,
  getMintEligibility,
  getFlaggedUsers,
  adminApproveRedemption,
  adminExecuteRedemption,
  adminDispatchRedemption,
  getRedemptionQueue,
  freezeUser,
  getAllKYC,
  adminApproveKYC,
  adminRejectKYC,
  getPendingLoanRequests,
  approveLoanRequest,
  rejectLoanRequest
} from "@/lib/api";

import Card from "@/components/Card";
import StatBox from "@/components/StatBox";
import Table from "@/components/Table";
import Badge from "@/components/Badge";

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
  pendingKYC: number;
  pendingAML: number;
  totalTransactions: number;
  totalVolume: number;
  activeUsers: number;
  systemHealth: string;
}

interface SilverPrice {
  id: string;
  pricePerGram: number;
  currency: string;
  setBy: string;
  setAt: string;
  active: boolean;
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
  const [pendingKYC, setPendingKYC] = useState<any[]>([]);
  const [pendingRedemptions, setPendingRedemptions] = useState<any[]>([]);
  const [pendingAML, setPendingAML] = useState<any[]>([]);
  const [pendingLoanRequests, setPendingLoanRequests] = useState<any[]>([]);
  const [silverPrice, setSilverPriceState] = useState<SilverPrice | null>(null);
  const [vaultInventory, setVaultInventory] = useState<VaultInventory | null>(null);
  const [kycQueue, setKycQueue] = useState<any>(null);
  const [redemptionQueue, setRedemptionQueue] = useState<any>(null);
  const [flaggedUsers, setFlaggedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [priceInput, setPriceInput] = useState('');
  const [currentPrice, setCurrentPrice] = useState(7500); // INR per gram

  useEffect(() => {
    if (!isAuthenticated || userType !== 'ADMIN') {
      router.push('/auth/login');
    } else {
      fetchData();
    }
  }, [isAuthenticated, userType, router]);

  const fetchData = async () => {
    try {
      const [usersRes, transactionsRes, analyticsRes, pendingRedemptionsRes, pendingAMLRes, kycRecordsRes, pendingLoanRequestsRes] = await Promise.all([
        userType === 'ADMIN' ? getAdminUsers() : Promise.resolve([]),
        userType === 'ADMIN' ? getAdminTransactions() : Promise.resolve([]),
        userType === 'ADMIN' ? getAdminAnalytics() : Promise.resolve(null),
        userType === 'ADMIN' ? getPendingRedemptions() : Promise.resolve([]),
        userType === 'ADMIN' ? getPendingAML() : Promise.resolve([]),
        userType === 'ADMIN' ? getAllKYC() : Promise.resolve([]),
        userType === 'ADMIN' ? getPendingLoanRequests() : Promise.resolve([]),
      ]);
      setUsers(usersRes);
      setTransactions(transactionsRes);
      setAnalytics(analyticsRes);
      setPendingRedemptions(pendingRedemptionsRes.pendingRedemptions || []);
      setPendingAML(Array.isArray(pendingAMLRes) ? pendingAMLRes : []);
      setPendingKYC(kycRecordsRes || []);
      setPendingLoanRequests(pendingLoanRequestsRes);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };



  const handleApproveRedemption = async (redemptionId: string) => {
    try {
      await approveRedemption(redemptionId);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Failed to approve redemption:', error);
    }
  };

  const handleApproveAML = async (userId: string) => {
    try {
      await clearAMLFlag(userId, "Approved by admin");
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Failed to approve AML:', error);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      await updateUserRole(userId, role);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Failed to update user role:', error);
    }
  };

  const handleUpdateTransactionStatus = async (transactionId: string, status: string) => {
    try {
      await updateTransactionStatus(transactionId, status);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Failed to update transaction status:', error);
    }
  };

  const handleApproveKYC = async (userId: string) => {
    try {
      await adminApproveKYC(userId);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Failed to approve KYC:', error);
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

  if (!isAuthenticated || userType !== 'ADMIN') return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="animate-pulse text-lg text-[#9CA3AF]">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#f1f5f9]">
      

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center mb-4">
          <p className="text-[#9CA3AF]">Role: Vault, KYC & Settlement Authority</p>
        </div>
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-8">
          {['overview', 'users', 'transactions', 'pending', 'price'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg capitalize ${
                activeTab === tab ? 'bg-[#1F2937] text-[#f1f5f9]' : 'bg-[#121826] text-[#9CA3AF] hover:bg-[#1F2937]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <StatBox title="Total Users" value={analytics.totalUsers.toString()} />
            <StatBox title="Verified Users" value={analytics.verifiedUsers.toString()} />
            <StatBox title="Pending KYC" value={analytics.pendingKYC.toString()} />
            <StatBox title="Pending AML" value={analytics.pendingAML.toString()} />
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
                    className="bg-[#121826] text-[#f1f5f9] px-2 py-1 rounded"
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
                    className="bg-[#121826] text-[#f1f5f9] px-2 py-1 rounded"
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
            <Card title="Pending KYC Approvals">
              <Table
                headers={['User ID', 'Email', 'Country', 'Actions']}
                rows={pendingKYC.map((item: any) => [
                  item.id,
                  item.email,
                  item.country,
                  <button
                    key={`kyc-approve-${item.id}`}
                    onClick={() => handleApproveKYC(item.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Approve
                  </button>
                ])}
              />
            </Card>

            <Card title="Pending Redemptions">
              <Table
                headers={['ID', 'User ID', 'Amount', 'Status', 'Actions']}
                rows={pendingRedemptions.map((item: any) => [
                  item.id,
                  item.userId,
                  item.amount.toString(),
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

            <Card title="Pending AML Approvals">
              <Table
                headers={['ID', 'Email', 'Country', 'Actions']}
                rows={pendingAML.map((item: any) => [
                  item.id,
                  item.email,
                  item.country,
                  <button
                    key={`aml-approve-${item.id}`}
                    onClick={() => handleApproveAML(item.id)}
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
          <div className="space-y-8">
            <Card title="Silver Price Management">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
                      Current Silver Price (₹ per gram)
                    </label>
                    <div className="text-2xl font-bold text-[#f1f5f9]">
                      ₹{currentPrice.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
                      Set New Price (₹ per gram)
                    </label>
                    <input
                      type="number"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      placeholder="Enter new price"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 bg-[#121826] border border-[#1F2937] rounded-lg text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#9CA3AF]"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={async () => {
                      if (!priceInput || parseFloat(priceInput) <= 0) {
                        alert('Please enter a valid price');
                        return;
                      }
                      try {
                        await setSilverPrice(parseFloat(priceInput));
                        setCurrentPrice(parseFloat(priceInput));
                        setPriceInput('');
                        alert('Silver price updated successfully!');
                      } catch (error) {
                        console.error('Failed to update price:', error);
                        alert('Failed to update price');
                      }
                    }}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                  >
                    Update Price
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const priceData = await getSilverPrice();
                        if (priceData && priceData.price) {
                          setCurrentPrice(priceData.price.pricePerGram);
                        }
                      } catch (error) {
                        console.error('Failed to fetch current price:', error);
                      }
                    }}
                    className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
                  >
                    Refresh Price
                  </button>
                </div>

                <div className="bg-[#121826] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-[#94a3b8] mb-2">Price Update Guidelines</h4>
                  <ul className="text-sm text-[#64748b] space-y-1">
                    <li>• Price should reflect current market rates</li>
                    <li>• Updates affect all trading and valuation calculations</li>
                    <li>• Changes are effective immediately</li>
                    <li>• Historical prices are maintained for audit purposes</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

