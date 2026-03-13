"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ConnectWallet from "./ConnectWallet";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Compact live silver price pill shown in the navbar */
function OraclePricePill() {
  const [price, setPrice] = useState<number | null>(null);
  const [stale, setStale] = useState(false);

  const fetchPrice = async () => {
    try {
      const res = await fetch(`${API_URL}/api/oracle/price`);
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      const p = data?.pricePerGram ?? data?.price ?? null;
      if (p) { setPrice(parseFloat(p)); setStale(false); }
    } catch {
      setStale(true);
    }
  };

  useEffect(() => {
    fetchPrice();
    const id = setInterval(fetchPrice, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!price) return null;

  return (
    <div
      title="Live silver price (oracle)"
      className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors"
      style={{
        background: stale ? "rgba(251,191,36,0.08)" : "rgba(16,185,129,0.08)",
        borderColor: stale ? "rgba(251,191,36,0.3)" : "rgba(16,185,129,0.3)",
        color: stale ? "#fbbf24" : "#10b981",
      }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${stale ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`}
      />
      XAG&nbsp;
      <span className="font-bold">${price.toFixed(2)}/g</span>
    </div>
  );
}

export default function Navbar() {
  const { isAuthenticated, userType, logout } = useAuth();
  const pathname = usePathname();

  if (!isAuthenticated || pathname.startsWith('/auth')) return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Mint2<span className="text-secondary-text">Metal</span>
          </h1>
        </Link>

        <OraclePricePill />

        <div className="flex items-center gap-6">
          <Link
            className={`text-sm font-semibold uppercase tracking-wider transition-colors hover:text-accent ${pathname === '/dashboard' ? 'text-accent' : 'text-secondary-text'}`}
            href="/dashboard"
          >
            Overview
          </Link>
          <Link
            className={`text-sm font-semibold uppercase tracking-wider transition-colors hover:text-accent ${pathname === '/dashboard/developer' ? 'text-accent' : 'text-secondary-text'}`}
            href="/dashboard/developer"
          >
            Developer
          </Link>
          <Link
            className={`text-sm font-semibold uppercase tracking-wider transition-colors hover:text-accent ${pathname === '/dashboard/trading' ? 'text-accent' : 'text-secondary-text'}`}
            href="/dashboard/trading"
          >
            Trading
          </Link>
          <Link
            className={`text-sm font-semibold uppercase tracking-wider transition-colors hover:text-accent ${pathname === '/dashboard/loans' ? 'text-accent' : 'text-secondary-text'}`}
            href="/dashboard/loans"
          >
            Loans
          </Link>
          {userType === "INDIA_USER" && (
            <Link
              className={`text-sm font-semibold uppercase tracking-wider transition-colors hover:text-accent ${pathname === '/dashboard/redemption' ? 'text-accent' : 'text-secondary-text'}`}
              href="/dashboard/redemption"
            >
              Redemption
            </Link>
          )}
          {userType === "ADMIN" && (
            <Link
              className={`text-sm font-semibold uppercase tracking-wider text-error hover:opacity-80`}
              href="/admin"
            >
              Admin
            </Link>
          )}

          <div className="flex items-center gap-4 ml-2 pl-4 border-l border-border">
            <ConnectWallet />
            <button
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
