"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getKYCStatus, getSumsubAccessToken, checkKYCStatusFromSumsub } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Dynamically import Sumsub SDK (client-side only)
const SumsubWebSdk = dynamic(
  () => import("@sumsub/websdk-react").then((mod) => mod.default),
  { ssr: false }
);

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
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [sdkToken, setSdkToken] = useState<string | null>(null);
  const [showSdk, setShowSdk] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /* =========================
     AUTH + FETCH
  ========================= */
  useEffect(() => {
    if (!userId) {
      router.push("/auth/login");
      return;
    }
    fetchKYCStatus();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [userId]);

  /* =========================
     API
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

  const checkStatusFromSumsub = async () => {
    setCheckingStatus(true);
    try {
      const res = await checkKYCStatusFromSumsub();
      if (res?.status) {
        setKycStatus({
          status: res.status as KYCStatus["status"],
          message: res.message,
        });

        if (res.status === "VERIFIED" || res.status === "REJECTED") {
          // Stop polling once we have a final result
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setShowSdk(false);
          setSdkToken(null);
        }

        if (res.message) {
          setMessage(res.message);
        }
      }
    } catch (err) {
      console.error("Failed to check Sumsub status:", err);
    } finally {
      setCheckingStatus(false);
    }
  };

  // Start polling Sumsub every 10 seconds
  const startPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    pollIntervalRef.current = setInterval(() => {
      checkStatusFromSumsub();
    }, 10000);
  };

  const handleStartVerification = async () => {
    if (!userId) {
      setMessage("User not authenticated");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await getSumsubAccessToken();
      if (res?.token) {
        setSdkToken(res.token);
        setShowSdk(true);
        setMessage(null);
        // Start polling for status updates
        startPolling();
      } else {
        setMessage("Failed to initialize verification. Please try again.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to start verification");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     TOKEN REFRESH
  ========================= */
  const handleTokenExpired = useCallback(async () => {
    try {
      const res = await getSumsubAccessToken();
      return res?.token || "";
    } catch {
      return "";
    }
  }, []);

  /* =========================
     SDK CALLBACKS
  ========================= */
  const handleSdkMessage = useCallback((type: string, payload: any) => {
    console.log("[Sumsub SDK]", type, payload);

    if (
      type === "idCheck.onApplicantStatusChanged" ||
      type === "idCheck.onApplicantSubmitted"
    ) {
      // Check status from Sumsub after a short delay
      setTimeout(() => checkStatusFromSumsub(), 3000);
    }
  }, []);

  const handleSdkError = useCallback((error: any) => {
    console.error("[Sumsub SDK Error]", error);
    setMessage("Verification encountered an error. Please try again.");
  }, []);

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
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Card className="bg-success/5 border-success/20">
            <CardHeader>
              <CardTitle className="text-2xl text-foreground flex items-center gap-3">
                <div className="w-12 h-12 bg-success/20 rounded-xl flex items-center justify-center text-success">
                  ✓
                </div>
                KYC Verification Complete
              </CardTitle>
              <CardDescription className="text-success">
                Your identity verification is complete. You now have full access to the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8">
              <Button
                onClick={() => router.push("/dashboard")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
     SUMSUB SDK VIEW
  ========================= */
  if (showSdk && sdkToken) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-2xl text-foreground flex items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
                  🛡️
                </div>
                Identity Verification
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Please follow the steps below to verify your identity. This usually takes 2-3 minutes.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div
                style={{
                  minHeight: "600px",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                <SumsubWebSdk
                  accessToken={sdkToken}
                  expirationHandler={handleTokenExpired}
                  onMessage={handleSdkMessage}
                  onError={handleSdkError}
                  config={{
                    lang: "en",
                    theme: "light",
                  }}
                  options={{
                    addViewportTag: false,
                    adaptIframeHeight: true,
                  }}
                />
              </div>

              <div className="mt-4 flex justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSdk(false);
                    setSdkToken(null);
                    if (pollIntervalRef.current) {
                      clearInterval(pollIntervalRef.current);
                    }
                    checkStatusFromSumsub();
                  }}
                >
                  ← Back
                </Button>
                <Button
                  onClick={checkStatusFromSumsub}
                  disabled={checkingStatus}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {checkingStatus ? "Checking..." : "Check Status"}
                </Button>
              </div>
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground flex items-center gap-3">
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
                🛡️
              </div>
              KYC Verification
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Complete identity verification to access the platform.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-lg flex justify-between">
              <span className="text-sm text-foreground">Current Status</span>
              <span className={`text-sm font-semibold ${getStatusColor()}`}>
                {getStatusMessage()}
              </span>
            </div>

            {/* What you'll need section */}
            {(kycStatus?.status === null ||
              kycStatus?.status === "NOT_STARTED" ||
              kycStatus?.status === "REJECTED") && (
                <>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-2">
                    <h3 className="font-medium text-sm text-blue-800">
                      📋 What you&apos;ll need:
                    </h3>
                    <ul className="text-sm text-blue-700 space-y-1 ml-5 list-disc">
                      <li>A valid government-issued ID (passport, driver&apos;s license, or national ID)</li>
                      <li>A device with a camera for a selfie</li>
                      <li>Good lighting conditions</li>
                    </ul>
                  </div>

                  <Button
                    onClick={handleStartVerification}
                    disabled={loading}
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {loading ? "Initializing..." : "Start Verification"}
                  </Button>
                </>
              )}

            {kycStatus?.status === "IN_REVIEW" && (
              <div className="text-center py-6 space-y-3">
                <div className="text-4xl">⏳</div>
                <p className="text-yellow-600 font-medium">
                  Your documents are under review
                </p>
                <p className="text-sm text-muted-foreground">
                  This usually takes a few minutes. Click below to check your latest status.
                </p>
                <div className="flex justify-center gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={fetchKYCStatus}
                  >
                    Refresh Local
                  </Button>
                  <Button
                    onClick={checkStatusFromSumsub}
                    disabled={checkingStatus}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {checkingStatus ? "Checking Sumsub..." : "Check Sumsub Status"}
                  </Button>
                </div>
              </div>
            )}

            {message && (
              <div
                className={`p-4 rounded-lg border ${message.toLowerCase().includes("verified") ||
                    message.toLowerCase().includes("success")
                    ? "bg-success/10 border-success/20 text-success"
                    : message.toLowerCase().includes("rejected")
                      ? "bg-destructive/10 border-destructive/20 text-destructive"
                      : "bg-yellow-50 border-yellow-200 text-yellow-700"
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
