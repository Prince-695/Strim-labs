"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { History, Play, RotateCw, Square, Plus } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { loadtestApi, type LoadTestItem } from "@/lib/loadtest-api"
import { projectApi, type Project } from "@/lib/project-api"
import { useUIStore } from "@/lib/stores/ui-store"

export default function RunsHistoryPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentOrgId, currentProjectId, setProjectId } = useUIStore()

  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL")

  // Fetch projects to map project names
  const { data: projectsRes } = useQuery({
    queryKey: ["projects_list", currentOrgId],
    queryFn: () => projectApi.list(currentOrgId!),
    enabled: Boolean(currentOrgId),
  })

  const projects = projectsRes?.data || []
  const activeProjectId =
    currentProjectId || (projects.length > 0 ? projects[0].id : "")
  const activeProject = projects.find((p) => p.id === activeProjectId)

  // Auto-select first project if none selected
  React.useEffect(() => {
    if (!currentProjectId && projects.length > 0) {
      setProjectId(projects[0].id)
    }
  }, [currentProjectId, projects, setProjectId])

  const { data: testsRes, isLoading } = useQuery({
    queryKey: ["load_tests_list", currentOrgId, activeProjectId],
    queryFn: () => loadtestApi.list(currentOrgId!, activeProjectId!),
    enabled: Boolean(currentOrgId && activeProjectId),
    refetchInterval: 5000, // Poll every 5s for ongoing runs
  })

  const rerunMutation = useMutation({
    mutationFn: (testId: string) =>
      loadtestApi.rerun(currentOrgId!, activeProjectId!, testId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: ["load_tests_list", currentOrgId, activeProjectId],
      })
      if (res.data?.id) {
        router.push(`/dashboard/runs/${res.data.id}`)
      }
    },
  })

  const stopMutation = useMutation({
    mutationFn: (testId: string) =>
      loadtestApi.stop(currentOrgId!, activeProjectId!, testId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["load_tests_list", currentOrgId, activeProjectId],
      })
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
        title="Test History"
        description="Review executed load test runs, RPS throughput, latency percentiles, and capacity limits."
        actions={
          <Link
            href="/dashboard/runner"
            className={buttonVariants({
              className:
                "gap-1.5 bg-brand font-mono text-xs text-white hover:bg-brand-hover",
            })}
          >
            <Plus className="size-3.5" />
            <span>New Load Test</span>
          </Link>
        }
      />

      {/* Target Project Selector */}
      <Card className="relative overflow-hidden border-border bg-surface">
        <CornerCrosshairs />
        <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-foreground-subtle uppercase">
              Target Project:
            </span>
            {projects.length > 0 ? (
              <select
                value={activeProjectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="rounded-md border border-border-subtle bg-surface-raised px-3 py-1.5 font-mono text-xs text-foreground focus:border-brand focus:outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.environment})
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-mono text-xs text-foreground-muted">
                No projects found
              </span>
            )}

            {activeProject && (
              <span className="font-mono text-xs text-foreground-muted">
                Base URL:{" "}
                <strong className="text-foreground">
                  {activeProject.base_url}
                </strong>
              </span>
            )}
          </div>

          <div className="font-mono text-xs text-foreground-subtle">
            {allTests.length} recorded {allTests.length === 1 ? "run" : "runs"}
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <div className="inline-flex rounded-lg border border-border-subtle bg-surface-raised p-1 font-mono text-xs">
        {(["ALL", "RUNNING", "COMPLETED", "FAILED", "STOPPED"] as const).map(
          (status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`rounded px-3 py-1 transition-colors ${
                selectedStatus === status
                  ? "bg-brand font-medium text-white"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {status}
            </button>
          )
        )}
      </div>

      {/* Runs Table Card */}
      <Card className="relative overflow-hidden border-border bg-surface shadow-xs">
        <CornerCrosshairs />
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredTests.length === 0 ? (
            <EmptyState
              icon={<History className="size-6 text-sand" />}
              title={
                allTests.length === 0
                  ? "No Load Tests Executed"
                  : "No Tests Match Selected Status"
              }
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
                      className:
                        "gap-1.5 bg-brand font-mono text-xs text-white hover:bg-brand-hover",
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
                    <th className="px-4 py-3 font-semibold">Test Run</th>
                    <th className="px-4 py-3 font-semibold">Profile</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Achieved RPS
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      P95 Latency
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Error Rate
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Executed At
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredTests.map((test: LoadTestItem) => {
                    const isRunning = test.status === "running"

                    return (
                      <tr
                        key={test.id}
                        className="transition-colors hover:bg-surface-raised/30"
                      >
                        {/* Test Name & Target */}
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/dashboard/runs/${test.id}`}
                            className="block font-medium text-foreground transition-colors hover:text-brand"
                          >
                            {test.name}
                          </Link>
                          <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-foreground-subtle">
                            <span className="font-medium text-foreground-muted">
                              {activeProject?.name || "Target"}
                            </span>
                            <span>•</span>
                            <span>
                              {test.config?.targets?.[0]?.method || "GET"}{" "}
                              {test.config?.targets?.[0]?.path || "/"}
                            </span>
                          </div>
                        </td>

                        {/* Profile Preset */}
                        <td className="px-4 py-3.5">
                          <span className="rounded border border-border-subtle bg-surface-raised px-2 py-0.5 text-[10px] text-sand uppercase">
                            {test.profile}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <StatusBadge status={test.status} />
                        </td>

                        {/* Achieved RPS */}
                        <td className="px-4 py-3.5 text-right font-semibold text-foreground">
                          {test.summary?.achieved_avg_rps
                            ? `${test.summary.achieved_avg_rps.toFixed(1)} RPS`
                            : isRunning
                              ? "Streaming..."
                              : "—"}
                        </td>

                        {/* P95 Latency */}
                        <td className="px-4 py-3.5 text-right text-foreground">
                          {test.summary?.p95_ms
                            ? `${test.summary.p95_ms.toFixed(1)}ms`
                            : "—"}
                        </td>

                        {/* Error Rate */}
                        <td className="px-4 py-3.5 text-right">
                          {test.summary?.error_rate !== undefined ? (
                            <span
                              className={
                                test.summary.error_rate > 0.05
                                  ? "font-bold text-danger"
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
                        <td className="px-4 py-3.5 text-right text-foreground-subtle">
                          <div className="text-foreground">
                            {new Date(test.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <div className="text-[10px]">
                            {new Date(test.created_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
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
                                variant="link"
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
                                className:
                                  "border border-border-subtle bg-surface-raised font-mono text-[10px] text-foreground",
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
