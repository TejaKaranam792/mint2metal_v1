"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { setupTwoFactor, enableTwoFactor, disableTwoFactor } from "@/lib/api";

export default function TwoFactorSetup() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user) {
      router.push("/auth/login");
      return;
    }

    if (user.twoFactorEnabled) {
      // Show disable option
      return;
    }

    // Setup 2FA
    handleSetup();
  }, [user, router]);

  const handleSetup = async () => {
    if (!user) return;

    setLoading(true);
    setError("");
    try {
      const result = await setupTwoFactor(user.id);
      setQrCodeUrl(result.qrCodeUrl);
      setSecret(result.secret);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !secret || !token) return;

    setLoading(true);
    setError("");
    try {
      await enableTwoFactor(user.id, secret, token);
      setSuccess("2FA has been enabled successfully!");
      // Refresh user data
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!user) return;

    const confirmToken = prompt("Enter your 2FA code to disable:");
    if (!confirmToken) return;

    setLoading(true);
    setError("");
    try {
      await disableTwoFactor(user.id, confirmToken);
      setSuccess("2FA has been disabled successfully!");
      // Refresh user data
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="card max-w-2xl mx-auto mt-8 bg-card border border-border p-8 rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-foreground">
          Two-Factor Authentication Setup
        </h1>

        {user.twoFactorEnabled ? (
          <div className="text-center">
            <div className="text-success mb-4 text-lg">
              ✓ Two-factor authentication is enabled
            </div>
            <button
              onClick={handleDisable}
              disabled={loading}
              className="bg-muted hover:bg-muted/80 text-foreground font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? "Disabling..." : "Disable 2FA"}
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-4 text-muted-foreground text-center">
              Scan the QR code below with your authenticator app (like Google Authenticator, Authy, etc.),
              then enter the 6-digit code to enable 2FA.
            </p>

            {qrCodeUrl && (
              <div className="text-center mb-6">
                <img src={qrCodeUrl} alt="2FA QR Code" className="mx-auto mb-4 border border-border rounded-lg p-2 bg-white" />
                <p className="text-sm text-muted-foreground mb-2">
                  Or manually enter this secret key:
                </p>
                <code className="bg-muted p-2 rounded text-sm break-all text-foreground font-mono">
                  {secret}
                </code>
              </div>
            )}

            <form onSubmit={handleEnable} className="max-w-xs mx-auto">
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                maxLength={6}
                className="w-full mb-4 px-4 py-2 border border-border rounded-lg bg-surface text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                required
              />

              <button
                type="submit"
                disabled={loading || !qrCodeUrl}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Enabling..." : "Enable 2FA"}
              </button>
            </form>
          </div>
        )}

        {error && <p className="text-destructive mt-4 text-center">{error}</p>}
        {success && <p className="text-success mt-4 text-center">{success}</p>}
      </div>
    </div>
  );
}
