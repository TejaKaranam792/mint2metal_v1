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
  createSellOrder,
  confirmOrder,
  submitKYC,
  getSilverPriceM2M,
} from "@/lib/api";

import { connectWallet } from "@/lib/stellarWallet";
import { signDummyTx } from "@/lib/signDummyTx";
import { stellarService } from "@/lib/stellar";
import { Operation, Asset } from "@stellar/stellar-sdk";
import { XAG_ISSUER, TREASURY_PUBKEY } from "@/lib/constants";
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

  const [currentPrice, setCurrentPrice] = useState(0);
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

      const kycRes = await getKYCStatus();
      const rawStatus = typeof kycRes?.status === "string"
        ? kycRes.status
        : kycRes?.status?.status;
      setKycStatus(rawStatus || "UNKNOWN");

      // Fetch admin-set silver price
      try {
        const priceRes = await getSilverPriceM2M();
        if (priceRes?.pricePerGram) {
          setCurrentPrice(priceRes.pricePerGram);
          setOrderPrice(priceRes.pricePerGram.toString());
        }
      } catch { /* keep default */ }

      // Load real orders from DB
      try {
        const ordersRes = await getMyOrders();
        const realOrders = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.orders || []);
        setOrders(realOrders.map((o: any) => ({
          id: o.id,
          type: o.type,
          amount: o.quantityGrams ?? o.amount,
          price: o.priceLocked ?? o.price ?? 0,
          status: o.status,
          timestamp: o.createdAt,
        })));
      } catch { /* non-fatal */ }
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

      let orderRes;
      if (orderType === "BUY") {
        orderRes = await createBuyOrder(Number(orderAmount));
      } else {
        orderRes = await createSellOrder(Number(orderAmount));
      }

      const orderId = orderRes?.data?.id || orderRes?.data?.orderId; // B2B sells use orderId sometimes in return map

      if (!orderId) {
        throw new Error("Order creation failed");
      }

      if (orderType === "SELL") {
        // Since legacy tokens don't support backend clawback, user explicitly pays XAG back to Treasury
        const xagAsset = new Asset("XAG", XAG_ISSUER);

        const paymentOp = Operation.payment({
          destination: TREASURY_PUBKEY,
          asset: xagAsset,
          amount: Number(orderAmount).toFixed(7)
        });

        const tx = await stellarService.buildTransaction(publicKey, [paymentOp]);
        const signedXDR = await stellarService.signWithFreighter(tx);
        const result = await stellarService.submitTransaction(signedXDR);

        if (!result.successful) {
          throw new Error("Failed to send XAG to Treasury on-chain.");
        }

        // Use force=true so backend skips clawback since user already paid it
        await confirmOrder(orderId, true);
      } else {
        const xagAsset = new Asset("XAG", XAG_ISSUER);

        try {
          const changeTrustOp = Operation.changeTrust({
            asset: xagAsset,
            limit: "922337203685.4775807" // max limit
          });
          const tx = await stellarService.buildTransaction(publicKey, [changeTrustOp]);
          const signedXDR = await stellarService.signWithFreighter(tx);
          const result = await stellarService.submitTransaction(signedXDR);

          if (!result.successful) {
            console.warn("ChangeTrust transaction was not successful.");
          }
        } catch (e: any) {
          console.warn("ChangeTrust skipped or failed:", e);
          const proceed = window.confirm(`Trustline setup failed or was cancelled. \n\nError: ${e?.message || String(e)}\n\nIf you don't have a trustline, tokens will be sent as Claimable Balances which cannot be Sold later. Continue anyway?`);
          if (!proceed) {
            throw new Error("Order cancelled by user.");
          }
        }

        const costInXLM = Number(orderAmount) * Number(orderPrice);
        const paymentOp = Operation.payment({
          destination: TREASURY_PUBKEY,
          asset: Asset.native(),
          amount: costInXLM.toFixed(7)
        });

        const payTx = await stellarService.buildTransaction(publicKey, [paymentOp]);
        const signedPayXDR = await stellarService.signWithFreighter(payTx);
        const payResult = await stellarService.submitTransaction(signedPayXDR);

        if (!payResult.successful) {
          throw new Error("Payment transaction failed on network.");
        }

        try {
          await confirmOrder(orderId);
        } catch (confirmError: any) {
          throw confirmError;
        }
      }

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
      alert(`${orderType} Order placed successfully`);
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
  /* =========================
     UI
  ========================= */
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Silver Trading
            </h1>
            <p className="text-muted-foreground mt-2">
              Compliance-gated trading environment
            </p>
          </div>
          <Button onClick={fetchData} variant="secondary">
            Refresh
          </Button>
        </div>

        {/* Compliance Gate */}
        {!canTrade && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Verification Required
            </h3>
            <p className="text-muted-foreground mb-4">
              Complete KYC / AML to enable trading.
            </p>
            <Button onClick={() => router.push("/dashboard/kyc")}>
              Complete Verification
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Trade Form */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>{orderType === "BUY" ? "Buy Silver" : "Sell Silver"}</CardTitle>
              <CardDescription>Testnet simulation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2 mb-6 p-1 bg-surface rounded-lg">
                <button
                  type="button"
                  onClick={() => setOrderType("BUY")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${orderType === "BUY"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:bg-muted"
                    }`}
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType("SELL")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${orderType === "SELL"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:bg-muted"
                    }`}
                >
                  Sell
                </button>
              </div>

              <form onSubmit={handleSubmitTradeIntent} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Amount (grams)</label>
                  <input
                    type="number"
                    placeholder="Amount"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                  {orderType === "SELL" && (
                    <p className="text-xs text-muted-foreground mt-1 text-right">Available: {dstBalance}g XAG</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Price per gram</label>
                  <input
                    type="number"
                    placeholder="Price"
                    value={orderPrice}
                    onChange={(e) => setOrderPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!canTrade || loading || (orderType === "SELL" && Number(orderAmount) > dstBalance)}
                  className="w-full"
                >
                  {loading ? "Processing..." : `${orderType === "BUY" ? "Place Buy Order" : "Place Sell Order"}`}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Orders */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
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
