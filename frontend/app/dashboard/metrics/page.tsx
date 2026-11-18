"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  LineChart,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Globe,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Server,
  Layers,
  Calendar,
} from "lucide-react"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { metricsApi } from "@/lib/metrics-api"
import { projectApi } from "@/lib/project-api"
import { useUIStore } from "@/lib/stores/ui-store"
import { TimeseriesChart } from "@/components/metrics/timeseries-chart"

const TIME_RANGES: { id: string; label: string; short: string }[] = [
  { id: "24h", label: "1 Day (24h)", short: "24h" },
  { id: "7d", label: "7 Days (7d)", short: "7d" },
  { id: "30d", label: "30 Days (30d)", short: "30d" },
  { id: "1h", label: "1 Hour (1h)", short: "1h" },
]

export default function MetricsObservabilityPage() {
  const { currentOrgId, currentProjectId, setCurrentProjectId } = useUIStore()
  // Feature 3: Default to 24h with 7d and 30d toggles
  const [selectedRange, setSelectedRange] = React.useState("24h")

  // 1. Fetch Projects to populate selector
  const { data: projectsRes } = useQuery({
    queryKey: ["projects_list", currentOrgId],
    queryFn: () => projectApi.list(currentOrgId!),
    enabled: Boolean(currentOrgId),
  })

  const projects = projectsRes?.data || []
  const activeProject =
    projects.find((p) => p.id === currentProjectId) || (projects.length > 0 ? projects[0] : null)

  const activeProjectId = activeProject?.id || ""

  // 2. Fetch Metrics Overview (Total Requests, Average RPS, p95 Latency, Error Rate)
  const { data: overviewRes, isLoading: isOverviewLoading } = useQuery({
    queryKey: ["metrics_overview", currentOrgId, activeProjectId, selectedRange],
    queryFn: () => metricsApi.getOverview(currentOrgId!, activeProjectId, selectedRange),
    enabled: Boolean(currentOrgId && activeProjectId),
    refetchInterval: 10000,
  })

  // 3. Fetch Throughput Timeseries (rps)
  const { data: rpsTimeseriesRes, isLoading: isRpsLoading } = useQuery({
    queryKey: ["metrics_timeseries_rps", currentOrgId, activeProjectId, selectedRange],
    queryFn: () => metricsApi.getTimeseries(currentOrgId!, activeProjectId, "rps", selectedRange),
    enabled: Boolean(currentOrgId && activeProjectId),
    refetchInterval: 15000,
  })

  // 4. Fetch Latency Timeseries (p95)
  const { data: p95TimeseriesRes, isLoading: isP95Loading } = useQuery({
    queryKey: ["metrics_timeseries_p95", currentOrgId, activeProjectId, selectedRange],
    queryFn: () => metricsApi.getTimeseries(currentOrgId!, activeProjectId, "p95", selectedRange),
    enabled: Boolean(currentOrgId && activeProjectId),
    refetchInterval: 15000,
  })

  // 5. Fetch Status Code Distribution
  const { data: statusCodesRes, isLoading: isStatusLoading } = useQuery({
    queryKey: ["metrics_status_codes", currentOrgId, activeProjectId, selectedRange],
    queryFn: () => metricsApi.getStatusCodes(currentOrgId!, activeProjectId, selectedRange),
    enabled: Boolean(currentOrgId && activeProjectId),
    refetchInterval: 10000,
  })

  // 6. Fetch Per-Endpoint Metrics
  const { data: endpointsRes, isLoading: isEndpointsLoading } = useQuery({
    queryKey: ["metrics_endpoints", currentOrgId, activeProjectId, selectedRange],
    queryFn: () => metricsApi.getEndpoints(currentOrgId!, activeProjectId, selectedRange),
    enabled: Boolean(currentOrgId && activeProjectId),
  })

  const overview = overviewRes?.data
  const statusCodes = statusCodesRes?.data
  const endpoints = endpointsRes?.data || []

  const rpsPoints = rpsTimeseriesRes?.data?.series?.[0]?.points || []
  const p95Points = p95TimeseriesRes?.data?.series?.[0]?.points || []

  // Calculate Status Code percentages
  const classes = statusCodes?.classes || {}
  const count2xx = classes["2xx"] || 0
  const count3xx = classes["3xx"] || 0
  const count4xx = classes["4xx"] || 0
  const count5xx = classes["5xx"] || 0
  const totalStatusRequests = count2xx + count3xx + count4xx + count5xx || 1

  const pct2xx = ((count2xx / totalStatusRequests) * 100).toFixed(1)
  const pct3xx = ((count3xx / totalStatusRequests) * 100).toFixed(1)
  const pct4xx = ((count4xx / totalStatusRequests) * 100).toFixed(1)
  const pct5xx = ((count5xx / totalStatusRequests) * 100).toFixed(1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telemetry & Traffic Observability"
        description="Inspect real-time HTTP traffic, 1d / 7d / 30d tail latency trends, and per-endpoint health status."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Target Project Selector */}
            <select
              value={activeProjectId}
              onChange={(e) => setCurrentProjectId(e.target.value)}
              className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:border-brand"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.environment})
                </option>
              ))}
            </select>

            {/* Feature 3: Time Range Toggle Bar (1 Day (24h), 7 Days (7d), 30 Days (30d)) */}
            <div className="inline-flex rounded-lg border border-border-subtle bg-surface-raised p-0.5 font-mono text-xs">
              {TIME_RANGES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRange(r.id)}
                  className={`rounded px-2.5 py-1 transition-colors font-medium ${
                    selectedRange === r.id
                      ? "bg-brand text-white shadow-xs"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  <span className="hidden sm:inline">{r.label}</span>
                  <span className="sm:hidden">{r.short}</span>
                </button>
              ))}
            </div>
          </div>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={<LineChart className="size-6 text-sand" />}
          title="No Target APIs Configured"
          description="Register an API service target to start collecting live telemetry and status code distribution."
          action={
            <Link
              href="/dashboard/projects"
              className="bg-brand text-white hover:bg-brand-hover text-xs font-mono px-4 py-2 rounded-lg"
            >
              Register Target
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Active Target Banner */}
          {activeProject && (
            <Card className="border-border bg-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
              <div className="flex items-center gap-3">
                <span className="font-heading font-bold text-sm text-foreground">
                  {activeProject.name}
                </span>
                <span className="rounded bg-surface-raised px-2 py-0.5 text-[10px] uppercase text-sand border border-border-subtle">
                  {activeProject.environment}
                </span>
                <div className="flex items-center gap-1.5 text-foreground-muted">
                  <Globe className="size-3.5 text-foreground-subtle" />
                  <span>{activeProject.base_url}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-foreground-subtle text-[11px]">Active Window:</span>
                <span className="font-bold text-brand uppercase">{selectedRange}</span>
                <span className="text-foreground-subtle">·</span>
                <StatusBadge
                  status={activeProject.verification_status === "verified" ? "completed" : "pending"}
                  label={activeProject.verification_status === "verified" ? "VERIFIED TARGET" : "UNVERIFIED"}
                />
              </div>
            </Card>
          )}

          {/* Feature 3: KPI Metrics Row (Total Requests, Average RPS, p95 Latency, Error Rate) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-surface p-4 space-y-1 font-mono">
              <span className="text-[10px] text-foreground-subtle uppercase">Total Volume ({selectedRange})</span>
              <p className="text-2xl font-bold text-foreground">
                {(overview?.total_requests || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-foreground-muted">Observed HTTPS requests</p>
            </Card>

            <Card className="border-border bg-surface p-4 space-y-1 font-mono">
              <span className="text-[10px] text-foreground-subtle uppercase">Average Throughput</span>
              <p className="text-2xl font-bold text-brand">
                {(overview?.average_rps || 0).toFixed(1)} <span className="text-xs text-foreground-muted font-normal">RPS</span>
              </p>
              <p className="text-[10px] text-foreground-muted">Peak: {(overview?.peak_rps || 0).toFixed(1)} RPS</p>
            </Card>

            <Card className="border-border bg-surface p-4 space-y-1 font-mono">
              <span className="text-[10px] text-foreground-subtle uppercase">P95 Tail Latency</span>
              <p className="text-2xl font-bold text-foreground">
                {overview?.p95_ms ? `${overview.p95_ms.toFixed(1)}ms` : "—"}
              </p>
              <p className="text-[10px] text-foreground-muted">P99: {overview?.p99_ms ? `${overview.p99_ms.toFixed(1)}ms` : "—"}</p>
            </Card>

            <Card className="border-border bg-surface p-4 space-y-1 font-mono">
              <span className="text-[10px] text-foreground-subtle uppercase">Error Proportion</span>
              <p className={`text-2xl font-bold ${overview?.error_rate && overview.error_rate > 0.05 ? "text-danger" : "text-success"}`}>
                {overview?.error_rate !== undefined ? `${(overview.error_rate * 100).toFixed(2)}%` : "0.00%"}
              </p>
              <p className="text-[10px] text-foreground-muted">{overview?.error_count || 0} failed requests</p>
            </Card>
          </div>

          {/* Feature 3: Timeseries Charts Row (Throughput RPS & P95 Latency over 1d / 7d / 30d window) */}
          <div className="grid gap-6 lg:grid-cols-2">
            <TimeseriesChart
              title="Throughput Rate Trend"
              description={`Achieved requests per second across the selected ${selectedRange} timeframe.`}
              points={rpsPoints}
              unit="req/s"
              color="brand"
              isLoading={isRpsLoading}
              selectedRange={selectedRange}
            />

            <TimeseriesChart
              title="Tail Latency (p95) Trend"
              description={`95th percentile response times in milliseconds over ${selectedRange}.`}
              points={p95Points}
              unit="ms"
              color="amber"
              isLoading={isP95Loading}
              selectedRange={selectedRange}
            />
          </div>

          {/* HTTP Status Code Distribution Card */}
          <Card className="border-border bg-surface shadow-xs">
            <CardHeader className="pb-3 border-b border-border-subtle">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold font-heading text-foreground flex items-center gap-2">
                    <Activity className="size-4 text-brand" />
                    <span>HTTP Status Code Distribution</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-foreground-muted font-mono mt-0.5">
                    Proportional breakdown of observed response status classes across {selectedRange}.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-success" />
                    <span className="text-[11px] text-foreground-muted">2xx ({pct2xx}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-sand" />
                    <span className="text-[11px] text-foreground-muted">3xx ({pct3xx}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-warning" />
                    <span className="text-[11px] text-foreground-muted">4xx ({pct4xx}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-danger" />
                    <span className="text-[11px] text-foreground-muted">5xx ({pct5xx}%)</span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-5">
              {/* Proportional Multi-Segment Progress Bar */}
              <div className="h-4 w-full rounded-full bg-surface-raised overflow-hidden flex shadow-inner">
                <div
                  style={{ width: `${pct2xx}%` }}
                  className="bg-success transition-all duration-300"
                  title={`2xx Success: ${count2xx.toLocaleString()} (${pct2xx}%)`}
                />
                <div
                  style={{ width: `${pct3xx}%` }}
                  className="bg-sand transition-all duration-300"
                  title={`3xx Redirect: ${count3xx.toLocaleString()} (${pct3xx}%)`}
                />
                <div
                  style={{ width: `${pct4xx}%` }}
                  className="bg-warning transition-all duration-300"
                  title={`4xx Client Error: ${count4xx.toLocaleString()} (${pct4xx}%)`}
                />
                <div
                  style={{ width: `${pct5xx}%` }}
                  className="bg-danger transition-all duration-300"
                  title={`5xx Server Error: ${count5xx.toLocaleString()} (${pct5xx}%)`}
                />
              </div>

              {/* Status Code Class Cards */}
              <div className="grid gap-3 sm:grid-cols-4 font-mono text-xs">
                <div className="rounded-xl border border-success/30 bg-success/10 p-3 space-y-1">
                  <div className="flex items-center justify-between text-success">
                    <span className="font-bold">2xx Success</span>
                    <span className="text-[11px]">{pct2xx}%</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {count2xx.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-foreground-muted">OK & Created</p>
                </div>

                <div className="rounded-xl border border-sand/30 bg-sand/10 p-3 space-y-1">
                  <div className="flex items-center justify-between text-sand">
                    <span className="font-bold">3xx Redirect</span>
                    <span className="text-[11px]">{pct3xx}%</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {count3xx.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-foreground-muted">Moved & Not Modified</p>
                </div>

                <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 space-y-1">
                  <div className="flex items-center justify-between text-warning">
                    <span className="font-bold">4xx Client Errors</span>
                    <span className="text-[11px]">{pct4xx}%</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {count4xx.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-foreground-muted">Unauthorized & 404</p>
                </div>

                <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 space-y-1">
                  <div className="flex items-center justify-between text-danger">
                    <span className="font-bold">5xx Server Errors</span>
                    <span className="text-[11px]">{pct5xx}%</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {count5xx.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-foreground-muted">500 & 503 Saturation</p>
                </div>
              </div>

              {/* Granular Code Breakdown List if available */}
              {statusCodes?.codes && statusCodes.codes.length > 0 && (
                <div className="pt-2 border-t border-border-subtle">
                  <span className="font-mono text-[10px] uppercase text-foreground-subtle tracking-wider block mb-2">
                    Observed Status Codes Breakdown:
                  </span>
                  <div className="flex flex-wrap gap-2 font-mono text-xs">
                    {statusCodes.codes.map((item) => (
                      <div
                        key={item.status}
                        className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-1 flex items-center gap-2"
                      >
                        <span
                          className={`font-bold ${
                            item.status >= 500
                              ? "text-danger"
                              : item.status >= 400
                              ? "text-warning"
                              : item.status >= 300
                              ? "text-sand"
                              : "text-success"
                          }`}
                        >
                          {item.status}
                        </span>
                        <span className="text-foreground-subtle">|</span>
                        <span className="text-foreground font-medium">
                          {item.count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feature 3: Top Endpoints Table Showing Per-Endpoint Health Status Over Selected Window */}
          <Card className="border-border bg-surface shadow-xs">
            <CardHeader className="pb-3 border-b border-border-subtle">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold font-heading text-foreground flex items-center gap-2">
                    <Server className="size-4 text-brand" />
                    <span>Endpoint Health & Traffic Matrix ({selectedRange})</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-foreground-muted font-mono">
                    Individual route throughput, P95 tail latency, error rate, and health classification.
                  </CardDescription>
                </div>
                <span className="font-mono text-xs text-foreground-subtle">
                  {endpoints.length} active routes
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isEndpointsLoading ? (
                <div className="p-6 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : endpoints.length === 0 ? (
                <div className="p-8 text-center font-mono text-xs text-foreground-muted">
                  No active traffic recorded for endpoints in the selected {selectedRange} window. Run a load test or inject telemetry to record metrics.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle bg-surface-raised/40 text-[11px] text-foreground-subtle uppercase">
                        <th className="py-3 px-4 font-semibold">Endpoint Route</th>
                        <th className="py-3 px-4 font-semibold text-right">Volume</th>
                        <th className="py-3 px-4 font-semibold text-right">Throughput</th>
                        <th className="py-3 px-4 font-semibold text-right">P95 Latency</th>
                        <th className="py-3 px-4 font-semibold text-right">Error Rate</th>
                        <th className="py-3 px-4 font-semibold text-right">Health Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {endpoints.map((ep) => {
                        const health = (ep.health || "healthy").toLowerCase()
                        const badgeClass =
                          health === "healthy"
                            ? "text-success border-success/30 bg-success/10"
                            : health === "degraded"
                            ? "text-warning border-warning/30 bg-warning/10"
                            : health === "failing"
                            ? "text-danger border-danger/30 bg-danger/10"
                            : "text-foreground-muted border-border-subtle bg-surface-raised"

                        return (
                          <tr key={ep.endpoint_id} className="hover:bg-surface-raised/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-brand uppercase text-[11px]">{ep.method}</span>
                                <span className="text-foreground font-medium">{ep.path_template}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right text-foreground font-medium">
                              {ep.requests.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right text-foreground">
                              {ep.rps.toFixed(1)} RPS
                            </td>
                            <td className="py-3 px-4 text-right text-foreground">
                              {ep.p95.toFixed(1)}ms
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className={ep.error_rate > 0.05 ? "text-danger font-bold" : "text-foreground"}>
                                {(ep.error_rate * 100).toFixed(2)}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${badgeClass}`}>
                                {ep.health || "healthy"}
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
        </div>
      )}
    </div>
  )
}
