"use client"

import * as React from "react"
import { Activity, Clock } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import type { TimeseriesPoint } from "@/lib/metrics-api"

interface TimeseriesChartProps {
  title: string
  description: string
  points?: TimeseriesPoint[]
  unit: string
  color?: "brand" | "amber" | "emerald" | "purple"
  isLoading?: boolean
  selectedRange?: string
}

export function TimeseriesChart({
  title,
  description,
  points = [],
  unit,
  color = "brand",
  isLoading = false,
  selectedRange = "24h",
}: TimeseriesChartProps) {
  // Filter valid numeric points
  const validPoints = React.useMemo(() => {
    return points
      .filter((p) => p.value !== null && p.value !== undefined && !isNaN(Number(p.value)))
      .map((p) => ({
        timestamp: p.timestamp,
        value: Number(p.value),
      }))
  }, [points])

  const svgWidth = 640
  const svgHeight = 180
  const padding = { top: 20, right: 20, bottom: 25, left: 45 }
  const chartWidth = svgWidth - padding.left - padding.right
  const chartHeight = svgHeight - padding.top - padding.bottom

  const strokeColor =
    color === "amber"
      ? "var(--color-amber-500, #f59e0b)"
      : color === "emerald"
      ? "var(--color-emerald-500, #10b981)"
      : color === "purple"
      ? "var(--color-purple-500, #a855f7)"
      : "var(--brand, #c9510c)"

  const values = validPoints.map((p) => p.value)
  const maxValue = values.length > 0 ? Math.max(1, ...values) * 1.15 : 10
  const minValue = 0

  const pathD = React.useMemo(() => {
    if (validPoints.length === 0) return ""
    return validPoints.reduce((acc, pt, idx) => {
      const x = padding.left + (idx / Math.max(1, validPoints.length - 1)) * chartWidth
      const y = padding.top + chartHeight - ((pt.value - minValue) / (maxValue - minValue)) * chartHeight
      return `${acc} ${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`
    }, "")
  }, [validPoints, maxValue, minValue, chartWidth, chartHeight, padding.left, padding.top])

  const areaD = React.useMemo(() => {
    if (validPoints.length === 0 || !pathD) return ""
    const firstX = padding.left
    const lastX = padding.left + chartWidth
    const baseY = padding.top + chartHeight
    return `${pathD} L ${lastX.toFixed(1)} ${baseY.toFixed(1)} L ${firstX.toFixed(1)} ${baseY.toFixed(1)} Z`
  }, [pathD, chartWidth, chartHeight, padding.left, padding.top, validPoints.length])

  // Timestamps format helper
  const formatTime = (tsStr?: string) => {
    if (!tsStr) return ""
    try {
      const d = new Date(tsStr)
      if (selectedRange === "30d" || selectedRange === "7d") {
        return d.toLocaleDateString([], { month: "short", day: "numeric" })
      }
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } catch {
      return tsStr.slice(11, 16)
    }
  }

  const startTimeStr = validPoints[0]?.timestamp ? formatTime(validPoints[0].timestamp) : "T - " + selectedRange
  const endTimeStr = validPoints[validPoints.length - 1]?.timestamp
    ? formatTime(validPoints[validPoints.length - 1].timestamp)
    : "Now"

  const latestVal = values.length > 0 ? values[values.length - 1] : null
  const avgVal = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null

  return (
    <Card className="border-border bg-surface shadow-xs relative overflow-hidden flex flex-col font-mono">
      <CornerCrosshairs />
      <CardHeader className="pb-3 border-b border-border-subtle flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-sm font-semibold font-heading text-foreground flex items-center gap-2">
            <Activity className="size-4 text-brand" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription className="text-xs text-foreground-muted font-mono mt-0.5">
            {description}
          </CardDescription>
        </div>

        {latestVal !== null && (
          <div className="text-right">
            <span className="text-lg font-bold text-foreground">
              {latestVal.toFixed(1)} <span className="text-xs font-normal text-foreground-muted">{unit}</span>
            </span>
            {avgVal !== null && (
              <span className="block text-[10px] text-foreground-subtle">
                avg: {avgVal.toFixed(1)} {unit}
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-4 flex-1">
        {isLoading ? (
          <div className="h-[180px] flex items-center justify-center">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        ) : validPoints.length === 0 ? (
          <div className="h-[180px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-border-subtle rounded-lg text-foreground-muted text-xs">
            <Clock className="size-6 text-foreground-subtle mb-1.5" />
            <p className="text-foreground">No timeseries telemetry in this window</p>
            <p className="text-[11px] text-foreground-subtle mt-0.5">
              Traffic metrics will plot automatically as requests flow through the service.
            </p>
          </div>
        ) : (
          <div className="relative w-full">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible select-none">
              <defs>
                <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines */}
              {[0, 0.33, 0.66, 1].map((pct) => {
                const y = padding.top + chartHeight * pct
                const val = maxValue - pct * (maxValue - minValue)
                return (
                  <g key={pct}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={svgWidth - padding.right}
                      y2={y}
                      stroke="var(--border-subtle)"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <text
                      x={padding.left - 6}
                      y={y + 3}
                      fill="var(--foreground-subtle)"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {val.toFixed(0)}
                    </text>
                  </g>
                )
              })}

              {/* Area fill */}
              {areaD && <path d={areaD} fill={`url(#grad-${color})`} />}

              {/* Stroke path */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>

            {/* Time Axis Bounds */}
            <div className="flex justify-between items-center pt-2 font-mono text-[10px] text-foreground-subtle border-t border-border-subtle/50">
              <span>{startTimeStr}</span>
              <span className="text-sand uppercase">{selectedRange} Window</span>
              <span>{endTimeStr}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
