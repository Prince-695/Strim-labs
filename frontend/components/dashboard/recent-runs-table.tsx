"use client"

import * as React from "react"
import Link from "next/link"
import { Rocket, ArrowUpRight, Play, Eye } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export interface LoadTestSummary {
  id: string
  name: string
  status: string
  profile: string
  model: string
  created_at: string
  config: {
    start_rate?: number
    peak_rate: number
    duration_seconds: number
  }
}

interface RecentRunsTableProps {
  tests: LoadTestSummary[]
  isLoading?: boolean
}

export function RecentRunsTable({ tests, isLoading }: RecentRunsTableProps) {
  return (
    <Card className="border-border bg-surface shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <Rocket className="size-4 text-brand" />
          <CardTitle className="font-heading text-sm font-semibold text-foreground">
            Recent Load Tests
          </CardTitle>
        </div>
        <Link
          href="/dashboard/tests"
          className="inline-flex items-center gap-1 font-mono text-xs text-brand hover:underline"
        >
          <span>All tests ({tests.length})</span>
          <ArrowUpRight className="size-3" />
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tests.length === 0 ? (
          <div className="space-y-3 p-6 py-12 text-center">
            <p className="font-mono text-xs text-foreground-muted">
              No load test runs recorded yet for this project.
            </p>
            <Button
              size="sm"
              render={<Link href="/dashboard/runner" />}
              className="bg-brand font-mono text-xs text-white hover:bg-brand-hover"
            >
              <Play className="mr-1.5 size-3 fill-current" />
              <span>Launch First Test</span>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle overflow-x-auto">
            {tests.map((test) => (
              <div
                key={test.id}
                className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-surface-raised/40 sm:px-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-brand">
                    <Rocket className="size-3.5" />
                  </div>
                  <div className="min-w-0 truncate">
                    <Link
                      href={`/dashboard/tests/${test.id}`}
                      className="block truncate text-xs font-medium text-foreground hover:text-brand"
                    >
                      {test.name}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-foreground-subtle">
                      <span className="capitalize">{test.profile}</span>
                      <span>•</span>
                      <span>Target: {test.config.peak_rate} RPS</span>
                      <span>•</span>
                      <span>{test.config.duration_seconds}s</span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  <StatusBadge status={test.status} size="sm" />
                  <Button
                    variant="ghost"
                    size="xs"
                    render={<Link href={`/dashboard/tests/${test.id}`} />}
                    className="font-mono text-xs text-foreground-muted hover:text-foreground"
                  >
                    <Eye className="mr-1 size-3" />
                    <span>View</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
