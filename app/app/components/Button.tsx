import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  loading = false,
  icon,
  ...props
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClasses = {
    sm: 'h-8 px-3 text-sm rounded-lg gap-1.5',
    md: 'h-10 px-4 text-sm rounded-lg gap-2',
    lg: 'h-12 px-6 text-base rounded-xl gap-2',
  };

  const variantClasses = {
    primary: 'bg-gradient-to-r from-primary to-accent text-background hover:shadow-lg hover:shadow-primary/25 focus:ring-primary transform hover:scale-[1.02] active:scale-[0.98]',
    secondary: 'bg-surface border border-border text-primary-text hover:bg-elevated-surface focus:ring-primary',
    outline: 'border border-primary/30 text-primary hover:bg-primary/10 focus:ring-primary',
    ghost: 'text-secondary-text hover:text-primary-text hover:bg-surface/50 focus:ring-primary',
    success: 'bg-gradient-to-r from-success to-success/80 text-background hover:shadow-lg hover:shadow-success/25 focus:ring-success',
    danger: 'bg-gradient-to-r from-error to-error/80 text-background hover:shadow-lg hover:shadow-error/25 focus:ring-error',
  };

  const classes = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

  if (loading) {
    return (
      <button
        className={classes}
        disabled
        {...props}
      >
        <div className="animate-spin rounded-full border-2 border-current border-t-transparent w-4 h-4" />
        <span className="ml-2">{children}</span>
      </button>
    );
  }

  return (
    <button
      className={classes}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
