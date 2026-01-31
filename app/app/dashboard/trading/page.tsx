"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getSilverBalance,
  getDSTBalance,
  submitTradeIntent,
  getIndicativePrice,
  getMyOrders,
  getKYCStatus, // ✅ FIXED
  createBuyOrder,
  confirmOrder,
  submitKYC,
} from "@/lib/api";

import { connectWallet } from "@/lib/stellarWallet";
import { signDummyTx } from "@/lib/signDummyTx";
import Sidebar from "@/components/Sidebar";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import StatBox from "@/components/StatBox";
import Table from "@/components/Table";
import Badge from "@/components/Badge";
import Button from "@/components/Button";

/* =========================
   TYPES
========================= */
interface Order {
  id: string;
  type: "BUY" | "SELL";
  amount: number;
  price: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "SETTLED";
  timestamp: string;
}

export default function TradingPage() {
  const { isAuthenticated, user, userType } = useAuth();
  const router = useRouter();

  const [silverBalance, setSilverBalance] = useState(0);
  const [dstBalance, setDstBalance] = useState(0);
  const [kycStatus, setKycStatus] = useState<
    "NOT_STARTED" | "IN_REVIEW" | "VERIFIED" | "REJECTED" | "UNKNOWN"
  >("UNKNOWN");

  const [currentPrice, setCurrentPrice] = useState(7500);
  const [orderType, setOrderType] = useState<"BUY" | "SELL">("BUY");
  const [orderAmount, setOrderAmount] = useState("");
  const [orderPrice, setOrderPrice] = useState(currentPrice.toString());
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [showKYCForm, setShowKYCForm] = useState(false);

  /* =========================
     AUTH + DATA LOAD
  ========================= */
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    fetchData();
  }, [isAuthenticated]);

  /* =========================
     FETCH DATA
  ========================= */
  const fetchData = async () => {
    try {
      const silverRes = await getSilverBalance();
      setSilverBalance(Number(silverRes?.balance || 0));

      const dstRes = await getDSTBalance();
      setDstBalance(Number(dstRes?.balance || 0));

      const kycRes = await getKYCStatus(); // ✅ FIXED
      setKycStatus(
        typeof kycRes?.status === "string" ? kycRes.status : "UNKNOWN"
      );
    } catch (err) {
      console.error("Failed to fetch trading data:", err);
    }
  };

  /* =========================
     TRADE SUBMIT
  ========================= */
  const handleSubmitTradeIntent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { publicKey, network } = await connectWallet();

      if (network !== "TESTNET") {
        throw new Error("Please switch Freighter to Stellar Testnet");
      }

      const orderRes = await createBuyOrder(Number(orderAmount));
      const orderId = orderRes?.data?.id;

      if (!orderId) {
        throw new Error("Order creation failed");
      }

      await signDummyTx(publicKey);
      await confirmOrder(orderId);

      setOrders((prev) => [
        {
          id: orderId,
          type: orderType,
          amount: Number(orderAmount),
          price: Number(orderPrice),
          status: "SETTLED",
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);

      setOrderAmount("");
      setOrderPrice(currentPrice.toString());
      alert("Order placed successfully");
    } catch (err: any) {
      alert(err?.message || "Trade failed");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  const isIndianUser = userType === "INDIA_USER";
  const isInternationalUser = userType === "INTERNATIONAL_USER";

  const canTrade =
    userType === "ADMIN" ||
    (isIndianUser && kycStatus === "VERIFIED") ||
    (isInternationalUser && user?.amlStatus === "CLEARED");

  const totalValue =
    Number(orderAmount || 0) * Number(orderPrice || 0);

  /* =========================
     UI
  ========================= */
  return (
    <div className="min-h-screen bg-[#0B0F14]">
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-[#F9FAFB]">
              Silver Trading
            </h1>
            <p className="text-[#9CA3AF] mt-2">
              Compliance-gated trading environment
            </p>
          </div>
          <Button onClick={fetchData} variant="secondary">
            Refresh
          </Button>
        </div>

        {/* Compliance Gate */}
        {!canTrade && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold text-white mb-2">
              Verification Required
            </h3>
            <p className="text-slate-400 mb-4">
              Complete KYC / AML to enable trading.
            </p>
            <Button onClick={() => router.push("/dashboard/kyc")}>
              Complete Verification
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Trade Form */}
          <Card>
            <CardHeader>
              <CardTitle>Place Order</CardTitle>
              <CardDescription>Testnet simulation</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitTradeIntent} className="space-y-6">
                <input
                  type="number"
                  placeholder="Amount (grams)"
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121826] border border-[#1F2937] rounded-lg text-white"
                  required
                />

                <input
                  type="number"
                  placeholder="Price per gram"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121826] border border-[#1F2937] rounded-lg text-white"
                  required
                />

                <Button
                  type="submit"
                  disabled={!canTrade || loading}
                >
                  {loading ? "Placing..." : "Place Order"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-slate-400 text-center">
                  No orders yet
                </p>
              ) : (
                <Table
                  headers={["Type", "Amount", "Price", "Status", "Time"]}
                  rows={orders.map((o) => [
                    o.type,
                    `${o.amount}g`,
                    `₹${o.price}`,
                    o.status,
                    new Date(o.timestamp).toLocaleString(),
                  ])}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
