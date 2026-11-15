"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  GitCompare,
} from "lucide-react"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { loadtestApi, type CompareSummary, type CompareDelta } from "@/lib/loadtest-api"
import { useUIStore } from "@/lib/stores/ui-store"

const COLORS = ["#2F6BFF", "#E6AD55", "#35B779", "#EF6464", "#A855F7"]

function CompareContent() {
  const searchParams = useSearchParams()
  const { currentOrgId, currentProjectId } = useUIStore()

  const baselineParam = searchParams.get("baseline")

  // 1. Fetch Tests List to select runs
  const { data: testsRes } = useQuery({
    queryKey: ["load_tests_list", currentOrgId, currentProjectId],
    queryFn: () => loadtestApi.list(currentOrgId!, currentProjectId!),
    enabled: Boolean(currentOrgId && currentProjectId),
  })

  const tests = testsRes?.data || []
  const completedTests = React.useMemo(
    () => tests.filter((t) => t.status === "completed" || t.status === "stopped"),
    [tests]
  )

  const [userSelectedIds, setUserSelectedIds] = React.useState<string[]>([])
  const [userBaselineId, setUserBaselineId] = React.useState<string>(baselineParam || "")

  // Determine active test IDs and baseline
  const activeSelectedIds = React.useMemo(() => {
    if (userSelectedIds.length > 0) return userSelectedIds
    return completedTests.slice(0, 2).map((t) => t.id)
  }, [userSelectedIds, completedTests])

  const activeBaselineId = userBaselineId || activeSelectedIds[0] || ""

  // 2. Fetch Comparison Query
  const { data: compareRes, isLoading: isComparing } = useQuery({
    queryKey: ["compare_tests", currentOrgId, currentProjectId, activeSelectedIds, activeBaselineId],
    queryFn: () =>
      loadtestApi.compare(currentOrgId!, currentProjectId!, {
        test_ids: activeSelectedIds,
        baseline_id: activeBaselineId || undefined,
      }),
    enabled: Boolean(currentOrgId && currentProjectId && activeSelectedIds.length >= 2),
  })

  const compareData = compareRes?.data

  const toggleTestSelection = (testId: string) => {
    if (activeSelectedIds.includes(testId)) {
      if (activeSelectedIds.length <= 2) return // keep at least 2
      const updated = activeSelectedIds.filter((id) => id !== testId)
      setUserSelectedIds(updated)
      if (activeBaselineId === testId) {
        setUserBaselineId(updated[0] || "")
      }
    } else {
      if (activeSelectedIds.length >= 5) return // max 5
      setUserSelectedIds([...activeSelectedIds, testId])
    }
  }

  // SVG Chart Dimensions
  const svgWidth = 720
  const svgHeight = 240
  const padding = { top: 20, right: 20, bottom: 30, left: 45 }
  const chartWidth = svgWidth - padding.left - padding.right
  const chartHeight = svgHeight - padding.top - padding.bottom

  const overlaySeries = compareData?.overlay?.series || []
  const maxRPS = Math.max(
    10,
    ...overlaySeries.flatMap((s) => s.points.map((p) => p.achieved_rps))
  ) * 1.15

  const maxT = Math.max(
    1,
    ...overlaySeries.flatMap((s) => s.points.map((p) => p.t))
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Regression Studio"
        description="Side-by-side run comparison against historical baselines, throughput variance, and latency regression verdicts."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Regression Studio" },
        ]}
      />

      {/* Select Runs Bar */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="pb-3 border-b border-border-subtle">
          <CardTitle className="text-sm font-semibold font-heading text-foreground">
            Select 2 to 5 Test Runs to Compare
          </CardTitle>
          <CardDescription className="text-xs text-foreground-muted font-mono">
            Check runs below and designate one as the Baseline reference.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-3 font-mono text-xs">
          {completedTests.length < 2 ? (
            <p className="text-foreground-subtle py-2">
              At least 2 completed load tests are required to perform regression comparisons.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {completedTests.map((t) => {
                const isSelected = activeSelectedIds.includes(t.id)
                const isBaseline = activeBaselineId === t.id

                return (
                  <div
                    key={t.id}
                    onClick={() => toggleTestSelection(t.id)}
                    className={`cursor-pointer rounded-lg border px-3 py-2 transition-all flex items-center gap-2.5 ${
                      isSelected
                        ? "border-brand bg-brand/10 text-white"
                        : "border-border-subtle bg-surface-raised text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="size-3.5 rounded border-border-subtle bg-surface text-brand focus:ring-0"
                    />
                    <div>
                      <span className="font-semibold block">{t.name}</span>
                      <span className="text-[10px] text-foreground-subtle block">
                        {new Date(t.created_at).toLocaleDateString()} • {t.profile}
                      </span>
                    </div>

                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setUserBaselineId(t.id)
                        }}
                        className={`rounded px-1.5 py-0.5 text-[9px] uppercase font-bold border transition-colors ${
                          isBaseline
                            ? "bg-sand text-black border-sand"
                            : "bg-surface text-foreground-subtle border-border-subtle hover:text-foreground"
                        }`}
                      >
                        {isBaseline ? "Baseline" : "Set Baseline"}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {isComparing ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !compareData ? (
        <EmptyState
          icon={<GitCompare className="size-6 text-sand" />}
          title="Select Runs to Generate Comparison"
          description="Choose at least 2 completed runs to visualize performance variance."
        />
      ) : (
        <div className="space-y-6">
          {/* Comparison Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {compareData.tests.map((testSummary: CompareSummary, idx: number) => {
              const delta = compareData.deltas.find((d: CompareDelta) => d.test_id === testSummary.id)
              const isBaseline = testSummary.id === compareData.baseline_id
              const color = COLORS[idx % COLORS.length]

              return (
                <Card
                  key={testSummary.id}
                  className="border-border bg-surface p-5 space-y-4 font-mono text-xs shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <h4 className="font-bold font-heading text-sm text-foreground">
                          {testSummary.name}
                        </h4>
                      </div>
                      <span className="text-[10px] text-foreground-subtle">{testSummary.id.slice(0, 8)}...</span>
                    </div>

                    {isBaseline ? (
                      <span className="rounded bg-sand/20 px-2 py-0.5 text-[10px] font-bold text-sand uppercase border border-sand/30">
                        Baseline Reference
                      </span>
                    ) : delta ? (
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${
                          delta.verdict === "improved"
                            ? "bg-success/20 text-success border-success/30"
                            : delta.verdict === "regressed"
                            ? "bg-danger/20 text-danger border-danger/30"
                            : "bg-surface-raised text-foreground-muted border-border-subtle"
                        }`}
                      >
                        {delta.verdict}
                      </span>
                    ) : null}
                  </div>

                  {/* Core Metrics */}
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border-subtle/50">
                    <div>
                      <span className="text-[10px] text-foreground-subtle uppercase">Avg Throughput</span>
                      <p className="text-sm font-bold text-foreground">
                        {testSummary.avg_rps.toFixed(1)} RPS
                      </p>
                      {!isBaseline && delta && (
                        <span className={`text-[10px] ${delta.avg_rps_pct >= 0 ? "text-success" : "text-danger"}`}>
                          {delta.avg_rps_pct >= 0 ? "+" : ""}{delta.avg_rps_pct.toFixed(1)}%
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-foreground-subtle uppercase">P95 Tail Latency</span>
                      <p className="text-sm font-bold text-foreground">
                        {testSummary.p95_ms.toFixed(1)}ms
                      </p>
                      {!isBaseline && delta && (
                        <span className={`text-[10px] ${delta.p95_pct <= 0 ? "text-success" : "text-danger"}`}>
                          {delta.p95_pct >= 0 ? "+" : ""}{delta.p95_pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Synchronized Multi-Series Overlay Chart */}
          <Card className="border-border bg-surface shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border-subtle">
              <div>
                <CardTitle className="text-sm font-semibold font-heading text-foreground">
                  Synchronized Multi-Run Throughput Curves
                </CardTitle>
                <CardDescription className="text-xs text-foreground-muted font-mono">
                  Superimposed achieved RPS over elapsed test timeline
                </CardDescription>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                {overlaySeries.map((s, idx) => (
                  <div key={s.test_id} className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-foreground-muted">{s.name}</span>
                  </div>
                ))}
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="relative w-full overflow-hidden">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-auto overflow-visible select-none"
                >
                  {/* Gridlines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                    const y = padding.top + chartHeight * pct
                    const val = maxRPS - pct * maxRPS
                    return (
                      <g key={pct}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={svgWidth - padding.right}
                          y2={y}
                          stroke="#34342F"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x={padding.left - 8}
                          y={y + 4}
                          fill="#77766F"
                          fontSize="9"
                          fontFamily="monospace"
                          textAnchor="end"
                        >
                          {val.toFixed(0)}
                        </text>
                      </g>
                    )
                  })}

                  {/* Render Lines for each series */}
                  {overlaySeries.map((s, idx) => {
                    const color = COLORS[idx % COLORS.length]
                    const pathD = s.points.reduce((acc, point, pIdx) => {
                      const x = padding.left + (point.t / maxT) * chartWidth
                      const y = padding.top + chartHeight - (point.achieved_rps / maxRPS) * chartHeight
                      return `${acc} ${pIdx === 0 ? "M" : "L"} ${x} ${y}`
                    }, "")

                    return (
                      <path
                        key={s.test_id}
                        d={pathD}
                        fill="none"
                        stroke={color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )
                  })}
                </svg>

                <div className="flex justify-between items-center pt-2 font-mono text-[10px] text-foreground-subtle border-t border-border-subtle/50">
                  <span>t = 0s</span>
                  <span>t = {maxT}s</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function ComparePage() {
  return (
    <React.Suspense fallback={<div className="font-mono text-xs p-6 text-foreground-muted">Loading regression comparison...</div>}>
      <CompareContent />
    </React.Suspense>
  )
}
