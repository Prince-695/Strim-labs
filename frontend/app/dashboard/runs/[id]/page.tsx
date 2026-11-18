"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Activity,
  Square,
  Users,
  CheckCircle2,
  TrendingUp,
  BarChart2,
  ShieldAlert,
  AlertTriangle,
  Zap,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { ConnectionIndicator, type ConnectionState } from "@/components/ui/connection-indicator"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { loadtestApi, type LiveRequestLog, type LiveEndpointHealth } from "@/lib/loadtest-api"
import { tokenStorage, API_BASE_URL } from "@/lib/api-client"
import { useUIStore } from "@/lib/stores/ui-store"

import { LiveTrafficStreamTerminal } from "@/components/runs/live-traffic-stream-terminal"
import { LiveEndpointHealthMatrix } from "@/components/runs/live-endpoint-health-matrix"

interface SSETick {
  t: number
  offered_rps: number
  achieved_rps: number
  p50: number
  p95: number
  p99: number
  errors: number
  active: number
  total_requests: number
  recent_logs?: LiveRequestLog[]
  endpoint_health?: LiveEndpointHealth[]
}

export default function LiveTestCockpitPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const { currentOrgId, currentProjectId } = useUIStore()

  const testId = (params?.id as string) || ""

  // State
  const [ticks, setTicks] = React.useState<SSETick[]>([])
  const [logs, setLogs] = React.useState<LiveRequestLog[]>([])
  const [endpointHealth, setEndpointHealth] = React.useState<LiveEndpointHealth[]>([])
  const [connectionState, setConnectionState] = React.useState<ConnectionState>("reconnecting")
  const [liveStatus, setLiveStatus] = React.useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = React.useState<Date | undefined>(undefined)

  // 1. Fetch initial load test metadata
  const { data: testRes } = useQuery({
    queryKey: ["load_test_detail", currentOrgId, currentProjectId, testId],
    queryFn: () => loadtestApi.get(currentOrgId!, currentProjectId!, testId),
    enabled: Boolean(currentOrgId && currentProjectId && testId),
  })

  const test = testRes?.data
  const currentStatus = liveStatus || test?.status || "queued"
  const isRunning = currentStatus === "running"
  const isFinished = currentStatus === "completed" || currentStatus === "stopped" || currentStatus === "failed"

  // 2. Fetch completed results when test finishes (for First Bottleneck summary)
  const { data: resultsRes } = useQuery({
    queryKey: ["load_test_results", currentOrgId, currentProjectId, testId],
    queryFn: () => loadtestApi.getResults(currentOrgId!, currentProjectId!, testId),
    enabled: Boolean(currentOrgId && currentProjectId && testId && isFinished),
  })

  // 3. Stop Mutation
  const stopMutation = useMutation({
    mutationFn: () => loadtestApi.stop(currentOrgId!, currentProjectId!, testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["load_test_detail", currentOrgId, currentProjectId, testId] })
      setLiveStatus("stopped")
    },
  })

  // 4. SSE Connection for real-time stream
  React.useEffect(() => {
    if (!currentOrgId || !currentProjectId || !testId) return

    let eventSource: EventSource | null = null
    let isCancelled = false

    const token = tokenStorage.get()
    const url = new URL(
      `${API_BASE_URL.replace(/\/+$/, "")}/organizations/${currentOrgId}/projects/${currentProjectId}/load-tests/${testId}/progress`
    )
    if (token) {
      url.searchParams.append("token", token)
    }

    const connectTimer = setTimeout(() => {
      try {
        eventSource = new EventSource(url.toString(), { withCredentials: true })

        eventSource.onopen = () => {
          if (!isCancelled) {
            setConnectionState("connected")
          }
        }

        eventSource.addEventListener("snapshot", (e: MessageEvent) => {
          if (isCancelled) return
          try {
            const data = JSON.parse(e.data)
            if (data.status) setLiveStatus(data.status)
          } catch {}
        })

        eventSource.addEventListener("tick", (e: MessageEvent) => {
          if (isCancelled) return
          try {
            const tick: SSETick = JSON.parse(e.data)
            setTicks((prev) => [...prev.slice(-180), tick])
            setLastUpdated(new Date())
            setConnectionState("connected")

            // Feature 1: Listen for recent_logs array and prepend to scrolling feed (keep last 100 entries)
            if (Array.isArray(tick.recent_logs) && tick.recent_logs.length > 0) {
              setLogs((prev) => [...tick.recent_logs!, ...prev].slice(0, 100))
            }

            // Feature 1: Listen for endpoint_health breakdown and update live matrix
            if (Array.isArray(tick.endpoint_health) && tick.endpoint_health.length > 0) {
              setEndpointHealth(tick.endpoint_health)
            }
          } catch {}
        })

        eventSource.addEventListener("status", (e: MessageEvent) => {
          if (isCancelled) return
          try {
            const data = JSON.parse(e.data)
            if (data.status) {
              setLiveStatus(data.status)
              if (data.status === "completed" || data.status === "stopped" || data.status === "failed") {
                setConnectionState("disconnected")
                queryClient.invalidateQueries({
                  queryKey: ["load_test_results", currentOrgId, currentProjectId, testId],
                })
              }
            }
          } catch {}
        })

        eventSource.addEventListener("end", () => {
          if (!isCancelled) {
            setConnectionState("disconnected")
            eventSource?.close()
          }
        })

        eventSource.onerror = () => {
          if (isCancelled) return
          setConnectionState("stale")
        }
      } catch {
        if (!isCancelled) {
          setConnectionState("disconnected")
        }
      }
    }, 0)

    return () => {
      isCancelled = true
      clearTimeout(connectTimer)
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
    }
  }, [currentOrgId, currentProjectId, testId, queryClient])

  const latestTick = ticks[ticks.length - 1]
  const currentRPS = latestTick ? latestTick.achieved_rps : test?.summary?.achieved_avg_rps || 0
  const currentP95 = latestTick ? latestTick.p95 : test?.summary?.p95_ms || 0
  const currentErrors = latestTick ? latestTick.errors : test?.summary?.error_count || 0
  const currentActiveVUs = latestTick ? latestTick.active : 0
  const totalRequests = latestTick ? latestTick.total_requests : test?.summary?.total_requests || 0

  // Feature 1: Completed Results Summary - First Bottleneck Detected
  const bottleneck =
    resultsRes?.data?.summary?.first_bottleneck || test?.summary?.first_bottleneck

  // SVG Chart Dimensions
  const svgWidth = 720
  const svgHeight = 200
  const padding = { top: 20, right: 20, bottom: 30, left: 45 }
  const chartWidth = svgWidth - padding.left - padding.right
  const chartHeight = svgHeight - padding.top - padding.bottom

  const maxRPSValue = Math.max(10, ...ticks.map((t) => t.achieved_rps)) * 1.15

  const rpsPathD = ticks.reduce((acc, tick, idx) => {
    const x = padding.left + (idx / Math.max(1, ticks.length - 1)) * chartWidth
    const y = padding.top + chartHeight - (tick.achieved_rps / maxRPSValue) * chartHeight
    return `${acc} ${idx === 0 ? "M" : "L"} ${x} ${y}`
  }, "")

  const defaultTarget = test?.config?.targets?.[0]
    ? { method: test.config.targets[0].method, path: test.config.targets[0].path }
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title={test?.name || "Live Test Cockpit"}
        description={
          test
            ? `${test.profile.toUpperCase()} test execution • ${
                test.config?.targets?.[0]
                  ? `${test.config.targets[0].method} ${test.config.targets[0].path}`
                  : "Full Server Target"
              }`
            : "Real-time load test metrics stream and latency curve monitoring"
        }
        breadcrumbs={[
          { label: "Test History", href: "/dashboard/tests" },
          { label: test?.name || "Cockpit" },
        ]}
        actions={
          <div className="flex items-center gap-2.5">
            {isRunning ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
                className="gap-1.5 font-mono text-xs"
              >
                <Square className="size-3.5 fill-current" />
                <span>Abort Test Execution</span>
              </Button>
            ) : (
              <Link
                href={`/dashboard/capacity?testId=${testId}`}
                className={buttonVariants({
                  className: "gap-1.5 bg-brand text-white hover:bg-brand-hover text-xs font-mono",
                })}
              >
                <BarChart2 className="size-3.5" />
                <span>View Capacity Analysis</span>
              </Link>
            )}
          </div>
        }
      >
        <div className="flex items-center justify-between pt-1 font-mono text-xs">
          <div className="flex items-center gap-3">
            <StatusBadge status={currentStatus} />
            <ConnectionIndicator state={connectionState} lastUpdated={lastUpdated} />
          </div>
          <span className="text-foreground-subtle hidden sm:inline">
            Telemetry Feed: /load-tests/{testId.slice(0, 8)}/progress
          </span>
        </div>
      </PageHeader>

      {/* Feature 1.3: Completed Results Summary - First Bottleneck Detected Callout Box */}
      {bottleneck && (
        <div className="relative rounded-xl border border-danger/50 bg-danger/10 p-5 shadow-lg overflow-hidden font-mono">
          <CornerCrosshairs />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="size-9 rounded-lg bg-danger/20 border border-danger/40 flex items-center justify-center text-danger shrink-0 mt-0.5">
                <AlertTriangle className="size-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-bold text-sm text-foreground">
                    First Bottleneck Detected
                  </h3>
                  <span className="rounded bg-danger/25 border border-danger/40 px-2 py-0.5 text-[10px] text-danger font-bold uppercase">
                    SLO Knee Reached
                  </span>
                </div>
                <p className="text-xs text-sand leading-relaxed">
                  <strong className="text-foreground">
                    {bottleneck.method} {bottleneck.path}
                  </strong>{" "}
                  broke at{" "}
                  <strong className="text-danger font-bold">
                    {bottleneck.broke_at_rps.toFixed(0)} RPS
                  </strong>{" "}
                  (p95: <strong className="text-foreground">{bottleneck.p95_latency_ms.toFixed(1)}ms</strong>, error:{" "}
                  <strong className="text-danger">{(bottleneck.error_rate * 100).toFixed(1)}%</strong>).
                  {bottleneck.reason && (
                    <span className="block text-[11px] text-foreground-muted mt-1">
                      Reason: {bottleneck.reason}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="sm:self-center shrink-0">
              <Link
                href={`/dashboard/capacity?testId=${testId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 bg-surface px-3 py-1.5 text-xs text-danger font-semibold hover:bg-danger/10 transition-colors"
              >
                <Zap className="size-3.5" />
                <span>Full Capacity Diagnostics</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Real-time KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 font-mono">
        {/* Achieved Throughput */}
        <Card className="border-border bg-surface p-4 space-y-1 shadow-xs">
          <div className="flex justify-between items-center text-foreground-subtle text-xs">
            <span>Throughput (RPS)</span>
            <Activity className="size-3.5 text-brand" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {currentRPS.toFixed(1)} <span className="text-xs font-normal text-sand">req/s</span>
          </p>
          <p className="text-[10px] text-foreground-subtle">
            {latestTick ? `Offered: ${latestTick.offered_rps.toFixed(1)} RPS` : "Active throughput"}
          </p>
        </Card>

        {/* P95 Tail Latency */}
        <Card className="border-border bg-surface p-4 space-y-1 shadow-xs">
          <div className="flex justify-between items-center text-foreground-subtle text-xs">
            <span>P95 Tail Latency</span>
            <TrendingUp className="size-3.5 text-warning" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {currentP95.toFixed(1)} <span className="text-xs font-normal text-sand">ms</span>
          </p>
          <p className="text-[10px] text-foreground-subtle">
            {latestTick ? `P50: ${latestTick.p50.toFixed(1)}ms | P99: ${latestTick.p99.toFixed(1)}ms` : "Tail latency"}
          </p>
        </Card>

        {/* Active Virtual Users */}
        <Card className="border-border bg-surface p-4 space-y-1 shadow-xs">
          <div className="flex justify-between items-center text-foreground-subtle text-xs">
            <span>Virtual Users</span>
            <Users className="size-3.5 text-sand" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {currentActiveVUs} <span className="text-xs font-normal text-sand">VUs</span>
          </p>
          <p className="text-[10px] text-foreground-subtle">
            Limit: {test?.config?.max_virtual_users || 50} concurrent runners
          </p>
        </Card>

        {/* Errors / Status */}
        <Card className="border-border bg-surface p-4 space-y-1 shadow-xs">
          <div className="flex justify-between items-center text-foreground-subtle text-xs">
            <span>Total Errors</span>
            <ShieldAlert className="size-3.5 text-danger" />
          </div>
          <p className={`text-2xl font-bold ${currentErrors > 0 ? "text-danger" : "text-foreground"}`}>
            {currentErrors.toLocaleString()}
          </p>
          <p className="text-[10px] text-foreground-subtle">
            Volume: {totalRequests.toLocaleString()} requests dispatched
          </p>
        </Card>
      </div>

      {/* Feature 1.1 & 1.2: Live Traffic Stream Terminal + Per-API Health Console Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Terminal Log Stream Feed (7 cols) */}
        <div className="lg:col-span-7">
          <LiveTrafficStreamTerminal
            logs={logs}
            isRunning={isRunning}
            activeRps={currentRPS}
            totalRequests={totalRequests}
          />
        </div>

        {/* Real-Time Per-API Health Matrix (5 cols) */}
        <div className="lg:col-span-5">
          <LiveEndpointHealthMatrix
            endpointHealth={endpointHealth}
            defaultTarget={defaultTarget}
            isRunning={isRunning}
          />
        </div>
      </div>

      {/* Live Timeseries Chart */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border-subtle">
          <div>
            <CardTitle className="text-sm font-semibold font-heading text-foreground">
              Execution Throughput Curve
            </CardTitle>
            <CardDescription className="text-xs text-foreground-muted font-mono">
              Real-time achieved throughput stream (1-second tick resolution)
            </CardDescription>
          </div>

          <div className="flex items-center gap-4 font-mono text-xs">
            <div className="flex items-center gap-1.5 text-brand">
              <span className="size-2 rounded-full bg-brand" />
              <span>Achieved RPS</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {ticks.length === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center text-center font-mono text-xs border border-dashed border-border-subtle rounded-lg">
              {isRunning ? (
                <>
                  <Activity className="size-6 text-brand animate-pulse mb-2" />
                  <p className="text-foreground">Connecting to Live SSE Stream...</p>
                  <p className="text-foreground-subtle text-[11px] mt-1">
                    Waiting for first second telemetry tick from runner nodes.
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-6 text-success mb-2" />
                  <p className="text-foreground">Test Execution Completed</p>
                  <p className="text-foreground-subtle text-[11px] mt-1">
                    Inspect the summary card or capacity analysis report for detailed metrics.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="relative w-full overflow-hidden">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible select-none">
                {/* Horizontal Gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                  const y = padding.top + chartHeight * pct
                  const val = maxRPSValue - pct * maxRPSValue
                  return (
                    <g key={pct}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={svgWidth - padding.right}
                        y2={y}
                        stroke="var(--border-subtle)"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />
                      <text
                        x={padding.left - 8}
                        y={y + 4}
                        fill="var(--foreground-subtle)"
                        fontSize="9"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {val.toFixed(0)}
                      </text>
                    </g>
                  )
                })}

                {/* Achieved RPS Curve */}
                <path
                  d={rpsPathD}
                  fill="none"
                  stroke="var(--brand)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <div className="flex justify-between items-center pt-2 font-mono text-[10px] text-foreground-subtle border-t border-border-subtle/50">
                <span>Start: t=0s</span>
                <span>Latest: t={latestTick?.t || ticks.length}s</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
