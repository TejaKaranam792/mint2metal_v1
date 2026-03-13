import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface SidebarProps {
  userType: 'INDIA_USER' | 'INTERNATIONAL_USER' | 'ADMIN' | 'API_INTEGRATOR' | null;
}

export default function Sidebar({ userType }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { href: '/dashboard/trading', label: 'Buy Silver', icon: '🛒' },
    { href: '/dashboard/portfolio', label: 'Portfolio', icon: '📊' },
    { href: '/dashboard/transactions', label: 'Transactions', icon: '📋' },
    ...(userType === 'INDIA_USER' && user?.kyc?.status !== 'VERIFIED' ? [{ href: '/dashboard/kyc', label: 'KYC Verification', icon: '✅' }] : []),
    ...(userType === 'INDIA_USER' ? [{ href: '/dashboard/redemption', label: 'Redeem', icon: '🔄' }] : []),
    { href: '/dashboard/developer', label: 'Developer API', icon: '🔌' },
    { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="w-64 bg-background border-r border-border/40 h-full flex flex-col">
      <div className="p-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Mint2<span className="text-secondary-text">Metal</span>
        </h2>
      </div>
      <nav className="px-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center px-4 py-3 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all duration-200 ${pathname === item.href
                  ? 'bg-accent/10 text-accent shadow-[inset_0_0_10px_rgba(56,189,248,0.05)]'
                  : 'text-secondary-text hover:bg-surface hover:text-foreground'
                  }`}
              >
                <span className={`mr-3 text-lg transition-transform ${pathname === item.href ? 'scale-110' : 'grayscale opacity-70 group-hover:grayscale-0'}`}>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
