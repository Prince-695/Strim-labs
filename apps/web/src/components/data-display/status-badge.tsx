import { cn } from "@/lib/utils";

type StatusType =
  | "ACTIVE"
  | "HEALTHY"
  | "DEGRADED"
  | "DOWN"
  | "PENDING"
  | "PENDING_SDK"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "ABORTED"
  | "CANCELLED"
  | "CRITICAL"
  | "WARNING"
  | "INFO"
  | "RESOLVED"
  | "OPEN"
  | "ACKNOWLEDGED"
  | string;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  showDot?: boolean;
}

const statusConfig: Record<string, { label: string; dotColor: string; badgeClass: string }> = {
  ACTIVE: {
    label: "Active",
    dotColor: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  HEALTHY: {
    label: "Healthy",
    dotColor: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  COMPLETED: {
    label: "Completed",
    dotColor: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  RESOLVED: {
    label: "Resolved",
    dotColor: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  RUNNING: {
    label: "Running",
    dotColor: "bg-blue-500 animate-pulse",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  QUEUED: {
    label: "Queued",
    dotColor: "bg-blue-400",
    badgeClass: "bg-blue-400/10 text-blue-500 border-blue-400/20",
  },
  DEGRADED: {
    label: "Degraded",
    dotColor: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  WARNING: {
    label: "Warning",
    dotColor: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  ACKNOWLEDGED: {
    label: "Acknowledged",
    dotColor: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  DOWN: {
    label: "Down",
    dotColor: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
  FAILED: {
    label: "Failed",
    dotColor: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
  CRITICAL: {
    label: "Critical",
    dotColor: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
  ABORTED: {
    label: "Aborted",
    dotColor: "bg-zinc-400",
    badgeClass: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  },
  CANCELLED: {
    label: "Cancelled",
    dotColor: "bg-zinc-400",
    badgeClass: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  },
  PENDING: {
    label: "Pending",
    dotColor: "bg-zinc-400",
    badgeClass: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  },
  PENDING_SDK: {
    label: "Waiting for SDK",
    dotColor: "bg-zinc-400",
    badgeClass: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  },
};

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const upper = (status || "").toUpperCase();
  const config = statusConfig[upper] || {
    label: status,
    dotColor: "bg-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        config.badgeClass,
        className
      )}
    >
      {showDot && <span className={cn("size-1.5 rounded-full", config.dotColor)} />}
      <span>{config.label}</span>
    </span>
  );
}
