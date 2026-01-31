import * as React from "react"

interface StatCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'positive' | 'negative'
  }
  icon?: React.ReactNode
  className?: string
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  className = ''
}) => {
  return (
    <div className={`stat-card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-muted-foreground text-sm font-medium">
          {title}
        </div>
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
      </div>

      <div className="stat-value">
        {value}
      </div>

      {change && (
        <div className={`stat-change ${change.type}`}>
          {change.type === 'positive' ? '↗' : '↘'} {Math.abs(change.value)}%
        </div>
      )}
    </div>
  )
}

export { StatCard }
