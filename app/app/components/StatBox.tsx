import React from 'react';

interface StatBoxProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'positive' | 'negative' | 'neutral';
  };
  icon?: React.ReactNode;
  className?: string;
}

export default function StatBox({ title, value, change, icon, className = '' }: StatBoxProps) {
  const changeColor = change?.type === 'positive' ? 'text-[#16A34A]' :
                     change?.type === 'negative' ? 'text-[#DC2626]' : 'text-[#9CA3AF]';

  return (
    <div className={`bg-[#111827] border border-[#1F2937] rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#9CA3AF] leading-relaxed">{title}</p>
          <p className="text-2xl font-bold text-[#F9FAFB] mt-2 leading-tight">{value}</p>
          {change && (
            <p className={`text-sm font-medium mt-2 ${changeColor} leading-relaxed`}>
              {change.type === 'positive' ? '↑' : change.type === 'negative' ? '↓' : '→'} {Math.abs(change.value)}%
            </p>
          )}
        </div>
        {icon && <div className="text-[#6B7280]">{icon}</div>}
      </div>
    </div>
  );
}
