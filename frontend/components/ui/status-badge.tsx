import * as React from "react"
import { cn } from "@/lib/utils"

export type StatusType =
  | "healthy"
  | "completed"
  | "passed"
  | "running"
  | "in_progress"
  | "degraded"
  | "warning"
  | "failing"
  | "failed"
  | "critical"
  | "pending"
  | "queued"
  | "draft"
  | "stopped"
  | "disconnected"
  | "stale"
  | "unverified"
  | "verified"

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType | string
  label?: string
  pulse?: boolean
  size?: "sm" | "md"
}

export function StatusBadge({
  status,
  label,
  pulse = false,
  size = "md",
  className,
  ...props
}: StatusBadgeProps) {
  const normalized = status.toLowerCase() as StatusType
  const displayLabel = label || status.replace(/_/g, " ")

  const getVariantStyles = () => {
    switch (normalized) {
      case "healthy":
      case "completed":
      case "passed":
      case "verified":
        return {
          container: "bg-success-subtle text-success border-success/30",
          dot: "bg-success",
        }
      case "running":
      case "in_progress":
        return {
          container: "bg-brand-subtle text-info border-brand/30",
          dot: "bg-brand",
          autoPulse: true,
        }
      case "degraded":
      case "warning":
        return {
          container: "bg-warning-subtle text-warning border-warning/30",
          dot: "bg-warning",
        }
      case "failing":
      case "failed":
      case "critical":
        return {
          container: "bg-danger-subtle text-danger border-danger/30",
          dot: "bg-danger",
        }
      case "pending":
      case "queued":
      case "draft":
      case "unverified":
        return {
          container: "bg-sand-subtle text-sand border-sand/30",
          dot: "bg-sand",
        }
      case "stopped":
      case "disconnected":
      case "stale":
      default:
        return {
          container:
            "bg-surface-raised text-foreground-muted border-border-subtle",
          dot: "bg-foreground-subtle",
        }
    }
  }

  const { container, dot, autoPulse } = getVariantStyles()
  const isPulsing = pulse || autoPulse

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-mono font-medium tracking-tight capitalize",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        container,
        className
      )}
      {...props}
    >
      <span className="relative flex size-2 shrink-0">
        {isPulsing && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              dot
            )}
          />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", dot)} />
      </span>
      <span>{displayLabel}</span>
    </span>
  )
}
