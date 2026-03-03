"use client";

/**
 * OraclePriceBanner
 * Displays the live oracle-aggregated silver price (XAG/USD).
 * Auto-refreshes every 30 seconds.
 * Shows a warning banner when the oracle is paused or price is stale.
 */

import { useState, useEffect, useCallback } from "react";
import { getOraclePrice } from "@/lib/api";

interface OraclePrice {
  pricePerGram: number;
  pricePerOz: number;
  lastUpdatedAt: string;
  lastUpdatedAgo: string;
  isPaused: boolean;
  isStale: boolean;
  source: string;
  currency: string;
}

const POLL_INTERVAL =
  parseInt(process.env.NEXT_PUBLIC_ORACLE_POLL_INTERVAL_MS ?? "30000") || 30000;

export default function OraclePriceBanner() {
  const [price, setPrice] = useState<OraclePrice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPrice = useCallback(async () => {
    try {
      const data = await getOraclePrice();
      setPrice(data);
      setError(null);
    } catch (err: any) {
      setError("Oracle unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border text-sm text-muted-foreground animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
        Loading price...
      </div>
    );
  }

  if (error || !price) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-900/20 border border-red-700/40 text-sm text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
        Oracle Offline
      </div>
    );
  }

  const isProblem = price.isPaused || price.isStale;
  const statusColor = price.isPaused
    ? "text-red-400 bg-red-900/20 border-red-700/40"
    : price.isStale
      ? "text-amber-400 bg-amber-900/20 border-amber-700/40"
      : "text-emerald-400 bg-emerald-900/20 border-emerald-700/40";

  const dotColor = price.isPaused
    ? "bg-red-400 animate-pulse"
    : price.isStale
      ? "bg-amber-400 animate-pulse"
      : "bg-emerald-400";

  const statusLabel = price.isPaused ? "PAUSED" : price.isStale ? "STALE" : "LIVE";

  return (
    <div className="flex flex-col gap-1">
      {/* Main price badge */}
      <div
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${statusColor}`}
        title={`Source: ${price.source} | Updated: ${price.lastUpdatedAgo}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full inline-block ${dotColor}`} />

        <span>
          XAG/USD&nbsp;
          <span className="font-bold">
            ${price.pricePerGram.toFixed(4)}<span className="font-normal text-xs">/g</span>
          </span>
          <span className="mx-2 opacity-50">|</span>
          <span className="opacity-75">${price.pricePerOz.toFixed(2)}/oz</span>
        </span>

        <span
          className={`ml-auto text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${price.isPaused
              ? "bg-red-700/30"
              : price.isStale
                ? "bg-amber-700/30"
                : "bg-emerald-700/30"
            }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Source + time sub-label */}
      <div className="text-[10px] text-muted-foreground pl-1 flex gap-2">
        <span>📡 {price.source}</span>
        <span>· {price.lastUpdatedAgo}</span>
      </div>

      {/* Paused warning banner */}
      {price.isPaused && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/30 border border-red-600/50 text-red-300 text-xs mt-1">
          <span>⚠️</span>
          <span>
            <strong>Oracle Paused.</strong> Price updates are suspended. Contact
            administrators or check the oracle status panel.
          </span>
        </div>
      )}

      {/* Stale warning (not paused, just old) */}
      {price.isStale && !price.isPaused && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-900/30 border border-amber-600/50 text-amber-300 text-xs mt-1">
          <span>⏱️</span>
          <span>
            <strong>Price may be stale.</strong> Last oracle update was{" "}
            {price.lastUpdatedAgo}. The scheduler may be experiencing issues.
          </span>
        </div>
      )}
    </div>
  );
}
