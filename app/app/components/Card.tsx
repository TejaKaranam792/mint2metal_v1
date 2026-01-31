import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'elevated' | 'bordered' | 'gradient' | 'glass';
  size?: 'sm' | 'md' | 'lg';
}

export default function Card({
  children,
  className = '',
  title,
  subtitle,
  icon,
  variant = 'default',
  size = 'md'
}: CardProps) {
  const baseClasses = 'rounded-xl border transition-all duration-200';

  const variantClasses = {
    default: 'bg-surface border-border shadow-sm hover:shadow-md',
    elevated: 'bg-elevated-surface border-border/50 shadow-lg hover:shadow-xl',
    bordered: 'bg-background border-border hover:border-primary/30',
    gradient: 'bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 border-primary/20 shadow-lg hover:shadow-xl'
  };

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}>
      {(title || subtitle || icon) && (
        <div className="flex items-start gap-3 mb-6">
          {icon && (
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-xl font-semibold text-primary-text leading-tight mb-1">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-secondary-text leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
