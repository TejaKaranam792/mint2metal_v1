import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'neutral';
  className?: string;
}

export default function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium leading-tight';

  const variantClasses = {
    success: 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20',
    warning: 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20',
    error: 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20',
    neutral: 'bg-[#9CA3AF]/10 text-[#9CA3AF] border border-[#9CA3AF]/20',
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
