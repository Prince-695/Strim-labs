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
  if (isError || statusCode >= 500 || error?.toLowerCase().includes("timeout")) {
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
    <div className="rounded-xl border border-border-subtle bg-surface-raised overflow-hidden shadow-2xl flex flex-col">
      {/* Terminal Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border-subtle bg-background px-4 py-3 gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${
              isRunning ? "bg-success animate-pulse" : "bg-foreground-subtle"
            }`}
          />
          <span className="font-mono text-xs text-foreground font-bold tracking-tight">
            LIVE TRAFFIC FEED · DISTRIBUTED RUNNER ZONE {runnerZone}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-foreground-subtle">
          <span>
            ACTIVE RPS: <strong className="text-brand">{activeRps.toFixed(1)}</strong>
          </span>
          <span>·</span>
          <span>
            LOG FEED: <strong className="text-sand">{logs.length}</strong> ENTRIES
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            {isRunning ? (
              <span className="text-success inline-flex items-center gap-1">
                <Wifi className="size-3" /> STREAMING
              </span>
            ) : (
              <span className="text-foreground-subtle inline-flex items-center gap-1">
                <WifiOff className="size-3" /> STOPPED
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Real-time Streaming Rows Feed */}
      <div className="p-3 sm:p-4 space-y-2 font-mono text-xs h-[380px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-foreground-subtle border border-dashed border-border-subtle/60 rounded-lg">
            <Terminal className="size-8 text-foreground-muted animate-pulse" />
            <p className="text-xs text-foreground font-medium">Awaiting live request stream...</p>
            <p className="text-[11px] text-foreground-muted max-w-sm">
              {isRunning
                ? "Runner nodes are dispatching load test traffic. Streaming logs will appear below in real time."
                : "No request logs recorded in this session."}
            </p>
          </div>
        ) : (
          logs.map((log, index) => {
            const badge = getStatusBadge(log.status_code, log.is_error, log.error)
            const methodStyle = getMethodStyle(log.method)

            return (
              <div
                key={`${log.time}-${log.path}-${index}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded border border-border bg-background p-2.5 hover:border-border transition-colors gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] text-foreground-subtle shrink-0">
                    {log.time ? log.time.split("T")[1]?.slice(0, 8) || log.time : "00:00:00"}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border shrink-0 ${methodStyle}`}
                  >
                    {log.method || "GET"}
                  </span>
                  <span className="text-foreground font-medium truncate max-w-xs sm:max-w-md">
                    {log.path}
                  </span>
                  {log.error && (
                    <span className="text-danger text-[10px] truncate max-w-[140px] shrink-0" title={log.error}>
                      ({log.error})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 sm:justify-end shrink-0 text-right">
                  {log.bytes > 0 && (
                    <span className="text-[10px] text-foreground-subtle hidden md:inline">
                      {(log.bytes / 1024).toFixed(1)} KB
                    </span>
                  )}
                  <span className="text-sand font-semibold text-[11px] w-16 text-right">
                    {log.latency_ms !== undefined ? `${log.latency_ms.toFixed(1)} ms` : "—"}
                  </span>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.badgeColor}`}
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 sm:p-4 border-t border-border-subtle bg-background font-mono text-xs">
        <div>
          <p className="text-[10px] text-foreground-subtle uppercase">TOTAL REQUESTS</p>
          <p className="text-base font-bold text-foreground">
            {totalRequests.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-foreground-subtle uppercase">STREAMING BUFFER</p>
          <p className="text-base font-bold text-brand">
            {logs.length} / 100 entries
          </p>
        </div>
        <div className="hidden md:block">
          <p className="text-[10px] text-foreground-subtle uppercase">CLUSTER PROTOCOL</p>
          <p className="text-base font-bold text-sand">
            HTTP/1.1 & HTTP/2
          </p>
        </div>
      </div>
    </div>
  )
}
