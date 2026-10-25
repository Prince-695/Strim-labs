import { AlertOctagon, CheckCircle2, CircleSlash, Clock3 } from "lucide-react";
import { statusLabel } from "@/lib/format";
import type { StreamState, TestStatus } from "@/lib/types";
import { Badge } from "./ui/badge";

export function StatusBadge({ status }: { status: TestStatus | string }) {
  switch (status) {
    case "RUNNING":
      return (
        <Badge tone="brand">
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand" />
            <span className="relative size-2 rounded-full bg-brand" />
          </span>
          {statusLabel(status)}
        </Badge>
      );
    case "QUEUED":
      return (
        <Badge tone="info">
          <Clock3 /> {statusLabel(status)}
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge tone="success">
          <CheckCircle2 /> {statusLabel(status)}
        </Badge>
      );
    case "FAILED":
      return (
        <Badge tone="danger">
          <AlertOctagon /> {statusLabel(status)}
        </Badge>
      );
    case "ABORTED":
    case "CANCELLED":
      return (
        <Badge tone="warning">
          <CircleSlash /> {statusLabel(status)}
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
}

const STREAM: Record<StreamState, { label: string; tone: "neutral" | "brand" | "warning" | "danger" | "success" }> = {
  idle: { label: "Idle", tone: "neutral" },
  connecting: { label: "Connecting", tone: "neutral" },
  live: { label: "Live", tone: "brand" },
  reconnecting: { label: "Reconnecting", tone: "warning" },
  disconnected: { label: "Disconnected", tone: "danger" },
  completed: { label: "Stream closed", tone: "success" },
};

export function StreamBadge({ state }: { state: StreamState }) {
  const s = STREAM[state];
  return (
    <Badge tone={s.tone}>
      <span className={`size-1.5 rounded-full ${state === "live" ? "bg-brand" : "bg-current opacity-70"}`} />
      {s.label}
    </Badge>
  );
}
