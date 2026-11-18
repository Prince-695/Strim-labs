"use client"

import * as React from "react"
import { GitCompare, TrendingUp, AlertCircle, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import type { LoadTestItem, CompareResponse } from "@/lib/loadtest-api"

interface ProjectCompareModalProps {
  isOpen: boolean
  onClose: () => void
  projectName: string
  tests: LoadTestItem[]
  baselineRunId: string
  setBaselineRunId: (id: string) => void
  candidateRunId: string
  setCandidateRunId: (id: string) => void
  compareData: CompareResponse | null
  isComparing: boolean
  compareError: string | null
  onRunComparison: () => void
}

export function ProjectCompareModal({
  isOpen,
  onClose,
  projectName,
  tests,
  baselineRunId,
  setBaselineRunId,
  candidateRunId,
  setCandidateRunId,
  compareData,
  isComparing,
  compareError,
  onRunComparison,
}: ProjectCompareModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl border-border bg-surface shadow-2xl relative my-8">
        <CornerCrosshairs />
        <CardHeader className="border-b border-border-subtle pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold font-heading text-foreground flex items-center gap-2">
                <GitCompare className="size-4 text-brand" />
                <span>Compare Load Test Runs</span>
              </CardTitle>
              <CardDescription className="text-xs text-foreground-muted font-mono">
                Head-to-head performance regression and latency variance comparison for {projectName}.
              </CardDescription>
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-foreground-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-5 font-mono text-xs">
          {compareError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-danger">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{compareError}</span>
            </div>
          )}

          {/* Selector Pair */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-foreground-muted text-[11px] font-semibold uppercase">
                Run A (Baseline):
              </label>
              <select
                value={baselineRunId}
                onChange={(e) => setBaselineRunId(e.target.value)}
                className="w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-brand"
              >
                <option value="">Select baseline run...</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.summary?.achieved_avg_rps?.toFixed(0) || 0} RPS)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-foreground-muted text-[11px] font-semibold uppercase">
                Run B (Candidate):
              </label>
              <select
                value={candidateRunId}
                onChange={(e) => setCandidateRunId(e.target.value)}
                className="w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-brand"
              >
                <option value="">Select comparison run...</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.summary?.achieved_avg_rps?.toFixed(0) || 0} RPS)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              onClick={onRunComparison}
              disabled={!baselineRunId || !candidateRunId || isComparing}
              className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5"
            >
              {isComparing && <Loader2 className="size-3.5 animate-spin" />}
              <span>Compute Head-to-Head Delta</span>
            </Button>
          </div>

          {/* Comparison Results Card */}
          {compareData && (() => {
            const baseSummary =
              compareData.tests.find((t) => t.id === compareData.baseline_id) || compareData.tests[0]
            const candSummary =
              compareData.tests.find((t) => t.id !== compareData.baseline_id) || compareData.tests[1] || compareData.tests[0]
            const delta =
              compareData.deltas.find((d) => d.test_id === candSummary?.id) || compareData.deltas[0]

            return (
              <div className="space-y-4 pt-4 border-t border-border-subtle">
                {/* Verdict Banner */}
                {delta && (
                  <div
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      delta.verdict === "improved"
                        ? "border-success/40 bg-success/10 text-success"
                        : delta.verdict === "regressed"
                        ? "border-danger/40 bg-danger/10 text-danger"
                        : "border-warning/40 bg-warning/10 text-warning"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="size-4" />
                      <span className="font-bold uppercase tracking-wider text-xs">
                        Verdict: {delta.verdict}
                      </span>
                    </div>
                    <span className="text-[11px]">
                      {delta.p95_pct < 0
                        ? `${Math.abs(delta.p95_pct).toFixed(1)}% latency drop`
                        : `${delta.p95_pct.toFixed(1)}% latency variance`}
                    </span>
                  </div>
                )}

                {/* Comparative Metrics Table */}
                <div className="overflow-x-auto rounded-lg border border-border-subtle">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle bg-surface-raised/40 text-[11px] text-foreground-subtle uppercase">
                        <th className="py-2.5 px-3">Metric</th>
                        <th className="py-2.5 px-3 text-right">Run A ({baseSummary?.name?.slice(0, 16) || "Baseline"})</th>
                        <th className="py-2.5 px-3 text-right">Run B ({candSummary?.name?.slice(0, 16) || "Candidate"})</th>
                        <th className="py-2.5 px-3 text-right">Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      <tr>
                        <td className="py-2.5 px-3 text-foreground-muted">Achieved Avg RPS</td>
                        <td className="py-2.5 px-3 text-right text-foreground font-semibold">
                          {baseSummary ? baseSummary.avg_rps.toFixed(1) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right text-foreground font-semibold">
                          {candSummary ? candSummary.avg_rps.toFixed(1) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {delta?.avg_rps_pct !== undefined ? (
                            <span
                              className={
                                delta.avg_rps_pct >= 0
                                  ? "text-emerald-400 font-bold"
                                  : "text-rose-400 font-bold"
                              }
                            >
                              {delta.avg_rps_pct >= 0 ? "+" : ""}
                              {delta.avg_rps_pct.toFixed(1)}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td className="py-2.5 px-3 text-foreground-muted">P95 Tail Latency</td>
                        <td className="py-2.5 px-3 text-right text-foreground font-semibold">
                          {baseSummary ? `${baseSummary.p95_ms.toFixed(1)}ms` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right text-foreground font-semibold">
                          {candSummary ? `${candSummary.p95_ms.toFixed(1)}ms` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {delta?.p95_pct !== undefined ? (
                            <span
                              className={
                                delta.p95_pct <= 0
                                  ? "text-emerald-400 font-bold"
                                  : "text-rose-400 font-bold"
                              }
                            >
                              {delta.p95_pct >= 0 ? "+" : ""}
                              {delta.p95_pct.toFixed(1)}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td className="py-2.5 px-3 text-foreground-muted">Error Rate</td>
                        <td className="py-2.5 px-3 text-right text-foreground">
                          {baseSummary ? `${(baseSummary.error_rate * 100).toFixed(2)}%` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right text-foreground">
                          {candSummary ? `${(candSummary.error_rate * 100).toFixed(2)}%` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {delta?.error_rate_pct !== undefined ? (
                            <span
                              className={
                                delta.error_rate_pct <= 0
                                  ? "text-emerald-400"
                                  : "text-rose-400"
                              }
                            >
                              {(delta.error_rate_pct * 100).toFixed(2)}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          <div className="flex justify-end pt-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="font-mono text-xs"
            >
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
