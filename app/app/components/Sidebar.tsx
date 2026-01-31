import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface SidebarProps {
  userType: 'INDIA' | 'INTERNATIONAL';
}

export default function Sidebar({ userType }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { href: '/dashboard/buy', label: 'Buy Silver', icon: '🛒' },
    { href: '/dashboard/portfolio', label: 'Portfolio', icon: '📊' },
    { href: '/dashboard/transactions', label: 'Transactions', icon: '📋' },
    ...(userType === 'INDIA' && user?.kyc?.status !== 'VERIFIED' ? [{ href: '/dashboard/kyc', label: 'KYC Verification', icon: '✅' }] : []),
    ...(userType === 'INDIA' ? [{ href: '/dashboard/redemption', label: 'Redeem', icon: '🔄' }] : []),
    { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="w-64 bg-[#0B0F14] text-[#F9FAFB] h-full">
      <div className="p-6">
        <h2 className="text-xl font-bold text-[#F9FAFB]">Mint2Metal</h2>
      </div>
      <nav className="px-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center px-4 py-2 rounded-lg ${
                  pathname === item.href
                    ? 'bg-[#111827] text-[#F9FAFB]'
                    : 'text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F9FAFB]'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
