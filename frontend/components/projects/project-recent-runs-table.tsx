"use client"

import * as React from "react"
import Link from "next/link"
import { History, Play, ArrowRight } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
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
      <CardHeader className="border-b border-border-subtle pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
              <History className="size-4 text-brand" />
              <span>Recent Load Test Runs</span>
            </CardTitle>
            <CardDescription className="font-mono text-xs text-foreground-muted">
              Inspect past test executions, compare performance regressions, and
              replay runs.
            </CardDescription>
          </div>

          <Link
            href={`/dashboard/tests?project=${projectId}`}
            className="flex items-center gap-1 font-mono text-xs text-brand hover:underline"
          >
            <span>All Runs</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tests.length === 0 ? (
          <div className="space-y-3 p-8 text-center font-mono text-xs">
            <p className="text-foreground-muted">
              No load test runs have been recorded yet.
            </p>
            <Link
              href={`/dashboard/runner?project=${projectId}`}
              className={buttonVariants({
                className:
                  "gap-1.5 bg-brand font-mono text-xs text-white hover:bg-brand-hover",
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
                  <th className="px-4 py-3 font-semibold">Test Run Name</th>
                  <th className="px-4 py-3 font-semibold">Profile</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Achieved RPS
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    P95 Latency
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
                {tests.slice(0, 5).map((test: LoadTestItem) => (
                  <tr
                    key={test.id}
                    className="transition-colors hover:bg-surface-raised/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/runs/${test.id}`}
                        className="block max-w-[220px] truncate font-semibold text-foreground hover:text-brand"
                      >
                        {test.name}
                      </Link>
                      <span className="block text-[10px] text-foreground-subtle">
                        {test.config?.targets?.[0]?.method || "GET"}{" "}
                        {test.config?.targets?.[0]?.path || "/"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded border border-border-subtle bg-surface-raised px-2 py-0.5 text-[10px] text-sand uppercase">
                        {test.profile}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge status={test.status} />
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {test.summary?.achieved_avg_rps
                        ? `${test.summary.achieved_avg_rps.toFixed(1)} RPS`
                        : "—"}
                    </td>

                    <td className="px-4 py-3 text-right text-foreground">
                      {test.summary?.p95_ms
                        ? `${test.summary.p95_ms.toFixed(1)}ms`
                        : "—"}
                    </td>

                    <td className="px-4 py-3 text-right text-[11px] text-foreground-subtle">
                      {new Date(test.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/runs/${test.id}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                            className:
                              "h-7 px-2 font-mono text-[11px] text-foreground-muted hover:text-foreground",
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
