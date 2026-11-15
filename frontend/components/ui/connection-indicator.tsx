import * as React from "react"
import { cn } from "@/lib/utils"

export type ConnectionState = "connected" | "reconnecting" | "disconnected" | "stale"

interface ConnectionIndicatorProps {
  state: ConnectionState
  lastUpdated?: string | Date
  className?: string
}

export function ConnectionIndicator({
  state,
  lastUpdated,
  className,
}: ConnectionIndicatorProps) {
  const config = {
    connected: {
      label: "Live Stream",
      dot: "bg-success",
      text: "text-success",
      pulse: true,
    },
    reconnecting: {
      label: "Reconnecting...",
      dot: "bg-warning",
      text: "text-warning",
      pulse: true,
    },
    stale: {
      label: "Data Stale",
      dot: "bg-warning",
      text: "text-warning",
      pulse: false,
    },
    disconnected: {
      label: "Disconnected",
      dot: "bg-foreground-subtle",
      text: "text-foreground-muted",
      pulse: false,
    },
  }[state]

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-2.5 py-1 text-xs font-mono",
        className
      )}
    >
      <span className="relative flex size-2">
        {config.pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              config.dot
            )}
          />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", config.dot)} />
      </span>
      <span className={cn("font-medium", config.text)}>{config.label}</span>
      {lastUpdated && (
        <span className="text-foreground-subtle">
          ({typeof lastUpdated === "string" ? lastUpdated : lastUpdated.toLocaleTimeString()})
        </span>
      )}
    </div>
  )
}
