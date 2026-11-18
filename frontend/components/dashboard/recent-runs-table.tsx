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
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Rocket className="size-4 text-brand" />
          <CardTitle className="text-sm font-semibold font-heading text-foreground">
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
          <div className="p-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tests.length === 0 ? (
          <div className="py-12 text-center space-y-3 p-6">
            <p className="text-xs font-mono text-foreground-muted">
              No load test runs recorded yet for this project.
            </p>
            <Button
              size="sm"
              render={<Link href="/dashboard/runner" />}
              className="bg-brand text-white hover:bg-brand-hover text-xs font-mono"
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
                className="flex items-center justify-between p-3.5 sm:px-4 hover:bg-surface-raised/40 transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-brand">
                    <Rocket className="size-3.5" />
                  </div>
                  <div className="min-w-0 truncate">
                    <Link
                      href={`/dashboard/tests/${test.id}`}
                      className="text-xs font-medium text-foreground hover:text-brand truncate block"
                    >
                      {test.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5 font-mono text-[10px] text-foreground-subtle">
                      <span className="capitalize">{test.profile}</span>
                      <span>•</span>
                      <span>Target: {test.config.peak_rate} RPS</span>
                      <span>•</span>
                      <span>{test.config.duration_seconds}s</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <StatusBadge status={test.status} size="sm" />
                  <Button
                    variant="ghost"
                    size="xs"
                    render={<Link href={`/dashboard/tests/${test.id}`} />}
                    className="text-xs font-mono text-foreground-muted hover:text-foreground"
                  >
                    <Eye className="size-3 mr-1" />
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
