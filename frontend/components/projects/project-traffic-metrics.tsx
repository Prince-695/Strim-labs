"use client"

import * as React from "react"
import Link from "next/link"
import { Activity, Gauge } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import type { ProjectDetail } from "@/lib/project-api"
import type { LoadTestItem } from "@/lib/loadtest-api"

interface ProjectTrafficMetricsProps {
  project: ProjectDetail
  codeClasses: Record<string, number>
  totalCodes: number
  pct2xx: number
  pct3xx: number
  pct4xx: number
  pct5xx: number
  latestCompletedTest?: LoadTestItem
  endpointsCount: number
  projectId: string
}

export function ProjectTrafficMetrics({
  project,
  codeClasses,
  totalCodes,
  pct2xx,
  pct3xx,
  pct4xx,
  pct5xx,
  latestCompletedTest,
  endpointsCount,
  projectId,
}: ProjectTrafficMetricsProps) {
  return (
    <div className="space-y-6">
      {/* Telemetry KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="relative space-y-1 rounded-xl border border-border bg-surface p-4">
          <span className="block font-mono text-[10px] tracking-wider text-foreground-subtle uppercase">
            1h Request Volume
          </span>
          <p className="font-mono text-2xl font-bold text-foreground">
            {(project.stats_1h?.requests || 0).toLocaleString()}
          </p>
          <span className="font-mono text-[10px] text-foreground-muted">
            Observed traffic stream
          </span>
        </div>

        <div className="relative space-y-1 rounded-xl border border-border bg-surface p-4">
          <span className="block font-mono text-[10px] tracking-wider text-foreground-subtle uppercase">
            Tail P95 Latency
          </span>
          <p className="font-mono text-2xl font-bold text-foreground">
            {project.stats_1h?.p95_ms
              ? `${project.stats_1h.p95_ms.toFixed(0)}ms`
              : "—"}
          </p>
          <span className="font-mono text-[10px] text-emerald-400">
            {project.stats_1h?.p95_ms && project.stats_1h.p95_ms < 300
              ? "Healthy (<300ms)"
              : "Normal limits"}
          </span>
        </div>

        <div className="relative space-y-1 rounded-xl border border-border bg-surface p-4">
          <span className="block font-mono text-[10px] tracking-wider text-foreground-subtle uppercase">
            Observed Error Rate
          </span>
          <p className="font-mono text-2xl font-bold text-foreground">
            {project.stats_1h?.error_rate !== undefined
              ? `${(project.stats_1h.error_rate * 100).toFixed(2)}%`
              : "0.00%"}
          </p>
          <span className="font-mono text-[10px] text-foreground-muted">
            4xx & 5xx proportion
          </span>
        </div>

        <div className="relative space-y-1 rounded-xl border border-border bg-surface p-4">
          <span className="block font-mono text-[10px] tracking-wider text-foreground-subtle uppercase">
            Discovered Endpoints
          </span>
          <p className="font-mono text-2xl font-bold text-brand">
            {endpointsCount || project.endpoint_count || 0}
          </p>
          <Link
            href={`/dashboard/projects/${projectId}/endpoints`}
            className="inline-block font-mono text-[10px] text-sand hover:underline"
          >
            Manage catalog →
          </Link>
        </div>
      </div>

      {/* Row: Status Code Distribution & Capacity Analysis */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Code Proportional Bar Card */}
        <Card className="relative overflow-hidden border-border bg-surface shadow-xs">
          <CornerCrosshairs />
          <CardHeader className="border-b border-border-subtle pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-sand uppercase">
                <Activity className="size-3.5 text-brand" />
                <span>HTTP Traffic Distribution (1h)</span>
              </CardTitle>
              <span className="font-mono text-[10px] text-foreground-subtle">
                {totalCodes.toLocaleString()} total requests
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 font-mono text-xs">
            {/* Visual Proportional Segmented Bar */}
            <div className="flex h-4 w-full overflow-hidden rounded-full border border-border-subtle/80 bg-surface-raised">
              <div
                style={{ width: `${pct2xx}%` }}
                className="bg-emerald-500 transition-all hover:opacity-90"
                title={`2xx Success: ${(codeClasses["2xx"] || 0).toLocaleString()} (${pct2xx.toFixed(1)}%)`}
              />
              <div
                style={{ width: `${pct3xx}%` }}
                className="bg-amber-400 transition-all hover:opacity-90"
                title={`3xx Redirects: ${(codeClasses["3xx"] || 0).toLocaleString()} (${pct3xx.toFixed(1)}%)`}
              />
              <div
                style={{ width: `${pct4xx}%` }}
                className="bg-orange-500 transition-all hover:opacity-90"
                title={`4xx Client Errors: ${(codeClasses["4xx"] || 0).toLocaleString()} (${pct4xx.toFixed(1)}%)`}
              />
              <div
                style={{ width: `${pct5xx}%` }}
                className="bg-rose-500 transition-all hover:opacity-90"
                title={`5xx Server Errors: ${(codeClasses["5xx"] || 0).toLocaleString()} (${pct5xx.toFixed(1)}%)`}
              />
            </div>

            {/* Proportional Grid Stats */}
            <div className="grid grid-cols-4 gap-2 pt-1 text-center">
              <div className="rounded-lg border border-border-subtle bg-surface-raised p-2">
                <span className="block text-[10px] font-bold text-emerald-400">
                  2xx OK
                </span>
                <span className="text-xs font-bold text-foreground">
                  {(codeClasses["2xx"] || 0).toLocaleString()}
                </span>
                <span className="block text-[9px] text-foreground-subtle">
                  {pct2xx.toFixed(1)}%
                </span>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-raised p-2">
                <span className="block text-[10px] font-bold text-amber-400">
                  3xx REDIR
                </span>
                <span className="text-xs font-bold text-foreground">
                  {(codeClasses["3xx"] || 0).toLocaleString()}
                </span>
                <span className="block text-[9px] text-foreground-subtle">
                  {pct3xx.toFixed(1)}%
                </span>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-raised p-2">
                <span className="block text-[10px] font-bold text-orange-400">
                  4xx CLIENT
                </span>
                <span className="text-xs font-bold text-foreground">
                  {(codeClasses["4xx"] || 0).toLocaleString()}
                </span>
                <span className="block text-[9px] text-foreground-subtle">
                  {pct4xx.toFixed(1)}%
                </span>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-raised p-2">
                <span className="block text-[10px] font-bold text-rose-400">
                  5xx SERVER
                </span>
                <span className="text-xs font-bold text-foreground">
                  {(codeClasses["5xx"] || 0).toLocaleString()}
                </span>
                <span className="block text-[9px] text-foreground-subtle">
                  {pct5xx.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Capacity Analysis & Breaking Point Card */}
        <Card className="relative overflow-hidden border-border bg-surface shadow-xs">
          <CornerCrosshairs />
          <CardHeader className="border-b border-border-subtle pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-sand uppercase">
                <Gauge className="size-3.5 text-brand" />
                <span>Capacity & Breaking Point Limits</span>
              </CardTitle>
              <Link
                href={`/dashboard/runner?project=${projectId}`}
                className="font-mono text-[11px] text-brand hover:underline"
              >
                + Run Stress Ramp
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 font-mono text-xs">
            {latestCompletedTest ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border-subtle/50 py-1">
                  <span className="text-foreground-muted">
                    Safe Operating Throughput:
                  </span>
                  <span className="text-sm font-bold text-brand">
                    {latestCompletedTest.summary?.achieved_avg_rps
                      ? `~${latestCompletedTest.summary.achieved_avg_rps.toFixed(0)} RPS`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-border-subtle/50 py-1">
                  <span className="text-foreground-muted">
                    Tail P95 Latency at Peak:
                  </span>
                  <span className="font-semibold text-foreground">
                    {latestCompletedTest.summary?.p95_ms
                      ? `${latestCompletedTest.summary.p95_ms.toFixed(1)}ms`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-border-subtle/50 py-1">
                  <span className="text-foreground-muted">
                    SLO Threshold Status:
                  </span>
                  <span className="font-semibold text-emerald-400">
                    {latestCompletedTest.summary?.error_rate &&
                    latestCompletedTest.summary.error_rate > 0.05
                      ? "SLO Breached (>5% err)"
                      : "Passed (Zero saturation)"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-foreground-subtle">
                    Based on run:{" "}
                    <strong className="text-foreground">
                      {latestCompletedTest.name}
                    </strong>
                  </span>
                  <Link
                    href={`/dashboard/runs/${latestCompletedTest.id}`}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Open Cockpit →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2 py-6 text-center">
                <p className="text-xs text-foreground-muted">
                  No capacity stress runs executed yet for this project.
                </p>
                <Link
                  href={`/dashboard/runner?project=${projectId}`}
                  className={buttonVariants({
                    size: "sm",
                    className:
                      "bg-brand font-mono text-xs text-white hover:bg-brand-hover",
                  })}
                >
                  Run First Capacity Test
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
