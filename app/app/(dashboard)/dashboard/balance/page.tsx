"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSilverBalance, getDSTBalance, getTransactionHistory, transferBalance, getSilverPriceM2M, getLinkedWallet, connectExternalWallet } from "@/lib/api";
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
  const [linkedWallet, setLinkedWallet] = useState<string | null>(null);
  const [freighterAddress, setFreighterAddress] = useState<string | null>(null);
  const [walletMismatch, setWalletMismatch] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferRecipient, setTransferRecipient] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    } else {
      fetchData();
    }
  }, [isAuthenticated, router]);

  const fetchData = async () => {
    try {
      const [silverRes, dstRes, historyRes, walletRes] = await Promise.all([
        getSilverBalance(),
        getDSTBalance(),
        getTransactionHistory(),
        getLinkedWallet(),
      ]);
      setSilverBalance(silverRes.balance);
      setDstBalance(dstRes.balance);
      setTransactions(historyRes.transactions);

      if (walletRes?.address) {
        setLinkedWallet(walletRes.address);
        // Check if Freighter is connected and compare addresses
        try {
          const FreighterApi = await import('@stellar/freighter-api');
          const connResult = await FreighterApi.isConnected();
          const connected = typeof connResult === 'object' ? (connResult as any).isConnected : connResult;
          if (connected) {
            const addrResult = await FreighterApi.getAddress();
            const fAddr = typeof addrResult === 'object' ? (addrResult as any).address : addrResult;
            setFreighterAddress(fAddr);
            setWalletMismatch(!!fAddr && fAddr !== walletRes.address);
          }
        } catch { /* Freighter not installed */ }
      }

      try {
        const priceRes = await getSilverPriceM2M();
        if (priceRes?.pricePerGram) setCurrentPrice(priceRes.pricePerGram);
      } catch { /* keep default */ }
    } catch (error) {
      console.error("Failed to fetch balance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReconnectFreighter = async () => {
    setReconnecting(true);
    try {
      const FreighterApi = await import('@stellar/freighter-api');
      await FreighterApi.requestAccess();
      const addrResult = await FreighterApi.getAddress();
      const fAddr = typeof addrResult === 'object' ? (addrResult as any).address : addrResult as string;
      if (!fAddr) throw new Error('Could not get address from Freighter');
      await connectExternalWallet(fAddr, 'TESTNET');
      alert(`Freighter reconnected! Your linked wallet is now ${fAddr}. Ask admin to re-mint tokens to this address.`);
      fetchData();
    } catch (err: any) {
      alert(`Reconnect failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setReconnecting(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferLoading(true);
    try {
      await transferBalance(parseFloat(transferAmount), transferRecipient);
      alert(`Successfully transferred ${transferAmount} DST to ${transferRecipient}`);
      setTransferAmount("");
      setTransferRecipient("");
      fetchData(); // Refresh balances
    } catch (error: any) {
      console.error("Transfer failed:", error);
      alert(`Transfer failed: ${error?.message || "Unknown error"}`);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-lg text-muted-foreground">Loading your balance...</div>
      </div>
    );
  }

  // Calculate portfolio value in M2M
  const portfolioValueM2M = silverBalance * currentPrice;

  return (
    <div className="min-h-screen bg-background">


      <main className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        {/* Wallet Mismatch Warning */}
        {walletMismatch && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-red-400 font-semibold">⚠️ Wallet Address Mismatch</p>
              <p className="text-sm text-red-300/80 mt-1">
                Your Freighter wallet (<span className="font-mono">{freighterAddress?.slice(0, 8)}…</span>) does not match your linked wallet (<span className="font-mono">{linkedWallet?.slice(0, 8)}…</span>).
                DST tokens live on the linked wallet. Reconnect Freighter to re-link, then ask admin to re-mint.
              </p>
            </div>
            <button
              onClick={handleReconnectFreighter}
              disabled={reconnecting}
              className="shrink-0 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 text-sm font-semibold"
            >
              {reconnecting ? 'Reconnecting…' : 'Reconnect Freighter'}
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Balance Overview</h1>
            <p className="text-muted-foreground mt-2">Manage your silver holdings and DST tokens</p>
          </div>
          <button
            onClick={refreshBalances}
            className="bg-surface text-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors border border-border"
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
                title="Portfolio Value (M2M)"
                value={`${portfolioValueM2M.toLocaleString()} M2M`}
                change={{ value: 1.8, type: 'positive' }}
              />
            </div>

            {/* Silver Holdings Breakdown */}
            <Card title="Silver Holdings Breakdown" subtitle="Detailed view of your silver assets">
              <div className="grid grid-cols-1 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground mb-2">{(silverBalance * 0.6).toFixed(2)}g</div>
                  <div className="text-muted-foreground">Physical Vault</div>
                  <Badge variant="success" className="mt-2">Secured</Badge>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground mb-2">{(silverBalance * 0.3).toFixed(2)}g</div>
                  <div className="text-muted-foreground">Digital Tokens</div>
                  <Badge variant="neutral" className="mt-2">Liquid</Badge>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground mb-2">{(silverBalance * 0.1).toFixed(2)}g</div>
                  <div className="text-muted-foreground">In Transit</div>
                  <Badge variant="warning" className="mt-2">Pending</Badge>
                </div>
              </div>
            </Card>

            {/* DST Token Balance Section */}
            <Card title="DST Token Balance" subtitle="Your digital silver tokens">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-foreground mb-2">{dstBalance.toLocaleString()} DST</div>
                  <div className="text-muted-foreground">Equivalent to {dstBalance}g of silver</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-xs mb-1">Linked Wallet</div>
                  <div className="font-mono text-sm text-muted-foreground break-all">
                    {linkedWallet ? `${linkedWallet.slice(0, 8)}…${linkedWallet.slice(-6)}` : 'Not linked'}
                  </div>
                  {walletMismatch && (
                    <div className="text-red-400 text-xs mt-1">⚠️ Mismatch with Freighter</div>
                  )}
                </div>
              </div>
            </Card>

            {/* Balance Transfer */}
            <Card title="Transfer Balance" subtitle="Send DST tokens to another address">
              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Recipient Address
                    </label>
                    <input
                      type="text"
                      value={transferRecipient}
                      onChange={(e) => setTransferRecipient(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Amount (DST)
                    </label>
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors border border-transparent disabled:opacity-50"
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
