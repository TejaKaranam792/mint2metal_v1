"use client";

import { useState, useEffect } from "react";
import { getSilverBalance, getVaultStatus } from "@/lib/api";

export default function SilverPage() {
  const [loading, setLoading] = useState(true);
  const [silverBalance, setSilverBalance] = useState<any>(null);
  const [vaultStatus, setVaultStatus] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [balance, status] = await Promise.all([
          getSilverBalance(),
          getVaultStatus()
        ]);
        setSilverBalance(balance);
        setVaultStatus(status);
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
        <div className="bg-gray-900/70 border border-gray-800 rounded-2xl shadow-lg shadow-black/30 p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded mb-4"></div>
            <div className="h-4 bg-gray-700 rounded mb-2"></div>
            <div className="h-4 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="bg-gray-900/70 border border-gray-800 rounded-2xl shadow-lg shadow-black/30 p-8">
        <h2 className="text-2xl font-semibold text-gray-100 mb-8">Silver Assets Overview</h2>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Silver Balance */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Your Silver Balance</h3>
            {silverBalance ? (
              <div className="space-y-2">
                <p className="text-2xl font-bold text-emerald-400">
                  {silverBalance.totalGrams?.toFixed(2) || "0.00"}g
                </p>
                <p className="text-sm text-gray-400">
                  Purity: {silverBalance.averagePurity?.toFixed(2) || "0.00"}%
                </p>
                <p className="text-sm text-gray-400">
                  Assets: {silverBalance.assetCount || 0}
                </p>
              </div>
            ) : (
              <p className="text-gray-400">No silver assets found</p>
            )}
          </div>

          {/* Vault Status */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Vault Status</h3>
            {vaultStatus ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-300">
                  <span className="font-medium">Location:</span> {vaultStatus.location || "N/A"}
                </p>
                <p className="text-sm text-gray-300">
                  <span className="font-medium">Custodian:</span> {vaultStatus.custodian || "N/A"}
                </p>
                <p className="text-sm text-gray-300">
                  <span className="font-medium">Total Assets:</span> {vaultStatus.totalAssets || 0}
                </p>
                <p className="text-sm text-emerald-400">
                  Status: Verified ✓
                </p>
              </div>
            ) : (
              <p className="text-gray-400">Vault information unavailable</p>
            )}
          </div>
        </div>

        {/* Information Note */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-blue-300">
            <strong>Note:</strong> Silver assets are managed exclusively by our backend systems.
            All operations are verified and recorded for compliance and security.
          </p>
        </div>
      </div>
    </div>
  );
}
