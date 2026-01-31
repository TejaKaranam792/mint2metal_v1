import * as React from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'gradient' | 'success' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'xl' | 'icon'
  loading?: boolean
  icon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', loading = false, icon, children, ...props }, ref) => {
    const baseClasses = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none"

    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md",
      gradient: "bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl hover:shadow-green-500/25 transform hover:-translate-y-0.5 active:translate-y-0",
      success: "bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-green-500/25 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm hover:shadow-md",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-md",
    }

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8 text-base",
      xl: "h-12 rounded-lg px-10 text-lg",
      icon: "h-10 w-10 p-0",
    }

    const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`

    if (loading) {
      return (
        <button
          className={classes}
          ref={ref}
          disabled
          {...props}
        >
          <div className="loading-spinner w-4 h-4 mr-2" />
          {children}
        </button>
      )
    }

    return (
      <button
        className={classes}
        ref={ref}
        {...props}
      >
        {icon && <span className="mr-2">{icon}</span>}
        {children}
      </button>
    )
  }
)

Button.displayName = "Button"

export { Button }
