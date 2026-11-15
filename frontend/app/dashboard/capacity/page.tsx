"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Gauge,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Loader2,
  SlidersHorizontal
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { loadtestApi } from "@/lib/loadtest-api"
import { useUIStore } from "@/lib/stores/ui-store"

function CapacityReportContent() {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { currentOrgId, currentProjectId } = useUIStore()

  const testIdParam = searchParams.get("testId")

  // 1. Fetch Tests list to populate test selector
  const { data: testsRes } = useQuery({
    queryKey: ["load_tests_list", currentOrgId, currentProjectId],
    queryFn: () => loadtestApi.list(currentOrgId!, currentProjectId!),
    enabled: Boolean(currentOrgId && currentProjectId),
  })

  const tests = testsRes?.data || []
  const completedTests = tests.filter((t) => t.status === "completed" || t.status === "stopped")
  const activeTestId = testIdParam || completedTests[0]?.id || ""

  // 2. Fetch Capacity Report for active test
  const { data: capacityRes, isLoading } = useQuery({
    queryKey: ["capacity_report", currentOrgId, currentProjectId, activeTestId],
    queryFn: () => loadtestApi.getCapacity(currentOrgId!, currentProjectId!, activeTestId),
    enabled: Boolean(currentOrgId && currentProjectId && activeTestId),
  })

  // 3. Recompute thresholds mutation
  const [maxP95Threshold, setMaxP95Threshold] = React.useState(350)
  const [maxErrorThreshold, setMaxErrorThreshold] = React.useState(0.05)

  const recomputeMutation = useMutation({
    mutationFn: () =>
      loadtestApi.recomputeCapacity(currentOrgId!, currentProjectId!, activeTestId, {
        thresholds: {
          max_p95_ms: maxP95Threshold,
          max_error_rate: maxErrorThreshold,
        },
        save: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["capacity_report", currentOrgId, currentProjectId, activeTestId],
      })
    },
  })

  const report = capacityRes?.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capacity Analysis & Breaking Point"
        description="Algorithmic latency knee inflection, maximum sustainable throughput bounds, and primary bottleneck diagnoses."
        actions={
          activeTestId ? (
            <Link
              href={`/dashboard/compare?baseline=${activeTestId}`}
              className={buttonVariants({
                variant: "outline",
                className: "text-xs font-mono gap-1.5",
              })}
            >
              <span>Compare in Regression Studio</span>
              <ArrowRight className="size-3.5" />
            </Link>
          ) : undefined
        }
      />

      {/* Test Selector Dropdown */}
      <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
        <span className="text-foreground-subtle uppercase">Analyzed Test Run:</span>
        <select
          value={activeTestId}
          onChange={(e) => {
            const newId = e.target.value
            window.location.search = `?testId=${newId}`
          }}
          className="rounded-md border border-border-subtle bg-surface-raised px-3 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:border-brand"
        >
          {completedTests.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({new Date(t.created_at).toLocaleDateString()})
            </option>
          ))}
        </select>
      </div>

      {!activeTestId ? (
        <EmptyState
          icon={<Gauge className="size-6 text-sand" />}
          title="No Completed Test Runs"
          description="Execute a progressive ramp-up or step load test to generate an algorithmic capacity analysis report."
          action={
            <Link
              href="/dashboard/runner"
              className={buttonVariants({
                className: "bg-brand text-white hover:bg-brand-hover text-xs font-mono",
              })}
            >
              <span>Launch Capacity Test</span>
            </Link>
          }
        />
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      ) : !report ? (
        <Card className="border-border bg-surface p-8 text-center font-mono text-xs text-foreground-muted space-y-3">
          <AlertTriangle className="size-6 text-warning mx-auto" />
          <p className="text-foreground font-semibold">Capacity Report Not Computed</p>
          <p className="max-w-md mx-auto text-foreground-subtle">
            The runner has not synthesized capacity bounds for this run yet, or the test was terminated before steady-state windows could be established.
          </p>
          <Button
            onClick={() => recomputeMutation.mutate()}
            disabled={recomputeMutation.isPending}
            className="bg-brand text-white text-xs font-mono gap-1.5 mx-auto"
          >
            {recomputeMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            <span>Trigger Algorithmic Knee Computation</span>
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Executive Verdict Banner */}
          <Card className="border-border bg-surface">
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-mono text-[10px] uppercase text-foreground-subtle tracking-wider">
                    Executive Capacity Verdict
                  </span>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-heading font-bold text-foreground">
                      {report.breaking_point_rps ? "Breaking Point Identified" : "Capacity Limit Not Reached"}
                    </h2>
                    <span className="rounded bg-surface-raised px-2.5 py-0.5 font-mono text-xs uppercase text-sand border border-border-subtle">
                      Confidence: {report.confidence}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-foreground-muted max-w-xl leading-relaxed">
                    {report.note || "System sustained offered load within defined latency SLAs and error rate thresholds."}
                  </p>
                </div>

                <div className="text-right font-mono">
                  <span className="text-[11px] text-foreground-subtle uppercase">Sustainable Ceiling</span>
                  <p className="text-3xl font-bold text-brand">
                    {report.sustainable_rps ? `${report.sustainable_rps.toFixed(1)}` : "—"}{" "}
                    <span className="text-sm font-normal text-sand">RPS</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3 Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-3 font-mono">
            {/* Max Sustainable Throughput */}
            <Card className="border-border bg-surface p-5 space-y-1 shadow-xs">
              <span className="text-[11px] text-foreground-subtle uppercase">Max Sustainable Throughput</span>
              <p className="text-2xl font-bold text-success">
                {report.sustainable_rps ? `${report.sustainable_rps.toFixed(1)} RPS` : "—"}
              </p>
              <p className="text-[10px] text-foreground-muted">Safe continuous operational throughput</p>
            </Card>

            {/* Breaking Point */}
            <Card className="border-border bg-surface p-5 space-y-1 shadow-xs">
              <span className="text-[11px] text-foreground-subtle uppercase">Inflection Breaking Point</span>
              <p className="text-2xl font-bold text-danger">
                {report.breaking_point_rps ? `${report.breaking_point_rps.toFixed(1)} RPS` : "None Detected"}
              </p>
              <p className="text-[10px] text-foreground-muted">
                Bottleneck: <strong className="text-sand">{report.breaking_reason || "None"}</strong>
              </p>
            </Card>

            {/* Baseline Latency */}
            <Card className="border-border bg-surface p-5 space-y-1 shadow-xs">
              <span className="text-[11px] text-foreground-subtle uppercase">Baseline P95 Tail Latency</span>
              <p className="text-2xl font-bold text-foreground">
                {report.baseline_p95_ms ? `${report.baseline_p95_ms.toFixed(1)}ms` : "—"}
              </p>
              <p className="text-[10px] text-foreground-muted">Observed latency during low concurrency</p>
            </Card>
          </div>

          {/* Recompute Thresholds Adjuster Card */}
          <Card className="border-border bg-surface shadow-xs">
            <CardHeader className="pb-3 border-b border-border-subtle">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold font-heading text-foreground">
                    SLA Threshold Tuning & Knee Recomputation
                  </CardTitle>
                  <CardDescription className="text-xs text-foreground-muted font-mono">
                    Adjust latency and error tolerances to re-evaluate the breaking point verdict.
                  </CardDescription>
                </div>
                <SlidersHorizontal className="size-4 text-brand" />
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Max Acceptable P95 Latency</span>
                    <span className="font-bold text-sand">{maxP95Threshold}ms</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={1000}
                    step={25}
                    value={maxP95Threshold}
                    onChange={(e) => setMaxP95Threshold(Number(e.target.value))}
                    className="w-full accent-brand cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Max Tolerable Error Rate</span>
                    <span className="font-bold text-sand">{(maxErrorThreshold * 100).toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.01}
                    max={0.20}
                    step={0.01}
                    value={maxErrorThreshold}
                    onChange={(e) => setMaxErrorThreshold(Number(e.target.value))}
                    className="w-full accent-sand cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => recomputeMutation.mutate()}
                  disabled={recomputeMutation.isPending}
                  className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5"
                >
                  {recomputeMutation.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Recomputing Knee Points...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-3.5" />
                      <span>Re-Analyze with Custom Thresholds</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function CapacityPage() {
  return (
    <React.Suspense fallback={<div className="font-mono text-xs p-6 text-foreground-muted">Loading capacity report...</div>}>
      <CapacityReportContent />
    </React.Suspense>
  )
}
