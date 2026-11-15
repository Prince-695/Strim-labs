"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  Rocket,
  Plus,
  Play,
  TrendingUp,
  Activity,
  AlertCircle,
  Clock,
  ShieldCheck,
  ArrowUpRight,
  Layers,
} from "lucide-react"
import { api, type ApiResponse } from "@/lib/api-client"
import { useUIStore } from "@/lib/stores/ui-store"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"

interface MetricsOverview {
  current: {
    rps: number
    requests: number
    p95: number
    p99: number
    error_rate: number
  }
  previous?: {
    rps: number
    requests: number
    p95: number
    p99: number
    error_rate: number
  }
}

interface LoadTestSummary {
  id: string
  name: string
  status: string
  profile: string
  model: string
  created_at: string
  config: {
    peak_rate: number
    duration_seconds: number
  }
}

export default function DashboardOverviewPage() {
  const { currentOrgId, currentProjectId } = useUIStore()

  // Query project metrics overview
  const {
    data: metricsResponse,
    isLoading: isMetricsLoading,
  } = useQuery<ApiResponse<MetricsOverview> | null>({
    queryKey: ["metrics_overview", currentOrgId, currentProjectId],
    queryFn: async () => {
      if (!currentOrgId || !currentProjectId) return null
      return api.get<MetricsOverview>(
        `/organizations/${currentOrgId}/projects/${currentProjectId}/metrics/overview?range=1h`
      )
    },
    enabled: Boolean(currentOrgId && currentProjectId),
  })

  // Query recent load tests
  const {
    data: testsResponse,
    isLoading: isTestsLoading,
  } = useQuery<ApiResponse<LoadTestSummary[]> | null>({
    queryKey: ["recent_tests", currentOrgId, currentProjectId],
    queryFn: async () => {
      if (!currentOrgId || !currentProjectId) return null
      return api.get<LoadTestSummary[]>(
        `/organizations/${currentOrgId}/projects/${currentProjectId}/load-tests?limit=5`
      )
    },
    enabled: Boolean(currentOrgId && currentProjectId),
  })

  const metrics = metricsResponse?.data?.current
  const recentTests = testsResponse?.data || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Monitor live API throughput, latency percentiles, and recent capacity test runs."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/dashboard/targets" />}
              className="gap-1.5 text-xs"
            >
              <ShieldCheck className="size-3.5 text-success" />
              <span>Verify Target</span>
            </Button>
            <Button
              size="sm"
              render={<Link href="/dashboard/runner" />}
              className="gap-1.5 bg-brand text-white hover:bg-brand-hover text-xs"
            >
              <Play className="size-3.5 fill-current" />
              <span>Run Load Test</span>
            </Button>
          </div>
        }
      />

      {/* If no workspace or project selected */}
      {!currentOrgId || !currentProjectId ? (
        <EmptyState
          icon={<Layers className="size-6 text-sand" />}
          title="Select or Create a Workspace & Project"
          description="To view real-time API performance metrics, select an active workspace and target API project from the top bar."
          action={
            <Button
              render={<Link href="/dashboard/projects" />}
              className="bg-brand text-white hover:bg-brand-hover text-xs"
            >
              <Plus className="mr-1.5 size-3.5" />
              <span>Configure Projects</span>
            </Button>
          }
        />
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Throughput */}
            <Card className="border-border bg-surface shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-mono font-medium text-foreground-muted">
                  THROUGHPUT
                </CardTitle>
                <Activity className="size-4 text-brand" />
              </CardHeader>
              <CardContent>
                {isMetricsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : metrics ? (
                  <div className="space-y-1">
                    <div className="text-2xl font-bold font-mono text-foreground">
                      {metrics.rps.toFixed(1)} <span className="text-xs font-normal text-foreground-subtle">RPS</span>
                    </div>
                    <p className="text-[11px] font-mono text-foreground-subtle">
                      Total: {metrics.requests.toLocaleString()} reqs (1h)
                    </p>
                  </div>
                ) : (
                  <div className="text-2xl font-bold font-mono text-foreground-subtle">—</div>
                )}
              </CardContent>
            </Card>

            {/* P95 Latency */}
            <Card className="border-border bg-surface shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-mono font-medium text-foreground-muted">
                  P95 LATENCY
                </CardTitle>
                <Clock className="size-4 text-warning" />
              </CardHeader>
              <CardContent>
                {isMetricsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : metrics ? (
                  <div className="space-y-1">
                    <div className="text-2xl font-bold font-mono text-foreground">
                      {metrics.p95.toFixed(1)} <span className="text-xs font-normal text-foreground-subtle">ms</span>
                    </div>
                    <p className="text-[11px] font-mono text-foreground-subtle">
                      P99: {metrics.p99.toFixed(1)} ms
                    </p>
                  </div>
                ) : (
                  <div className="text-2xl font-bold font-mono text-foreground-subtle">—</div>
                )}
              </CardContent>
            </Card>

            {/* Error Rate */}
            <Card className="border-border bg-surface shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-mono font-medium text-foreground-muted">
                  ERROR RATE
                </CardTitle>
                <AlertCircle className="size-4 text-danger" />
              </CardHeader>
              <CardContent>
                {isMetricsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : metrics ? (
                  <div className="space-y-1">
                    <div className="text-2xl font-bold font-mono text-foreground">
                      {(metrics.error_rate * 100).toFixed(2)}%
                    </div>
                    <p className="text-[11px] font-mono text-foreground-subtle">
                      Status: {metrics.error_rate < 0.01 ? "Healthy" : "Elevated"}
                    </p>
                  </div>
                ) : (
                  <div className="text-2xl font-bold font-mono text-foreground-subtle">—</div>
                )}
              </CardContent>
            </Card>

            {/* Capacity Status */}
            <Card className="border-border bg-surface shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-mono font-medium text-foreground-muted">
                  CAPACITY HEALTH
                </CardTitle>
                <TrendingUp className="size-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="text-lg font-bold font-mono text-foreground">
                    <StatusBadge status="healthy" size="sm" />
                  </div>
                  <p className="text-[11px] text-foreground-subtle">
                    Sustained capacity verified
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Grid: Recent Runs & Quick Actions */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left 2 Cols: Recent Runs Table */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold font-mono tracking-tight text-foreground uppercase">
                  Recent Test Runs
                </h3>
                <Link
                  href="/dashboard/tests"
                  className="flex items-center gap-1 text-xs text-brand hover:underline font-mono"
                >
                  <span>View all</span>
                  <ArrowUpRight className="size-3" />
                </Link>
              </div>

              <Card className="border-border bg-surface">
                <CardContent className="p-0">
                  {isTestsLoading ? (
                    <div className="p-6 space-y-3">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : recentTests.length > 0 ? (
                    <div className="divide-y divide-border-subtle">
                      {recentTests.map((test) => (
                        <div
                          key={test.id}
                          className="flex items-center justify-between p-4 hover:bg-surface-raised/40 transition-colors"
                        >
                          <div className="flex items-center gap-3 truncate">
                            <Rocket className="size-4 text-brand shrink-0" />
                            <div className="truncate">
                              <Link
                                href={`/dashboard/tests/${test.id}`}
                                className="text-xs font-medium text-foreground hover:text-brand truncate block"
                              >
                                {test.name}
                              </Link>
                              <div className="flex items-center gap-2 mt-0.5 font-mono text-[10px] text-foreground-subtle">
                                <span>Profile: {test.profile}</span>
                                <span>•</span>
                                <span>Target: {test.config.peak_rate} RPS</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <StatusBadge status={test.status} size="sm" />
                            <Button
                              variant="ghost"
                              size="xs"
                              render={<Link href={`/dashboard/tests/${test.id}`} />}
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-sm text-foreground-muted">
                        No load test runs recorded yet for this project.
                      </p>
                      <Button
                        size="sm"
                        render={<Link href="/dashboard/runner" />}
                        className="mt-4 bg-brand text-white hover:bg-brand-hover text-xs"
                      >
                        <Play className="mr-1.5 size-3 fill-current" />
                        <span>Launch First Test</span>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Col: Setup Checklist / Quick Shortcuts */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold font-mono tracking-tight text-foreground uppercase">
                Getting Started
              </h3>

              <Card className="border-border bg-surface space-y-3 p-5">
                <CardHeader className="p-0">
                  <CardTitle className="text-sm font-medium text-foreground">
                    Project Readiness
                  </CardTitle>
                  <CardDescription className="text-xs text-foreground-muted">
                    Complete these steps to prepare your API for breaking point analysis.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 space-y-3 pt-2">
                  <div className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface-raised/50 p-2.5">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
                      ✓
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">Target Registered</p>
                      <p className="text-[11px] text-foreground-subtle">
                        API base URL configured.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface-raised/50 p-2.5">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sand/20 text-sand font-mono text-[10px]">
                      2
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">Verify Domain Ownership</p>
                      <p className="text-[11px] text-foreground-subtle">
                        Add DNS TXT record for security verification.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface-raised/50 p-2.5">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface text-foreground-subtle font-mono text-[10px]">
                      3
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">Discover Endpoints</p>
                      <p className="text-[11px] text-foreground-subtle">
                        Import OpenAPI spec or sync via manifest.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
