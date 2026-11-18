"use client"

import * as React from "react"
import {
  Activity,
  AlertTriangle,
  ShieldCheck,
  Server,
  AlertCircle,
} from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import type { LiveEndpointHealth } from "@/lib/loadtest-api"

interface LiveEndpointHealthMatrixProps {
  endpointHealth: LiveEndpointHealth[]
  defaultTarget?: { method: string; path: string }
  isRunning: boolean
}

function getHealthBadge(status: string) {
  const norm = status?.toLowerCase()
  if (norm === "healthy") {
    return {
      label: "HEALTHY",
      className: "border-success/40 bg-success/10 text-success",
    }
  }
  if (norm === "degraded") {
    return {
      label: "DEGRADED",
      className: "border-warning/40 bg-warning/10 text-warning",
    }
  }
  if (norm === "failing") {
    return {
      label: "FAILING",
      className: "border-danger/40 bg-danger/10 text-danger",
    }
  }
  return {
    label: (status || "UNKNOWN").toUpperCase(),
    className: "border-border-subtle bg-surface-raised text-foreground-muted",
  }
}

function getMethodBadgeStyle(method: string) {
  switch (method?.toUpperCase()) {
    case "GET":
      return "text-brand bg-brand/10 border-brand/30"
    case "POST":
      return "text-emerald-400 bg-emerald-950/60 border-emerald-500/30"
    case "PUT":
    case "PATCH":
      return "text-amber-400 bg-amber-950/60 border-amber-500/30"
    case "DELETE":
      return "text-danger bg-danger/20 border-danger/30"
    default:
      return "text-sand bg-surface-raised border-border-subtle"
  }
}

export function LiveEndpointHealthMatrix({
  endpointHealth,
  defaultTarget,
  isRunning,
}: LiveEndpointHealthMatrixProps) {
  const hasData = endpointHealth.length > 0

  return (
    <Card className="relative flex flex-col overflow-hidden border-border bg-surface shadow-2xl">
      <CornerCrosshairs />
      <CardHeader className="border-b border-border-subtle pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
            <Server className="size-4 text-brand" />
            <span>Real-Time Per-API Health Matrix</span>
          </CardTitle>
          <span className="font-mono text-[11px] text-foreground-subtle">
            {endpointHealth.length}{" "}
            {endpointHealth.length === 1
              ? "route under test"
              : "routes under test"}
          </span>
        </div>
        <CardDescription className="font-mono text-xs text-foreground-muted">
          Live throughput, tail latency, error rate, and saturation breaking
          points per attacked route.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 p-0 font-mono text-xs">
        {!hasData ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center space-y-2 p-8 text-center text-foreground-subtle">
            <Activity className="size-6 animate-pulse text-foreground-muted" />
            <p className="text-xs font-medium text-foreground">
              {isRunning
                ? "Collecting per-endpoint breakdown from runner stream..."
                : "No per-endpoint breakdown available."}
            </p>
            {defaultTarget && (
              <p className="text-[11px] text-foreground-muted">
                Targeted route:{" "}
                <strong className="text-sand">
                  {defaultTarget.method} {defaultTarget.path}
                </strong>
              </p>
            )}
          </div>
        ) : (
          <div className="h-[380px] overflow-x-auto overflow-y-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="sticky top-0 z-10 border-b border-border-subtle bg-surface">
                <tr className="text-[11px] text-foreground-subtle uppercase">
                  <th className="px-3.5 py-2.5 font-semibold">Method</th>
                  <th className="px-3.5 py-2.5 font-semibold">Path</th>
                  <th className="px-3.5 py-2.5 text-right font-semibold">
                    RPS
                  </th>
                  <th className="px-3.5 py-2.5 text-right font-semibold">
                    p95 Latency
                  </th>
                  <th className="px-3.5 py-2.5 text-right font-semibold">
                    Error %
                  </th>
                  <th className="px-3.5 py-2.5 text-right font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {endpointHealth.map((ep, idx) => {
                  const healthBadge = getHealthBadge(ep.status)
                  const methodStyle = getMethodBadgeStyle(ep.method)

                  return (
                    <tr
                      key={`${ep.method}-${ep.path}-${idx}`}
                      className="transition-colors hover:bg-surface-raised/40"
                    >
                      {/* Method */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${methodStyle}`}
                        >
                          {ep.method}
                        </span>
                      </td>

                      {/* Path & Breaking Warning */}
                      <td className="max-w-[220px] px-3.5 py-2.5">
                        <div className="space-y-1">
                          <span
                            className="block truncate font-medium text-foreground"
                            title={ep.path}
                          >
                            {ep.path}
                          </span>
                          {ep.first_broke_at_rps &&
                          ep.first_broke_at_rps > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded border border-danger/40 bg-danger/15 px-1.5 py-0.5 text-[10px] font-bold text-danger">
                              <AlertTriangle className="size-2.5 shrink-0" />
                              <span>
                                Cracked at {ep.first_broke_at_rps.toFixed(0)}{" "}
                                RPS
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Current RPS */}
                      <td className="px-3.5 py-2.5 text-right font-semibold whitespace-nowrap text-foreground">
                        {ep.current_rps ? ep.current_rps.toFixed(1) : "0.0"}
                      </td>

                      {/* p95 Latency */}
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            ep.p95_latency_ms > 1000
                              ? "text-danger"
                              : ep.p95_latency_ms > 400
                                ? "text-warning"
                                : "text-sand"
                          }`}
                        >
                          {ep.p95_latency_ms
                            ? `${ep.p95_latency_ms.toFixed(1)}ms`
                            : "—"}
                        </span>
                      </td>

                      {/* Error % */}
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            ep.error_rate > 0.05
                              ? "text-danger"
                              : ep.error_rate > 0
                                ? "text-warning"
                                : "text-success"
                          }`}
                        >
                          {(ep.error_rate * 100).toFixed(1)}%
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <span
                          className={`rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${healthBadge.className}`}
                        >
                          {healthBadge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
