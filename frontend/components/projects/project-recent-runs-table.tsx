"use client"

import * as React from "react"
import Link from "next/link"
import { History, Play, ArrowRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { LoadTestItem } from "@/lib/loadtest-api"

interface ProjectRecentRunsTableProps {
  tests: LoadTestItem[]
  isLoading: boolean
  projectId: string
}

export function ProjectRecentRunsTable({
  tests,
  isLoading,
  projectId,
}: ProjectRecentRunsTableProps) {
  return (
    <Card className="border-border bg-surface shadow-xs">
      <CardHeader className="pb-3 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold font-heading text-foreground flex items-center gap-2">
              <History className="size-4 text-brand" />
              <span>Recent Load Test Runs</span>
            </CardTitle>
            <CardDescription className="text-xs text-foreground-muted font-mono">
              Inspect past test executions, compare performance regressions, and replay runs.
            </CardDescription>
          </div>

          <Link
            href={`/dashboard/tests?project=${projectId}`}
            className="font-mono text-xs text-brand hover:underline flex items-center gap-1"
          >
            <span>All Runs</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tests.length === 0 ? (
          <div className="p-8 text-center space-y-3 font-mono text-xs">
            <p className="text-foreground-muted">No load test runs have been recorded yet.</p>
            <Link
              href={`/dashboard/runner?project=${projectId}`}
              className={buttonVariants({
                className: "bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5",
              })}
            >
              <Play className="size-3 fill-current" />
              <span>Launch First Load Test</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-raised/40 text-[11px] text-foreground-subtle uppercase">
                  <th className="py-3 px-4 font-semibold">Test Run Name</th>
                  <th className="py-3 px-4 font-semibold">Profile</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Achieved RPS</th>
                  <th className="py-3 px-4 font-semibold text-right">P95 Latency</th>
                  <th className="py-3 px-4 font-semibold text-right">Executed At</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {tests.slice(0, 5).map((test: LoadTestItem) => (
                  <tr key={test.id} className="hover:bg-surface-raised/30 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/dashboard/runs/${test.id}`}
                        className="font-semibold text-foreground hover:text-brand block truncate max-w-[220px]"
                      >
                        {test.name}
                      </Link>
                      <span className="text-[10px] text-foreground-subtle block">
                        {test.config?.targets?.[0]?.method || "GET"}{" "}
                        {test.config?.targets?.[0]?.path || "/"}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="rounded bg-surface-raised px-2 py-0.5 text-[10px] uppercase text-sand border border-border-subtle">
                        {test.profile}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <StatusBadge status={test.status} />
                    </td>

                    <td className="py-3 px-4 text-right font-semibold text-foreground">
                      {test.summary?.achieved_avg_rps
                        ? `${test.summary.achieved_avg_rps.toFixed(1)} RPS`
                        : "—"}
                    </td>

                    <td className="py-3 px-4 text-right text-foreground">
                      {test.summary?.p95_ms ? `${test.summary.p95_ms.toFixed(1)}ms` : "—"}
                    </td>

                    <td className="py-3 px-4 text-right text-foreground-subtle text-[11px]">
                      {new Date(test.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/runs/${test.id}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                            className: "h-7 text-[11px] font-mono px-2 text-foreground-muted hover:text-foreground",
                          })}
                        >
                          Cockpit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
