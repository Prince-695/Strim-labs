import * as React from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-surface/30 p-8 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-border-subtle bg-surface-raised text-foreground-muted">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-foreground-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex items-center gap-3">{action}</div>}
    </div>
  )
}
