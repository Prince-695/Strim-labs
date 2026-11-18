"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { BarChart2 } from "lucide-react"
import { api, type ApiResponse } from "@/lib/api-client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface StatusCodesResponse {
  classes: Record<string, number>
  codes: { status: number; count: number }[]
}

interface StatusCodeDistributionProps {
  orgId: string
  projectId: string
}

export function StatusCodeDistribution({
  orgId,
  projectId,
}: StatusCodeDistributionProps) {
  const { data: response, isLoading } = useQuery<
    ApiResponse<StatusCodesResponse>
  >({
    queryKey: ["status_codes", orgId, projectId],
    queryFn: async () => {
      return api.get<StatusCodesResponse>(
        `/organizations/${orgId}/projects/${projectId}/metrics/status-codes?range=1h`
      )
    },
    enabled: Boolean(orgId && projectId),
  })

  const classes = response?.data?.classes || {}
  const topCodes = response?.data?.codes || []

  const c2xx = classes["2xx"] || 0
  const c3xx = classes["3xx"] || 0
  const c4xx = classes["4xx"] || 0
  const c5xx = classes["5xx"] || 0

  const total = c2xx + c3xx + c4xx + c5xx

  const p2xx = total > 0 ? (c2xx / total) * 100 : 0
  const p3xx = total > 0 ? (c3xx / total) * 100 : 0
  const p4xx = total > 0 ? (c4xx / total) * 100 : 0
  const p5xx = total > 0 ? (c5xx / total) * 100 : 0

  return (
    <Card className="border-border bg-surface shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="size-4 text-brand" />
          <CardTitle className="font-heading text-sm font-semibold text-foreground">
            Status Code Distribution
          </CardTitle>
        </div>
        <span className="font-mono text-[10px] text-foreground-subtle uppercase">
          Last 1h
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : total === 0 ? (
          <div className="py-6 text-center font-mono text-xs text-foreground-subtle">
            No HTTP traffic observed in current window.
          </div>
        ) : (
          <>
            {/* Visual Stacked Progress Bar */}
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-raised">
              {p2xx > 0 && (
                <div
                  style={{ width: `${p2xx}%` }}
                  className="bg-success transition-all duration-300"
                  title={`2xx: ${c2xx.toLocaleString()} (${p2xx.toFixed(1)}%)`}
                />
              )}
              {p3xx > 0 && (
                <div
                  style={{ width: `${p3xx}%` }}
                  className="bg-info transition-all duration-300"
                  title={`3xx: ${c3xx.toLocaleString()} (${p3xx.toFixed(1)}%)`}
                />
              )}
              {p4xx > 0 && (
                <div
                  style={{ width: `${p4xx}%` }}
                  className="bg-warning transition-all duration-300"
                  title={`4xx: ${c4xx.toLocaleString()} (${p4xx.toFixed(1)}%)`}
                />
              )}
              {p5xx > 0 && (
                <div
                  style={{ width: `${p5xx}%` }}
                  className="bg-danger transition-all duration-300"
                  title={`5xx: ${c5xx.toLocaleString()} (${p5xx.toFixed(1)}%)`}
                />
              )}
            </div>

            {/* Legend & Breakdown */}
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs sm:grid-cols-4">
              <div className="rounded border border-border-subtle bg-surface-raised/40 p-2">
                <div className="flex items-center gap-1.5 font-medium text-success">
                  <span className="size-2 rounded-full bg-success" />
                  <span>2xx OK</span>
                </div>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {c2xx.toLocaleString()}{" "}
                  <span className="text-[10px] font-normal text-foreground-subtle">
                    ({p2xx.toFixed(1)}%)
                  </span>
                </p>
              </div>

              <div className="rounded border border-border-subtle bg-surface-raised/40 p-2">
                <div className="flex items-center gap-1.5 font-medium text-info">
                  <span className="size-2 rounded-full bg-info" />
                  <span>3xx Redirect</span>
                </div>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {c3xx.toLocaleString()}{" "}
                  <span className="text-[10px] font-normal text-foreground-subtle">
                    ({p3xx.toFixed(1)}%)
                  </span>
                </p>
              </div>

              <div className="rounded border border-border-subtle bg-surface-raised/40 p-2">
                <div className="flex items-center gap-1.5 font-medium text-warning">
                  <span className="size-2 rounded-full bg-warning" />
                  <span>4xx Client</span>
                </div>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {c4xx.toLocaleString()}{" "}
                  <span className="text-[10px] font-normal text-foreground-subtle">
                    ({p4xx.toFixed(1)}%)
                  </span>
                </p>
              </div>

              <div className="rounded border border-border-subtle bg-surface-raised/40 p-2">
                <div className="flex items-center gap-1.5 font-medium text-danger">
                  <span className="size-2 rounded-full bg-danger" />
                  <span>5xx Server</span>
                </div>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {c5xx.toLocaleString()}{" "}
                  <span className="text-[10px] font-normal text-foreground-subtle">
                    ({p5xx.toFixed(1)}%)
                  </span>
                </p>
              </div>
            </div>

            {/* Top Observed Codes */}
            {topCodes.length > 0 && (
              <div className="border-t border-border-subtle pt-3">
                <p className="mb-2 font-mono text-[11px] text-foreground-subtle uppercase">
                  Top Observed Statuses
                </p>
                <div className="flex flex-wrap gap-2">
                  {topCodes.slice(0, 6).map((code) => (
                    <span
                      key={code.status}
                      className="inline-flex items-center gap-1.5 rounded border border-border-subtle bg-surface-raised px-2 py-1 font-mono text-[11px]"
                    >
                      <span
                        className={
                          code.status >= 500
                            ? "font-bold text-danger"
                            : code.status >= 400
                              ? "font-bold text-warning"
                              : "font-bold text-success"
                        }
                      >
                        {code.status}
                      </span>
                      <span className="text-foreground-muted">
                        {code.count.toLocaleString()}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
