"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { getSilverBalance, getVaultStatus, getSilverPriceM2M } from "@/lib/api";

export default function SilverPage() {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [silverBalance, setSilverBalance] = useState<number>(0);
  const [vaultStatus, setVaultStatus] = useState<any>(null);
  const [pricePerGram, setPricePerGram] = useState<number>(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [balanceRes, vaultRes, priceRes] = await Promise.all([
          getSilverBalance(),
          getVaultStatus(),
          getSilverPriceM2M().catch(() => null),
        ]);
        setSilverBalance(balanceRes?.balance ?? 0);
        setVaultStatus(vaultRes);
        if (priceRes?.pricePerGram) setPricePerGram(priceRes.pricePerGram);
      } catch (err) {
        setError("Failed to load silver data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded" />
            <div className="h-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  const estimatedValue = pricePerGram > 0 ? (silverBalance * pricePerGram).toFixed(2) : null;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="bg-card border border-border rounded-2xl shadow-sm p-8">
        <h2 className="text-2xl font-semibold text-foreground mb-8">Silver Assets Overview</h2>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* DST Balance */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Your DST Token Balance</h3>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-primary">
                {silverBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                <span className="text-lg font-normal text-muted-foreground ml-2">DST</span>
              </p>
              {estimatedValue && (
                <p className="text-sm text-muted-foreground">
                  ≈ {estimatedValue} M2M at current price
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                1 DST = 1 gram of 999.0 purity silver held in vault
              </p>
            </div>
          </div>

          {/* Vault Status */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Vault Backing</h3>
            {vaultStatus ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Vault Assets</span>
                  <span className="font-semibold text-foreground">{vaultStatus.totalAssets ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Weight</span>
                  <span className="font-semibold text-foreground">{(vaultStatus.totalWeight ?? 0).toFixed(2)}g</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Vault Status</span>
                  <span className="text-emerald-400 font-semibold">✓ Verified & Secured</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Vault information unavailable</p>
            )}
          </div>
        </div>

        {/* Live Price Banner */}
        {pricePerGram > 0 && (
          <div className="mt-6 bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Silver Price</p>
              <p className="text-2xl font-bold text-foreground">{pricePerGram.toFixed(2)} M2M / gram</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Your Portfolio Value</p>
              <p className="text-2xl font-bold text-primary">
                {estimatedValue} M2M
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            <strong>Note:</strong> Silver assets are managed by our compliant custodian and represented 1:1 as DST tokens on the Stellar network.
          </p>
        </div>
      </div>
    </div>
  );
}
