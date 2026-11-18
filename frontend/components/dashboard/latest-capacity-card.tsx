"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Gauge, ArrowUpRight, CheckCircle2, AlertTriangle } from "lucide-react"
import { api, type ApiResponse } from "@/lib/api-client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export interface CapacityReport {
  id: string
  load_test_id: string
  project_id: string
  sustainable_rps: number
  breaking_point_rps?: number | null
  breaking_reason?: string
  baseline_p95_ms: number
  confidence: string
  note: string
  thresholds: {
    max_p95_latency_ms: number
    max_error_rate: number
  }
}

interface LatestCapacityCardProps {
  orgId: string
  projectId: string
  latestTestId?: string
}

export function LatestCapacityCard({
  orgId,
  projectId,
  latestTestId,
}: LatestCapacityCardProps) {
  const { data: capacityResponse, isLoading } =
    useQuery<ApiResponse<CapacityReport> | null>({
      queryKey: ["capacity_report", orgId, projectId, latestTestId],
      queryFn: async () => {
        if (!latestTestId) return null
        return api.get<CapacityReport>(
          `/organizations/${orgId}/projects/${projectId}/load-tests/${latestTestId}/capacity`
        )
      },
      enabled: Boolean(orgId && projectId && latestTestId),
    })

  const report = capacityResponse?.data

  return (
    <Card className="border-border bg-surface shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <Gauge className="size-4 text-brand" />
          <CardTitle className="font-heading text-sm font-semibold text-foreground">
            Capacity & Breaking Point
          </CardTitle>
        </div>
        {report && (
          <span className="rounded border border-border-subtle px-2 py-0.5 font-mono text-[10px] text-foreground-subtle">
            Confidence: {report.confidence}
          </span>
        )}
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !latestTestId || !report ? (
          <div className="space-y-2 py-6 text-center">
            <p className="font-mono text-xs text-foreground-muted">
              No completed capacity analysis recorded for this project yet.
            </p>
            <Button
              size="xs"
              render={<Link href="/dashboard/runner" />}
              className="bg-brand font-mono text-xs text-white hover:bg-brand-hover"
            >
              Run Breaking Point Test
            </Button>
          </div>
        ) : (
          <>
            {/* Primary Capacity Numbers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border-subtle bg-surface-raised/40 p-3">
                <p className="font-mono text-[10px] text-foreground-subtle uppercase">
                  Sustainable RPS
                </p>
                <p className="mt-1 font-mono text-xl font-bold text-success">
                  {report.sustainable_rps.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-foreground-subtle">
                    RPS
                  </span>
                </p>
                <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-success">
                  <CheckCircle2 className="size-3 shrink-0" />
                  <span>SLA verified</span>
                </div>
              </div>

              <div className="rounded-lg border border-border-subtle bg-surface-raised/40 p-3">
                <p className="font-mono text-[10px] text-foreground-subtle uppercase">
                  Observed Breaking Point
                </p>
                <p className="mt-1 font-mono text-xl font-bold text-foreground">
                  {report.breaking_point_rps ? (
                    <>
                      {report.breaking_point_rps.toLocaleString()}{" "}
                      <span className="text-xs font-normal text-danger">
                        RPS
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-medium text-foreground-muted">
                      Not Breached
                    </span>
                  )}
                </p>
                <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-foreground-subtle">
                  {report.breaking_point_rps ? (
                    <>
                      <AlertTriangle className="size-3 shrink-0 text-warning" />
                      <span className="truncate text-warning">
                        {report.breaking_reason || "Knee saturation"}
                      </span>
                    </>
                  ) : (
                    <span>Clean execution</span>
                  )}
                </div>
              </div>
            </div>

            {/* Threshold Parameters */}
            <div className="space-y-1 rounded-md border border-border-subtle bg-background/50 p-2.5 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px] text-foreground-subtle">
                <span>Configured Latency SLA:</span>
                <span className="text-foreground">
                  {report.thresholds.max_p95_latency_ms}ms P95
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-foreground-subtle">
                <span>Configured Error SLA:</span>
                <span className="text-foreground">
                  {(report.thresholds.max_error_rate * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Action */}
            <div className="flex items-center justify-between pt-1">
              <Link
                href={`/dashboard/tests/${report.load_test_id}`}
                className="inline-flex items-center gap-1.5 font-mono text-xs text-brand hover:underline"
              >
                <span>Full Capacity Breakdown</span>
                <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
