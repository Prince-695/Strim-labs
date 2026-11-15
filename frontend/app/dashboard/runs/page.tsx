"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  History,
  Play,
  RotateCw,
  Square,
  Plus
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { loadtestApi, type LoadTestItem } from "@/lib/loadtest-api"
import { useUIStore } from "@/lib/stores/ui-store"

export default function RunsHistoryPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentOrgId, currentProjectId } = useUIStore()

  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL")

  const { data: testsRes, isLoading } = useQuery({
    queryKey: ["load_tests_list", currentOrgId, currentProjectId],
    queryFn: () => loadtestApi.list(currentOrgId!, currentProjectId!),
    enabled: Boolean(currentOrgId && currentProjectId),
    refetchInterval: 5000, // Poll every 5s for ongoing runs
  })

  const rerunMutation = useMutation({
    mutationFn: (testId: string) => loadtestApi.rerun(currentOrgId!, currentProjectId!, testId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["load_tests_list", currentOrgId, currentProjectId] })
      if (res.data?.id) {
        router.push(`/dashboard/runs/${res.data.id}`)
      }
    },
  })

  const stopMutation = useMutation({
    mutationFn: (testId: string) => loadtestApi.stop(currentOrgId!, currentProjectId!, testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["load_tests_list", currentOrgId, currentProjectId] })
    },
  })

  const allTests = testsRes?.data || []

  const filteredTests = allTests.filter((test: LoadTestItem) => {
    if (selectedStatus === "ALL") return true
    return test.status.toUpperCase() === selectedStatus
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Load Test Runs & Cockpit History"
        description="Inspect synthetic test executions, active progress streams, latency percentiles, and capacity reports."
        actions={
          <Link
            href="/dashboard/runner"
            className={buttonVariants({
              className: "gap-1.5 bg-brand text-white hover:bg-brand-hover text-xs font-mono",
            })}
          >
            <Plus className="size-3.5" />
            <span>New Load Test</span>
          </Link>
        }
      />

      {/* Filter Tabs */}
      <div className="inline-flex rounded-lg border border-border-subtle bg-surface-raised p-1 font-mono text-xs">
        {(["ALL", "RUNNING", "COMPLETED", "FAILED", "STOPPED"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`rounded px-3 py-1 transition-colors ${
              selectedStatus === status
                ? "bg-brand text-white font-medium"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Runs Table Card */}
      <Card className="border-border bg-surface shadow-xs">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredTests.length === 0 ? (
            <EmptyState
              icon={<History className="size-6 text-sand" />}
              title={allTests.length === 0 ? "No Load Tests Executed" : "No Tests Match Selected Status"}
              description={
                allTests.length === 0
                  ? "Launch your first load test from the runner to benchmark capacity thresholds."
                  : "Try clearing your status filter."
              }
              action={
                allTests.length === 0 ? (
                  <Link
                    href="/dashboard/runner"
                    className={buttonVariants({
                      className: "bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5",
                    })}
                  >
                    <Play className="size-3.5 fill-current" />
                    <span>Launch Load Test</span>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-raised/40 text-[11px] text-foreground-subtle uppercase">
                    <th className="py-3 px-4 font-semibold">Test Run</th>
                    <th className="py-3 px-4 font-semibold">Profile</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Achieved RPS</th>
                    <th className="py-3 px-4 font-semibold text-right">P95 Latency</th>
                    <th className="py-3 px-4 font-semibold text-right">Error Rate</th>
                    <th className="py-3 px-4 font-semibold text-right">Executed At</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredTests.map((test: LoadTestItem) => {
                    const isRunning = test.status === "running"

                    return (
                      <tr key={test.id} className="hover:bg-surface-raised/30 transition-colors">
                        {/* Test Name & ID */}
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/dashboard/runs/${test.id}`}
                            className="font-medium text-foreground hover:text-brand transition-colors block"
                          >
                            {test.name}
                          </Link>
                          <span className="text-[10px] text-foreground-subtle truncate max-w-[150px] block">
                            {test.id}
                          </span>
                        </td>

                        {/* Profile Preset */}
                        <td className="py-3.5 px-4">
                          <span className="rounded bg-surface-raised px-2 py-0.5 text-[10px] uppercase text-sand border border-border-subtle">
                            {test.profile}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={test.status} />
                        </td>

                        {/* Achieved RPS */}
                        <td className="py-3.5 px-4 text-right text-foreground font-semibold">
                          {test.summary?.achieved_avg_rps
                            ? `${test.summary.achieved_avg_rps.toFixed(1)} RPS`
                            : isRunning
                            ? "Streaming..."
                            : "—"}
                        </td>

                        {/* P95 Latency */}
                        <td className="py-3.5 px-4 text-right text-foreground">
                          {test.summary?.p95_ms
                            ? `${test.summary.p95_ms.toFixed(1)}ms`
                            : "—"}
                        </td>

                        {/* Error Rate */}
                        <td className="py-3.5 px-4 text-right">
                          {test.summary?.error_rate !== undefined ? (
                            <span
                              className={
                                test.summary.error_rate > 0.05
                                  ? "text-danger font-bold"
                                  : "text-foreground"
                              }
                            >
                              {(test.summary.error_rate * 100).toFixed(2)}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* Executed At */}
                        <td className="py-3.5 px-4 text-right text-foreground-subtle">
                          {new Date(test.created_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isRunning ? (
                              <Button
                                size="xs"
                                variant="destructive"
                                onClick={() => stopMutation.mutate(test.id)}
                                disabled={stopMutation.isPending}
                                className="gap-1 font-mono text-[10px]"
                              >
                                <Square className="size-3 fill-current" />
                                <span>Stop</span>
                              </Button>
                            ) : (
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => rerunMutation.mutate(test.id)}
                                disabled={rerunMutation.isPending}
                                title="Rerun test with identical config"
                                className="font-mono text-[10px]"
                              >
                                <RotateCw className="size-3" />
                              </Button>
                            )}

                            <Link
                              href={`/dashboard/runs/${test.id}`}
                              className={buttonVariants({
                                size: "xs",
                                className: "bg-surface-raised border border-border-subtle text-foreground text-[10px] font-mono",
                              })}
                            >
                              <span>Cockpit</span>
                            </Link>
                          </div>
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
  )
}
