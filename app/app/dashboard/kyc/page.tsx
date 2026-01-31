"use client";

import { useState, useEffect } from "react";
import { getKYCStatus, startKYC } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/* =========================
   TYPES
========================= */
type KYCStatus = {
  status: "NOT_STARTED" | "IN_REVIEW" | "VERIFIED" | "REJECTED" | null;
  message?: string;
};

export default function KYCPage() {
  const { userId } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);

  /* =========================
     AUTH + FETCH
  ========================= */
  useEffect(() => {
    if (!userId) {
      router.push("/auth/login");
      return;
    }
    fetchKYCStatus();
  }, [userId]);

  /* =========================
     API NORMALIZATION
  ========================= */
  const fetchKYCStatus = async () => {
    try {
      const res = await getKYCStatus();

      setKycStatus({
        status:
          typeof res?.status === "string" ? (res.status as KYCStatus["status"]) : null,
        message: typeof res?.message === "string" ? res.message : undefined,
      });
    } catch (err) {
      console.error("Failed to fetch KYC status:", err);
    }
  };

  const handleStartKYC = async () => {
    if (!userId) {
      setMessage("User not authenticated");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await startKYC();

      setMessage(
        typeof res?.message === "string"
          ? res.message
          : "KYC verification started. Please wait for admin approval."
      );

      fetchKYCStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to start KYC");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     HELPERS
  ========================= */
  const getStatusMessage = () => {
    switch (kycStatus?.status) {
      case "NOT_STARTED":
        return "Not started";
      case "IN_REVIEW":
        return "Under review";
      case "VERIFIED":
        return "Verified";
      case "REJECTED":
        return "Rejected";
      default:
        return "Not started";
    }
  };

  const getStatusColor = () => {
    switch (kycStatus?.status) {
      case "IN_REVIEW":
        return "text-yellow-400";
      case "VERIFIED":
        return "text-green-400";
      case "REJECTED":
        return "text-red-400";
      default:
        return "text-slate-400";
    }
  };

  /* =========================
     VERIFIED STATE
  ========================= */
  if (kycStatus?.status === "VERIFIED") {
    return (
      <div className="min-h-screen bg-[#0B0F14]">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  ✓
                </div>
                KYC Verification Complete
              </CardTitle>
              <CardDescription className="text-green-400/80">
                Your identity verification is complete.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8">
              <Button
                onClick={() => router.push("/dashboard")}
                className="bg-green-600 hover:bg-green-700"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  /* =========================
     DEFAULT VIEW
  ========================= */
  return (
    <div className="min-h-screen bg-[#0B0F14]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardHeader>
            <CardTitle className="text-2xl text-white flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-500/20 rounded-xl flex items-center justify-center">
                🛡️
              </div>
              KYC Verification
            </CardTitle>
            <CardDescription className="text-slate-400">
              Complete identity verification to access the platform.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-slate-800/50 p-4 rounded-lg flex justify-between">
              <span className="text-sm text-slate-300">Current Status</span>
              <span className={`text-sm font-semibold ${getStatusColor()}`}>
                {getStatusMessage()}
              </span>
            </div>

            {(kycStatus?.status === null ||
              kycStatus?.status === "NOT_STARTED" ||
              kycStatus?.status === "REJECTED") && (
              <Button
                onClick={handleStartKYC}
                disabled={loading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? "Starting..." : "Start KYC Verification"}
              </Button>
            )}

            {kycStatus?.status === "IN_REVIEW" && (
              <div className="text-center py-6 text-yellow-400">
                ⏳ Your documents are under review
              </div>
            )}

            {message && (
              <div
                className={`p-4 rounded-lg border ${
                  message.toLowerCase().includes("start") ||
                  message.toLowerCase().includes("success")
                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
              >
                <p className="text-sm">{message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
