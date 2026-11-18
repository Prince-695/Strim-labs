import * as React from "react"
import { Activity, Clock, AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/ui/status-badge"

export interface MetricSummary {
  rps: number
  requests: number
  p50: number
  p90: number
  p95: number
  p99: number
  error_rate: number
  success_rate: number
}

interface KPIMetricCardsProps {
  current?: MetricSummary
  previous?: MetricSummary
  isLoading?: boolean
}

export function KPIMetricCards({ current, previous, isLoading }: KPIMetricCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border bg-surface p-5">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-40" />
          </Card>
        ))}
      </div>
    )
  }

  // Calculate percentage delta
  const computeDelta = (curr?: number, prev?: number, invertGood = false) => {
    if (curr === undefined || prev === undefined || prev === 0) return null
    const diff = curr - prev
    const pct = (diff / prev) * 100
    const isIncrease = diff > 0
    const isGood = invertGood ? !isIncrease : isIncrease

    return {
      text: `${isIncrease ? "+" : ""}${pct.toFixed(1)}%`,
      isIncrease,
      isGood: Math.abs(pct) < 0.1 ? null : isGood,
    }
  }

  const rpsDelta = computeDelta(current?.rps, previous?.rps, false)
  const p95Delta = computeDelta(current?.p95, previous?.p95, true) // lower latency is good
  const errorDelta = computeDelta(current?.error_rate, previous?.error_rate, true)

  const renderDeltaChip = (delta: ReturnType<typeof computeDelta>) => {
    if (!delta) return null
    const colorClass =
      delta.isGood === true
        ? "text-success bg-success-subtle border-success/30"
        : delta.isGood === false
        ? "text-danger bg-danger-subtle border-danger/30"
        : "text-foreground-subtle bg-surface-raised border-border-subtle"

    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${colorClass}`}
      >
        {delta.isIncrease ? (
          <TrendingUp className="size-2.5" />
        ) : delta.isGood === null ? (
          <Minus className="size-2.5" />
        ) : (
          <TrendingDown className="size-2.5" />
        )}
        <span>{delta.text}</span>
      </span>
    )
  }

  const hasData = Boolean(
    current &&
      (typeof current.requests === "number" ||
        typeof current.rps === "number" ||
        typeof current.p95 === "number")
  )

  const rpsVal = current?.rps ?? 0
  const requestsVal = current?.requests ?? 0
  const p50Val = current?.p50 ?? 0
  const p95Val = current?.p95 ?? 0
  const p99Val = current?.p99 ?? 0
  const errorRateVal = current?.error_rate ?? 0
  const successRateVal =
    current?.success_rate ?? (requestsVal > 0 ? Math.max(0, 1 - errorRateVal) : 1)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Throughput */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-mono font-medium text-foreground-muted">
            AVERAGE THROUGHPUT
          </CardTitle>
          <Activity className="size-4 text-brand" />
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {rpsVal.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-foreground-subtle">RPS</span>
                {renderDeltaChip(rpsDelta)}
              </div>
              <p className="text-[11px] font-mono text-foreground-subtle">
                Volume: {requestsVal.toLocaleString()} reqs in window
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-foreground-subtle">—</span>
              <p className="text-[11px] font-mono text-foreground-subtle">No telemetry recorded</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* P95 Latency */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-mono font-medium text-foreground-muted">
            P95 TAIL LATENCY
          </CardTitle>
          <Clock className="size-4 text-warning" />
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {p95Val.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-foreground-subtle">ms</span>
                {renderDeltaChip(p95Delta)}
              </div>
              <p className="text-[11px] font-mono text-foreground-subtle">
                P50: {p50Val.toFixed(1)}ms • P99: {p99Val.toFixed(1)}ms
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-foreground-subtle">—</span>
              <p className="text-[11px] font-mono text-foreground-subtle">No telemetry recorded</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Rate */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-mono font-medium text-foreground-muted">
            ERROR RATE
          </CardTitle>
          <AlertCircle className="size-4 text-danger" />
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {(errorRateVal * 100).toFixed(2)}%
                </span>
                {renderDeltaChip(errorDelta)}
              </div>
              <p className="text-[11px] font-mono text-foreground-subtle">
                Success rate: {(successRateVal * 100).toFixed(2)}%
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-foreground-subtle">—</span>
              <p className="text-[11px] font-mono text-foreground-subtle">No telemetry recorded</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capacity Health Status */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-mono font-medium text-foreground-muted">
            OPERATIONAL HEALTH
          </CardTitle>
          <TrendingUp className="size-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="pt-0.5">
              <StatusBadge
                status={
                  !hasData
                    ? "queued"
                    : errorRateVal > 0.05 || p95Val > 500
                    ? "degraded"
                    : "healthy"
                }
                size="md"
              />
            </div>
            <p className="text-[11px] text-foreground-subtle pt-1">
              {!hasData
                ? "Awaiting target telemetry"
                : errorRateVal < 0.01
                ? "Sustained performance normal"
                : "Latency or error threshold breach"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
