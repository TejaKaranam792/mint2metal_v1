"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSilverBalance, getDSTBalance, getTransactionHistory, transferBalance } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import Card from "@/components/Card";
import StatBox from "@/components/StatBox";
import Table from "@/components/Table";
import Badge from "@/components/Badge";

interface Transaction {
  id: string;
  date: string;
  type: string;
  amount: number;
  status: string;
  description: string;
}

export default function BalancePage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  const [silverBalance, setSilverBalance] = useState(0);
  const [dstBalance, setDstBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferRecipient, setTransferRecipient] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    } else {
      fetchData();
    }
  }, [isAuthenticated, router]);

  const fetchData = async () => {
    try {
      const [silverRes, dstRes, historyRes] = await Promise.all([
        getSilverBalance(),
        getDSTBalance(),
        getTransactionHistory(),
      ]);
      setSilverBalance(silverRes.balance);
      setDstBalance(dstRes.balance);
      setTransactions(historyRes.transactions);
    } catch (error) {
      console.error("Failed to fetch balance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferLoading(true);
    try {
      await transferBalance(parseFloat(transferAmount), transferRecipient);
      setTransferAmount("");
      setTransferRecipient("");
      fetchData(); // Refresh data
    } catch (error) {
      console.error("Transfer failed:", error);
    } finally {
      setTransferLoading(false);
    }
  };

  const refreshBalances = () => {
    fetchData();
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="animate-pulse text-lg text-[#9CA3AF]">Loading your balance...</div>
      </div>
    );
  }

  // Calculate portfolio value
  const portfolioValueINR = silverBalance * 7500;
  const portfolioValueUSD = silverBalance * 90;

  return (
    <div className="min-h-screen bg-[#0B0F14]">
      

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-[#f1f5f9]">Balance Overview</h1>
            <p className="text-[#64748b] mt-2">Manage your silver holdings and DST tokens</p>
          </div>
          <button
            onClick={refreshBalances}
            className="bg-[#121826] text-[#f1f5f9] px-4 py-2 rounded-lg hover:bg-[#1F2937] transition-colors border border-[#1F2937]"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Balances and Transfer */}
          <div className="space-y-6">
            {/* Balance Summary */}
            <div className="grid grid-cols-1 gap-6">
              <StatBox
                title="Silver Holdings"
                value={`${silverBalance}g`}
                change={{ value: 2.5, type: 'positive' }}
                icon={<span className="text-2xl">🥈</span>}
              />
              <StatBox
                title="DST Tokens"
                value={`${dstBalance.toLocaleString()}`}
                change={{ value: 1.2, type: 'positive' }}
                icon={<span className="text-2xl">🪙</span>}
              />
              <StatBox
                title="Portfolio Value (INR)"
                value={`₹${portfolioValueINR.toLocaleString()}`}
                change={{ value: 1.8, type: 'positive' }}
              />
              <StatBox
                title="Portfolio Value (USD)"
                value={`$${portfolioValueUSD.toLocaleString()}`}
                change={{ value: 1.8, type: 'positive' }}
              />
            </div>

            {/* Silver Holdings Breakdown */}
            <Card title="Silver Holdings Breakdown" subtitle="Detailed view of your silver assets">
              <div className="grid grid-cols-1 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#f1f5f9] mb-2">{(silverBalance * 0.6).toFixed(2)}g</div>
                  <div className="text-[#64748b]">Physical Vault</div>
                  <Badge variant="success" className="mt-2">Secured</Badge>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#f1f5f9] mb-2">{(silverBalance * 0.3).toFixed(2)}g</div>
                  <div className="text-[#64748b]">Digital Tokens</div>
                  <Badge variant="neutral" className="mt-2">Liquid</Badge>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#f1f5f9] mb-2">{(silverBalance * 0.1).toFixed(2)}g</div>
                  <div className="text-[#64748b]">In Transit</div>
                  <Badge variant="warning" className="mt-2">Pending</Badge>
                </div>
              </div>
            </Card>

            {/* DST Token Balance Section */}
            <Card title="DST Token Balance" subtitle="Your digital silver tokens">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-[#f1f5f9] mb-2">{dstBalance.toLocaleString()} DST</div>
                  <div className="text-[#64748b]">Equivalent to {dstBalance}g of silver</div>
                </div>
                <div className="text-right">
                  <div className="text-[#64748b]">Token Contract</div>
                  <div className="font-mono text-sm text-[#94a3b8]">0x1234...abcd</div>
                </div>
              </div>
            </Card>

            {/* Balance Transfer */}
            <Card title="Transfer Balance" subtitle="Send DST tokens to another address">
              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#94a3b8] mb-2">
                      Recipient Address
                    </label>
                    <input
                      type="text"
                      value={transferRecipient}
                      onChange={(e) => setTransferRecipient(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2 bg-[#121826] border border-[#1F2937] rounded-lg text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#9CA3AF]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#94a3b8] mb-2">
                      Amount (DST)
                    </label>
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 bg-[#121826] border border-[#1F2937] rounded-lg text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#9CA3AF]"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="bg-[#121826] text-[#f1f5f9] px-6 py-2 rounded-lg hover:bg-[#1F2937] transition-colors border border-[#1F2937] disabled:opacity-50"
                >
                  {transferLoading ? "Transferring..." : "Transfer DST Tokens"}
                </button>
              </form>
            </Card>
          </div>

          {/* Right Column: Transaction History */}
          <div>
            <Card title="Transaction History" subtitle="Your recent balance transactions">
              <Table
                headers={["Date", "Type", "Amount", "Status", "Description"]}
                rows={transactions.map(tx => [
                  tx.date,
                  tx.type,
                  `${tx.amount} ${tx.type === 'DST Transfer' ? 'DST' : 'g'}`,
                  <Badge key={tx.id} variant={tx.status === 'Completed' ? 'success' : tx.status === 'Pending' ? 'warning' : 'error'}>
                    {tx.status}
                  </Badge>,
                  tx.description
                ])}
              />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
