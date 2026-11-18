"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Plus, Play, ShieldCheck, Layers, ArrowRight } from "lucide-react"
import { api, type ApiResponse } from "@/lib/api-client"
import { useUIStore } from "@/lib/stores/ui-store"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import {
  KPIMetricCards,
  type MetricSummary,
} from "@/components/dashboard/kpi-metric-cards"
import { PerformanceChart } from "@/components/dashboard/performance-chart"
import { StatusCodeDistribution } from "@/components/dashboard/status-code-distribution"
import { LatestCapacityCard } from "@/components/dashboard/latest-capacity-card"
import {
  RecentRunsTable,
  type LoadTestSummary,
} from "@/components/dashboard/recent-runs-table"
import { LiveTicker } from "@/components/dashboard/live-ticker"

interface MetricsOverview {
  current: MetricSummary
  previous: MetricSummary
  window: string
}

export default function DashboardOverviewPage() {
  const { currentOrgId, currentProjectId } = useUIStore()

  // Query project metrics overview
  const { data: metricsResponse, isLoading: isMetricsLoading } =
    useQuery<ApiResponse<MetricsOverview> | null>({
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
  const { data: testsResponse, isLoading: isTestsLoading } =
    useQuery<ApiResponse<LoadTestSummary[]> | null>({
      queryKey: ["recent_tests", currentOrgId, currentProjectId],
      queryFn: async () => {
        if (!currentOrgId || !currentProjectId) return null
        return api.get<LoadTestSummary[]>(
          `/organizations/${currentOrgId}/projects/${currentProjectId}/load-tests?limit=5`
        )
      },
      enabled: Boolean(currentOrgId && currentProjectId),
    })

  const currentMetrics = metricsResponse?.data?.current
  const previousMetrics = metricsResponse?.data?.previous
  const recentTests = testsResponse?.data || []
  const latestCompletedTest = recentTests.find(
    (t) =>
      t.status === "completed" ||
      t.status === "stopped" ||
      t.status === "failed"
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Monitor live API throughput, latency percentiles, status codes, and capacity test runs."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              render={
                <Link
                  href={
                    currentProjectId
                      ? `/dashboard/projects/${currentProjectId}`
                      : "/dashboard/projects"
                  }
                />
              }
              className="gap-1.5 font-mono text-xs"
            >
              <ShieldCheck className="size-3.5 text-success" />
              <span>Project Cockpit</span>
            </Button>
            <Button
              size="sm"
              render={<Link href="/dashboard/runner" />}
              className="gap-1.5 bg-brand font-mono text-xs text-white hover:bg-brand-hover"
            >
              <Play className="size-3.5 fill-current" />
              <span>Run Load Test</span>
            </Button>
          </div>
        }
      >
        {currentOrgId && currentProjectId && (
          <div className="pt-1">
            <LiveTicker orgId={currentOrgId} projectId={currentProjectId} />
          </div>
        )}
      </PageHeader>

      {/* If no workspace or project selected */}
      {!currentOrgId || !currentProjectId ? (
        <EmptyState
          icon={<Layers className="size-6 text-sand" />}
          title="Select or Create a Workspace & Project"
          description="To view real-time API performance metrics, select an active workspace and target API project from the top bar."
          action={
            <Button
              render={<Link href="/dashboard/projects" />}
              className="bg-brand font-mono text-xs text-white hover:bg-brand-hover"
            >
              <Plus className="mr-1.5 size-3.5" />
              <span>Configure Projects</span>
            </Button>
          }
        />
      ) : (
        <>
          {/* KPI Metrics Row */}
          <KPIMetricCards
            current={currentMetrics}
            previous={previousMetrics}
            isLoading={isMetricsLoading}
          />

          {/* Main Dashboard Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left 2 Cols: Timeseries Chart & Recent Runs */}
            <div className="space-y-6 lg:col-span-2">
              <PerformanceChart
                orgId={currentOrgId}
                projectId={currentProjectId}
              />
              <RecentRunsTable tests={recentTests} isLoading={isTestsLoading} />
            </div>

            {/* Right Col: Capacity Analysis, Status Codes, and Readiness */}
            <div className="space-y-6">
              <LatestCapacityCard
                orgId={currentOrgId}
                projectId={currentProjectId}
                latestTestId={latestCompletedTest?.id}
              />

              <StatusCodeDistribution
                orgId={currentOrgId}
                projectId={currentProjectId}
              />

              {/* Getting Started Checklist */}
              <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
                <h3 className="font-heading text-sm font-semibold text-foreground">
                  Target Setup Readiness
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-surface-raised/40 p-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-xs text-success">
                      ✓
                    </span>
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        Target Registered
                      </p>
                      <p className="text-[11px] text-foreground-subtle">
                        API base URL configured in project.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-surface-raised/40 p-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sand/20 font-mono text-[10px] text-sand">
                      2
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground">
                        DNS TXT Verification
                      </p>
                      <p className="text-[11px] text-foreground-subtle">
                        Authorize load generation on host.
                      </p>
                    </div>
                    <Link
                      href={
                        currentProjectId
                          ? `/dashboard/projects/${currentProjectId}/verification`
                          : "/dashboard/projects"
                      }
                      className="flex items-center font-mono text-xs text-sand hover:underline"
                    >
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-surface-raised/40 p-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-[10px] text-foreground-subtle">
                      3
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground">
                        Discover Endpoints
                      </p>
                      <p className="text-[11px] text-foreground-subtle">
                        Import OpenAPI spec or sync routes.
                      </p>
                    </div>
                    <Link
                      href="/dashboard/discovery"
                      className="flex items-center font-mono text-xs text-foreground-muted hover:underline"
                    >
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
