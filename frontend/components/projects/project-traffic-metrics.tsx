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
        <div className="rounded-xl border border-border bg-surface p-4 space-y-1 relative">
          <span className="font-mono text-[10px] text-foreground-subtle uppercase tracking-wider block">
            1h Request Volume
          </span>
          <p className="font-mono text-2xl font-bold text-foreground">
            {(project.stats_1h?.requests || 0).toLocaleString()}
          </p>
          <span className="font-mono text-[10px] text-foreground-muted">Observed traffic stream</span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 space-y-1 relative">
          <span className="font-mono text-[10px] text-foreground-subtle uppercase tracking-wider block">
            Tail P95 Latency
          </span>
          <p className="font-mono text-2xl font-bold text-foreground">
            {project.stats_1h?.p95_ms ? `${project.stats_1h.p95_ms.toFixed(0)}ms` : "—"}
          </p>
          <span className="font-mono text-[10px] text-emerald-400">
            {project.stats_1h?.p95_ms && project.stats_1h.p95_ms < 300 ? "Healthy (<300ms)" : "Normal limits"}
          </span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 space-y-1 relative">
          <span className="font-mono text-[10px] text-foreground-subtle uppercase tracking-wider block">
            Observed Error Rate
          </span>
          <p className="font-mono text-2xl font-bold text-foreground">
            {project.stats_1h?.error_rate !== undefined
              ? `${(project.stats_1h.error_rate * 100).toFixed(2)}%`
              : "0.00%"}
          </p>
          <span className="font-mono text-[10px] text-foreground-muted">4xx & 5xx proportion</span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 space-y-1 relative">
          <span className="font-mono text-[10px] text-foreground-subtle uppercase tracking-wider block">
            Discovered Endpoints
          </span>
          <p className="font-mono text-2xl font-bold text-brand">
            {endpointsCount || project.endpoint_count || 0}
          </p>
          <Link
            href={`/dashboard/projects/${projectId}/endpoints`}
            className="font-mono text-[10px] text-sand hover:underline inline-block"
          >
            Manage catalog →
          </Link>
        </div>
      </div>

      {/* Row: Status Code Distribution & Capacity Analysis */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Code Proportional Bar Card */}
        <Card className="border-border bg-surface shadow-xs relative overflow-hidden">
          <CornerCrosshairs />
          <CardHeader className="pb-3 border-b border-border-subtle">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-sand font-mono flex items-center gap-2">
                <Activity className="size-3.5 text-brand" />
                <span>HTTP Traffic Distribution (1h)</span>
              </CardTitle>
              <span className="font-mono text-[10px] text-foreground-subtle">
                {totalCodes.toLocaleString()} total requests
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 font-mono text-xs">
            {/* Visual Proportional Segmented Bar */}
            <div className="h-4 w-full rounded-full bg-surface-raised flex overflow-hidden border border-border-subtle/80">
              <div
                style={{ width: `${pct2xx}%` }}
                className="bg-emerald-500 hover:opacity-90 transition-all"
                title={`2xx Success: ${(codeClasses["2xx"] || 0).toLocaleString()} (${pct2xx.toFixed(1)}%)`}
              />
              <div
                style={{ width: `${pct3xx}%` }}
                className="bg-amber-400 hover:opacity-90 transition-all"
                title={`3xx Redirects: ${(codeClasses["3xx"] || 0).toLocaleString()} (${pct3xx.toFixed(1)}%)`}
              />
              <div
                style={{ width: `${pct4xx}%` }}
                className="bg-orange-500 hover:opacity-90 transition-all"
                title={`4xx Client Errors: ${(codeClasses["4xx"] || 0).toLocaleString()} (${pct4xx.toFixed(1)}%)`}
              />
              <div
                style={{ width: `${pct5xx}%` }}
                className="bg-rose-500 hover:opacity-90 transition-all"
                title={`5xx Server Errors: ${(codeClasses["5xx"] || 0).toLocaleString()} (${pct5xx.toFixed(1)}%)`}
              />
            </div>

            {/* Proportional Grid Stats */}
            <div className="grid grid-cols-4 gap-2 text-center pt-1">
              <div className="rounded-lg bg-surface-raised p-2 border border-border-subtle">
                <span className="text-[10px] text-emerald-400 block font-bold">2xx OK</span>
                <span className="text-xs font-bold text-foreground">
                  {(codeClasses["2xx"] || 0).toLocaleString()}
                </span>
                <span className="text-[9px] text-foreground-subtle block">{pct2xx.toFixed(1)}%</span>
              </div>
              <div className="rounded-lg bg-surface-raised p-2 border border-border-subtle">
                <span className="text-[10px] text-amber-400 block font-bold">3xx REDIR</span>
                <span className="text-xs font-bold text-foreground">
                  {(codeClasses["3xx"] || 0).toLocaleString()}
                </span>
                <span className="text-[9px] text-foreground-subtle block">{pct3xx.toFixed(1)}%</span>
              </div>
              <div className="rounded-lg bg-surface-raised p-2 border border-border-subtle">
                <span className="text-[10px] text-orange-400 block font-bold">4xx CLIENT</span>
                <span className="text-xs font-bold text-foreground">
                  {(codeClasses["4xx"] || 0).toLocaleString()}
                </span>
                <span className="text-[9px] text-foreground-subtle block">{pct4xx.toFixed(1)}%</span>
              </div>
              <div className="rounded-lg bg-surface-raised p-2 border border-border-subtle">
                <span className="text-[10px] text-rose-400 block font-bold">5xx SERVER</span>
                <span className="text-xs font-bold text-foreground">
                  {(codeClasses["5xx"] || 0).toLocaleString()}
                </span>
                <span className="text-[9px] text-foreground-subtle block">{pct5xx.toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Capacity Analysis & Breaking Point Card */}
        <Card className="border-border bg-surface shadow-xs relative overflow-hidden">
          <CornerCrosshairs />
          <CardHeader className="pb-3 border-b border-border-subtle">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-sand font-mono flex items-center gap-2">
                <Gauge className="size-3.5 text-brand" />
                <span>Capacity & Breaking Point Limits</span>
              </CardTitle>
              <Link
                href={`/dashboard/runner?project=${projectId}`}
                className="text-[11px] font-mono text-brand hover:underline"
              >
                + Run Stress Ramp
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 font-mono text-xs">
            {latestCompletedTest ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-1 border-b border-border-subtle/50">
                  <span className="text-foreground-muted">Safe Operating Throughput:</span>
                  <span className="font-bold text-brand text-sm">
                    {latestCompletedTest.summary?.achieved_avg_rps
                      ? `~${latestCompletedTest.summary.achieved_avg_rps.toFixed(0)} RPS`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border-subtle/50">
                  <span className="text-foreground-muted">Tail P95 Latency at Peak:</span>
                  <span className="font-semibold text-foreground">
                    {latestCompletedTest.summary?.p95_ms
                      ? `${latestCompletedTest.summary.p95_ms.toFixed(1)}ms`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border-subtle/50">
                  <span className="text-foreground-muted">SLO Threshold Status:</span>
                  <span className="text-emerald-400 font-semibold">
                    {latestCompletedTest.summary?.error_rate && latestCompletedTest.summary.error_rate > 0.05
                      ? "SLO Breached (>5% err)"
                      : "Passed (Zero saturation)"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-foreground-subtle text-[11px]">
                    Based on run: <strong className="text-foreground">{latestCompletedTest.name}</strong>
                  </span>
                  <Link
                    href={`/dashboard/runs/${latestCompletedTest.id}`}
                    className="text-xs text-brand hover:underline font-semibold"
                  >
                    Open Cockpit →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center space-y-2">
                <p className="text-foreground-muted text-xs">
                  No capacity stress runs executed yet for this project.
                </p>
                <Link
                  href={`/dashboard/runner?project=${projectId}`}
                  className={buttonVariants({
                    size: "sm",
                    className: "bg-brand text-white hover:bg-brand-hover text-xs font-mono",
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
