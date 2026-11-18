"use client"

import * as React from "react"
import { Terminal, Activity, ArrowUpRight, Wifi, WifiOff } from "lucide-react"
import type { LiveRequestLog } from "@/lib/loadtest-api"

interface LiveTrafficStreamTerminalProps {
  logs: LiveRequestLog[]
  isRunning: boolean
  activeRps: number
  totalRequests: number
  runnerZone?: string
}

function getStatusBadge(statusCode: number, isError: boolean, error?: string) {
  if (
    isError ||
    statusCode >= 500 ||
    error?.toLowerCase().includes("timeout")
  ) {
    const text =
      statusCode === 504 || error?.toLowerCase().includes("timeout")
        ? "504 TIMEOUT"
        : statusCode === 502
          ? "502 BAD GATEWAY"
          : statusCode === 500
            ? "500 SERVER ERROR"
            : `${statusCode || "ERR"} FAIL`
    return {
      text,
      badgeColor: "text-danger border-danger-subtle bg-danger-subtle/30",
    }
  }
  if (statusCode === 429) {
    return {
      text: "429 RATE LIMIT",
      badgeColor: "text-warning border-warning-subtle bg-warning-subtle/30",
    }
  }
  if (statusCode >= 400) {
    return {
      text: `${statusCode} CLIENT ERR`,
      badgeColor: "text-warning border-warning-subtle bg-warning-subtle/30",
    }
  }
  if (statusCode === 201) {
    return {
      text: "201 CREATED",
      badgeColor: "text-success border-success-subtle bg-success-subtle/30",
    }
  }
  return {
    text: `${statusCode || 200} OK`,
    badgeColor: "text-success border-success-subtle bg-success-subtle/30",
  }
}

function getMethodStyle(method: string) {
  switch (method?.toUpperCase()) {
    case "GET":
      return "bg-brand/15 text-brand border-brand/30"
    case "POST":
      return "bg-emerald-950/60 text-emerald-400 border-emerald-500/30"
    case "PUT":
    case "PATCH":
      return "bg-amber-950/60 text-amber-400 border-amber-500/30"
    case "DELETE":
      return "bg-danger/20 text-danger border-danger/30"
    default:
      return "bg-surface-raised text-sand border-border-subtle"
  }
}

export function LiveTrafficStreamTerminal({
  logs,
  isRunning,
  activeRps,
  totalRequests,
  runnerZone = "US-EAST CLUSTER",
}: LiveTrafficStreamTerminalProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-raised shadow-2xl">
      {/* Terminal Title Bar */}
      <div className="flex flex-col justify-between gap-2 border-b border-border-subtle bg-background px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${
              isRunning ? "animate-pulse bg-success" : "bg-foreground-subtle"
            }`}
          />
          <span className="font-mono text-xs font-bold tracking-tight text-foreground">
            LIVE TRAFFIC FEED · DISTRIBUTED RUNNER ZONE {runnerZone}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-foreground-subtle">
          <span>
            ACTIVE RPS:{" "}
            <strong className="text-brand">{activeRps.toFixed(1)}</strong>
          </span>
          <span>·</span>
          <span>
            LOG FEED: <strong className="text-sand">{logs.length}</strong>{" "}
            ENTRIES
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            {isRunning ? (
              <span className="inline-flex items-center gap-1 text-success">
                <Wifi className="size-3" /> STREAMING
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-foreground-subtle">
                <WifiOff className="size-3" /> STOPPED
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Real-time Streaming Rows Feed */}
      <div className="h-[380px] space-y-2 overflow-y-auto p-3 font-mono text-xs sm:p-4">
        {logs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center space-y-2 rounded-lg border border-dashed border-border-subtle/60 p-6 text-center text-foreground-subtle">
            <Terminal className="size-8 animate-pulse text-foreground-muted" />
            <p className="text-xs font-medium text-foreground">
              Awaiting live request stream...
            </p>
            <p className="max-w-sm text-[11px] text-foreground-muted">
              {isRunning
                ? "Runner nodes are dispatching load test traffic. Streaming logs will appear below in real time."
                : "No request logs recorded in this session."}
            </p>
          </div>
        ) : (
          logs.map((log, index) => {
            const badge = getStatusBadge(
              log.status_code,
              log.is_error,
              log.error
            )
            const methodStyle = getMethodStyle(log.method)

            return (
              <div
                key={`${log.time}-${log.path}-${index}`}
                className="flex flex-col justify-between gap-2 rounded border border-border bg-background p-2.5 transition-colors hover:border-border sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="shrink-0 text-[10px] text-foreground-subtle">
                    {log.time
                      ? log.time.split("T")[1]?.slice(0, 8) || log.time
                      : "00:00:00"}
                  </span>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${methodStyle}`}
                  >
                    {log.method || "GET"}
                  </span>
                  <span className="max-w-xs truncate font-medium text-foreground sm:max-w-md">
                    {log.path}
                  </span>
                  {log.error && (
                    <span
                      className="max-w-[140px] shrink-0 truncate text-[10px] text-danger"
                      title={log.error}
                    >
                      ({log.error})
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3 text-right sm:justify-end">
                  {log.bytes > 0 && (
                    <span className="hidden text-[10px] text-foreground-subtle md:inline">
                      {(log.bytes / 1024).toFixed(1)} KB
                    </span>
                  )}
                  <span className="w-16 text-right text-[11px] font-semibold text-sand">
                    {log.latency_ms !== undefined
                      ? `${log.latency_ms.toFixed(1)} ms`
                      : "—"}
                  </span>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${badge.badgeColor}`}
                  >
                    {badge.text}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Bottom Terminal Aggregate Counters */}
      <div className="grid grid-cols-2 gap-3 border-t border-border-subtle bg-background p-3 font-mono text-xs sm:p-4 md:grid-cols-3">
        <div>
          <p className="text-[10px] text-foreground-subtle uppercase">
            TOTAL REQUESTS
          </p>
          <p className="text-base font-bold text-foreground">
            {totalRequests.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-foreground-subtle uppercase">
            STREAMING BUFFER
          </p>
          <p className="text-base font-bold text-brand">
            {logs.length} / 100 entries
          </p>
        </div>
        <div className="hidden md:block">
          <p className="text-[10px] text-foreground-subtle uppercase">
            CLUSTER PROTOCOL
          </p>
          <p className="text-base font-bold text-sand">HTTP/1.1 & HTTP/2</p>
        </div>
      </div>
    </div>
  )
}
