"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import ConnectWallet from "./ConnectWallet";

export default function Navbar() {
  const { isAuthenticated, userType, logout } = useAuth();
  const pathname = usePathname();

  if (!isAuthenticated || pathname.startsWith('/auth')) return null;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <h1 className="navbar-logo">
          Mint2Metal
        </h1>

        <div className="navbar-links">
          <Link className="nav-link" href="/dashboard">Protocol Overview</Link>
          <Link className="nav-link" href="/dashboard/balance">Silver Balance</Link>
          <Link className="nav-link" href="/dashboard/trading">Silver Settlement & Pricing</Link>
          <Link className="nav-link" href="/dashboard/loans">Loans (Advanced)</Link>
          {userType === "INDIA_USER" && (
            <Link className="nav-link" href="/dashboard/redemption">Physical Redemption</Link>
          )}
          {userType === "ADMIN" && <Link className="nav-link admin-link" href="/admin">Admin</Link>}

          <ConnectWallet />

          <button
            className="nav-logout"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
