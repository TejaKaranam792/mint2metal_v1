"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { getSilverPriceM2M, createBuyOrder, confirmOrder } from "@/lib/api";
import { connectWallet } from "@/lib/stellarWallet";
import { stellarService } from "@/lib/stellar";
import { Operation, Asset } from "@stellar/stellar-sdk";

type InputMode = "tokens" | "grams";

export default function BuySilverPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  /* ───── state ───── */
  const [mode, setMode] = useState<InputMode>("tokens");
  const [inputValue, setInputValue] = useState("");
  const [pricePerGram, setPricePerGram] = useState(14.32);
  const [loading, setLoading] = useState(false);
  const [orderStatus, setOrderStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [orderMessage, setOrderMessage] = useState("");
  const [hasTrustline, setHasTrustline] = useState(false);
  const [addingTrustline, setAddingTrustline] = useState(false);

  /* ───── auth guard ───── */
  useEffect(() => {
    if (!isAuthenticated) router.push("/auth/login");
  }, [isAuthenticated, router]);

  /* ───── fetch live price ───── */
  const fetchPrice = useCallback(async () => {
    try {
      const data = await getSilverPriceM2M();
      if (data?.pricePerGram) setPricePerGram(data.pricePerGram);
    } catch {
      /* keep fallback */
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    const id = setInterval(fetchPrice, 30_000);
    return () => clearInterval(id);
  }, [fetchPrice]);

  /* ───── conversion helpers ───── */
  const numericInput = parseFloat(inputValue) || 0;

  const convertedValue =
    mode === "tokens"
      ? (numericInput / pricePerGram).toFixed(2)
      : (numericInput * pricePerGram).toFixed(2);

  const gramsForMint =
    mode === "tokens" ? numericInput / pricePerGram : numericInput;

  /* ───── quick‑select ───── */
  const quickAmounts = [50, 100, 500, 1000];

  const handleQuickSelect = (amount: number) => {
    setMode("tokens");
    setInputValue(amount.toString());
  };

  /* ───── trustline ───── */
  const handleEstablishTrustline = async () => {
    setAddingTrustline(true);
    setOrderStatus("pending");
    setOrderMessage("");

    try {
      const { publicKey } = await connectWallet();
      const { XAG_ISSUER } = await import("@/lib/constants");
      const xagAsset = new Asset("XAG", XAG_ISSUER);

      const changeTrustOp = Operation.changeTrust({
        asset: xagAsset,
        limit: "922337203685.4775807"
      });

      const tx = await stellarService.buildTransaction(publicKey, [changeTrustOp]);
      const signedXDR = await stellarService.signWithFreighter(tx);
      const result = await stellarService.submitTransaction(signedXDR);

      if (result.successful) {
        setHasTrustline(true);
        setOrderStatus("success");
        setOrderMessage("Stellar Trustline established successfully! You can now receive M2M natively.");
        setTimeout(() => setOrderStatus("idle"), 5000);
      } else {
        throw new Error("Transaction failed on network.");
      }
    } catch (err: any) {
      console.error("Trustline error:", err);
      setOrderStatus("error");
      setOrderMessage(`Trustline failed: ${err?.message || "User cancelled."}`);
    } finally {
      setAddingTrustline(false);
    }
  };

  /* ───── order ───── */
  const handleOrder = async () => {
    if (gramsForMint <= 0) return;
    setLoading(true);
    setOrderStatus("pending");
    setOrderMessage("");
    try {
      const { publicKey } = await connectWallet();

      const costInXLM = mode === "tokens" ? numericInput : numericInput * pricePerGram;

      const { TREASURY_PUBKEY } = await import("@/lib/constants");
      const paymentOp = Operation.payment({
        destination: TREASURY_PUBKEY,
        asset: Asset.native(),
        amount: costInXLM.toFixed(7)
      });

      const tx = await stellarService.buildTransaction(publicKey, [paymentOp]);
      const signedXDR = await stellarService.signWithFreighter(tx);
      const paymentResult = await stellarService.submitTransaction(signedXDR);

      if (!paymentResult.successful) {
        throw new Error("Payment transaction failed on network.");
      }

      const result = await createBuyOrder(gramsForMint);

      const orderId = result?.data?.id;
      if (orderId) {
        await confirmOrder(orderId);
      }

      setOrderStatus("success");
      setOrderMessage("Payment complete! Tokens transferred from Treasury to your wallet!");
      setInputValue("");
    } catch (err: any) {
      setOrderStatus("error");
      setOrderMessage(err?.message || "Order failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  /* ════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════ */
  return (
    <div className="buy-silver-page min-h-screen pb-28">
      {/* ─── Background decoration ─── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-6">
        {/* ═══════════ 1 · HEADER ═══════════ */}
        <header className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center hover:bg-white/[0.1] transition-colors"
            aria-label="Go back"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="text-gray-300"
            >
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <h1 className="text-xl font-bold text-white tracking-tight">
            Buy Silver
          </h1>

          <button
            className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center hover:bg-white/[0.1] transition-colors"
            aria-label="Info"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="text-gray-300"
            >
              <circle
                cx="10"
                cy="10"
                r="8"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M10 9V14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="10" cy="6.5" r="1" fill="currentColor" />
            </svg>
          </button>
        </header>

        {/* ═══════════ 2 · TRUST CARD ═══════════ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e1b2e] to-[#16132a] border border-purple-500/20 p-5 mb-6 shadow-lg shadow-purple-900/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="text-white"
              >
                <path
                  d="M16.667 5L7.5 14.167 3.333 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-white font-semibold text-base">
                  Backed 1:1 by Test Silver Asset
                </h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Verified
                </span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Tokens backed by physical reserves
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════ 3 · TOGGLE ═══════════ */}
        <div className="relative bg-white/[0.04] border border-white/10 rounded-2xl p-1 flex mb-6">
          {(["tokens", "grams"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => {
                setMode(opt);
                setInputValue("");
              }}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${mode === opt
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30"
                : "text-gray-400 hover:text-gray-200"
                }`}
            >
              {opt === "tokens" ? "Buy in Tokens" : "Buy in Grams"}
            </button>
          ))}
        </div>

        {/* ═══════════ 4 · INPUT SECTION ═══════════ */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 mb-6">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 block">
            {mode === "tokens" ? "Enter amount in M2M" : "Enter weight in grams"}
          </label>

          <div className="flex items-baseline gap-2 mb-4">
            <input
              id="buy-silver-input"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full bg-transparent text-4xl font-bold text-white placeholder-gray-600 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-lg font-semibold text-gray-400 flex-shrink-0">
              {mode === "tokens" ? "M2M" : "g"}
            </span>
          </div>

          {numericInput > 0 && (
            <div className="flex items-center gap-2 text-sm text-purple-300/80 animate-fade-in">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 7H11M7 3V11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span>
                ={" "}
                {mode === "tokens"
                  ? `${convertedValue}g`
                  : `${convertedValue} M2M`}
              </span>
            </div>
          )}
        </div>

        {/* ═══════════ 5 · LIVE PRICE ═══════════ */}
        <div className="flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="live-badge inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-1">
              <span className="live-dot w-2 h-2 rounded-full bg-red-500" />
              LIVE
            </span>
            <span className="text-sm text-gray-300">
              Price:{" "}
              <span className="font-semibold text-white">
                {pricePerGram.toFixed(2)} M2M
              </span>{" "}
              / gram
            </span>
          </div>
        </div>

        {/* ═══════════ 6 · QUICK SELECT ═══════════ */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {quickAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => handleQuickSelect(amount)}
              className={`py-3 rounded-xl text-sm font-semibold border transition-all duration-200 ${mode === "tokens" && inputValue === amount.toString()
                ? "bg-purple-600/20 border-purple-500/50 text-purple-300"
                : "bg-white/[0.04] border-white/10 text-gray-300 hover:bg-white/[0.08] hover:border-white/20"
                }`}
            >
              {amount} M2M
            </button>
          ))}
        </div>

        {/* ═══════════ ORDER STATUS ═══════════ */}
        {orderStatus !== "idle" && (
          <div
            className={`rounded-xl px-4 py-3 mb-6 text-sm border ${orderStatus === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : orderStatus === "error"
                ? "bg-red-500/10 border-red-500/20 text-red-400"
                : "bg-purple-500/10 border-purple-500/20 text-purple-300"
              }`}
          >
            {orderStatus === "pending"
              ? "Processing order…"
              : orderMessage}
          </div>
        )}
      </div>

      {/* ═══════════ 7 · STICKY CTA ═══════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-[#0c0a15] via-[#0c0a15]/95 to-transparent">
        <div className="max-w-lg mx-auto">
          {!hasTrustline ? (
            <button
              id="establish-trustline"
              onClick={handleEstablishTrustline}
              disabled={addingTrustline}
              className="w-full py-4 rounded-2xl text-base font-bold uppercase tracking-wider text-white transition-all duration-300
                bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600
                hover:from-blue-500 hover:via-blue-400 hover:to-indigo-500
                hover:shadow-xl hover:shadow-blue-600/30
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none
                active:scale-[0.98]"
            >
              {addingTrustline ? "SIGNING WITH WALLET..." : "1. ESTABLISH TRUSTLINE (SAC REQUIREMENT)"}
            </button>
          ) : (
            <button
              id="proceed-to-order"
              onClick={handleOrder}
              disabled={loading || gramsForMint <= 0}
              className="w-full py-4 rounded-2xl text-base font-bold uppercase tracking-wider text-white transition-all duration-300
                bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600
                hover:from-purple-500 hover:via-purple-400 hover:to-indigo-500
                hover:shadow-xl hover:shadow-purple-600/30
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none
                active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Processing…
                </span>
              ) : (
                "2. PLACE ORDER"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
