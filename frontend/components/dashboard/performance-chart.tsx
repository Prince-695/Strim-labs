"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { LineChart as ChartIcon, Info } from "lucide-react"
import { api, type ApiResponse } from "@/lib/api-client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export type MetricType = "rps" | "p95" | "error_rate" | "requests"
export type RangeType = "15m" | "1h" | "6h" | "24h"

interface PerformanceChartProps {
  orgId: string
  projectId: string
}

interface TimeseriesResponse {
  metric: string
  unit: string
  step: string
  series: {
    key: string
    points: [string, number | null][]
  }[]
}

const SVG_WIDTH = 720
const SVG_HEIGHT = 220
const PADDING = { top: 20, right: 20, bottom: 30, left: 45 }
const CHART_WIDTH = SVG_WIDTH - PADDING.left - PADDING.right
const CHART_HEIGHT = SVG_HEIGHT - PADDING.top - PADDING.bottom
const MIN_VALUE = 0

export function PerformanceChart({ orgId, projectId }: PerformanceChartProps) {
  const [metric, setMetric] = React.useState<MetricType>("rps")
  const [range, setRange] = React.useState<RangeType>("1h")
  const [hoveredPoint, setHoveredPoint] = React.useState<{ x: number; y: number; time: string; value: number } | null>(null)

  const { data: timeseriesResponse, isLoading } = useQuery<ApiResponse<TimeseriesResponse>>({
    queryKey: ["metrics_timeseries", orgId, projectId, metric, range],
    queryFn: async () => {
      return api.get<TimeseriesResponse>(
        `/organizations/${orgId}/projects/${projectId}/metrics/timeseries?metric=${metric}&range=${range}`
      )
    },
    enabled: Boolean(orgId && projectId),
  })

  // Clean data points: parse timestamp and filter valid values
  const points = React.useMemo(() => {
    const raw = timeseriesResponse?.data?.series?.[0]?.points || []
    return raw
      .map(([ts, val]) => ({
        timestamp: new Date(ts),
        timeString: new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        value: val !== null ? val : 0,
        isNull: val === null,
      }))
      .filter((p) => !isNaN(p.timestamp.getTime()))
  }, [timeseriesResponse])

  const maxValue = React.useMemo(() => {
    if (points.length === 0) return 10
    const max = Math.max(...points.map((p) => p.value))
    return max > 0 ? max * 1.15 : 10
  }, [points])

  const getX = React.useCallback((index: number, count: number) => {
    if (count <= 1) return PADDING.left
    return PADDING.left + (index / (count - 1)) * CHART_WIDTH
  }, [])

  const getY = React.useCallback((val: number, max: number) => {
    return PADDING.top + CHART_HEIGHT - ((val - MIN_VALUE) / (max - MIN_VALUE)) * CHART_HEIGHT
  }, [])

  // Build SVG path
  const pathD = React.useMemo(() => {
    if (points.length === 0) return ""
    return points.reduce((acc, point, index) => {
      const x = getX(index, points.length)
      const y = getY(point.value, maxValue)
      return `${acc} ${index === 0 ? "M" : "L"} ${x} ${y}`
    }, "")
  }, [points, maxValue, getX, getY])

  const areaD = React.useMemo(() => {
    if (points.length === 0) return ""
    const firstX = getX(0, points.length)
    const lastX = getX(points.length - 1, points.length)
    const bottomY = PADDING.top + CHART_HEIGHT
    return `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
  }, [pathD, points.length, getX])

  const metricMeta = {
    rps: { label: "Throughput (RPS)", stroke: "#2F6BFF", fill: "url(#gradient-blue)", unit: "RPS" },
    p95: { label: "P95 Tail Latency", stroke: "#E6AD55", fill: "url(#gradient-amber)", unit: "ms" },
    error_rate: { label: "Error Rate", stroke: "#EF6464", fill: "url(#gradient-red)", unit: "%" },
    requests: { label: "Total Requests", stroke: "#35B779", fill: "url(#gradient-green)", unit: "reqs" },
  }[metric]

  return (
    <Card className="border-border bg-surface shadow-xs">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="flex items-center gap-2.5">
          <ChartIcon className="size-4 text-brand" />
          <div>
            <CardTitle className="text-sm font-semibold font-heading text-foreground">
              Performance Trend
            </CardTitle>
            <p className="text-xs text-foreground-muted font-mono">
              Observed {metricMeta.label} over {range}
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Selector Tabs */}
          <div className="inline-flex rounded-md border border-border-subtle bg-surface-raised p-0.5 font-mono text-xs">
            <button
              onClick={() => setMetric("rps")}
              className={`rounded px-2.5 py-1 transition-colors ${
                metric === "rps" ? "bg-brand text-white font-medium" : "text-foreground-muted hover:text-foreground"
              }`}
            >
              RPS
            </button>
            <button
              onClick={() => setMetric("p95")}
              className={`rounded px-2.5 py-1 transition-colors ${
                metric === "p95" ? "bg-warning text-black font-medium" : "text-foreground-muted hover:text-foreground"
              }`}
            >
              P95
            </button>
            <button
              onClick={() => setMetric("error_rate")}
              className={`rounded px-2.5 py-1 transition-colors ${
                metric === "error_rate" ? "bg-danger text-white font-medium" : "text-foreground-muted hover:text-foreground"
              }`}
            >
              Errors
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="inline-flex rounded-md border border-border-subtle bg-surface-raised p-0.5 font-mono text-xs">
            {(["15m", "1h", "6h", "24h"] as RangeType[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded px-2 py-1 transition-colors ${
                  range === r ? "bg-surface text-sand font-medium" : "text-foreground-subtle hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {isLoading ? (
          <div className="h-[220px] flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        ) : points.length === 0 ? (
          <div className="h-[220px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-border-subtle rounded-lg">
            <Info className="size-6 text-foreground-subtle mb-2" />
            <p className="text-sm font-medium text-foreground">No Timeseries Data</p>
            <p className="text-xs text-foreground-muted mt-1 max-w-sm">
              Telemetry has not been recorded for this project in the selected {range} window.
            </p>
          </div>
        ) : (
          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full h-auto overflow-visible select-none"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id="gradient-blue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2F6BFF" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#2F6BFF" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="gradient-amber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E6AD55" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#E6AD55" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="gradient-red" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF6464" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#EF6464" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="gradient-green" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#35B779" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#35B779" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const y = PADDING.top + CHART_HEIGHT * pct
                const val = maxValue - pct * (maxValue - MIN_VALUE)
                return (
                  <g key={pct}>
                    <line
                      x1={PADDING.left}
                      y1={y}
                      x2={SVG_WIDTH - PADDING.right}
                      y2={y}
                      stroke="#34342F"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={PADDING.left - 8}
                      y={y + 4}
                      fill="#77766F"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {metric === "error_rate" ? `${(val * 100).toFixed(1)}%` : val.toFixed(0)}
                    </text>
                  </g>
                )
              })}

              {/* Area Gradient */}
              <path d={areaD} fill={metricMeta.fill} />

              {/* Line Curve */}
              <path
                d={pathD}
                fill="none"
                stroke={metricMeta.stroke}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive Hit Area Circles */}
              {points.map((point, index) => {
                const x = getX(index, points.length)
                const y = getY(point.value, maxValue)
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r={hoveredPoint?.time === point.timeString ? 5 : 3}
                    fill={hoveredPoint?.time === point.timeString ? "#FFFFFF" : metricMeta.stroke}
                    className="cursor-pointer transition-all"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        x,
                        y,
                        time: point.timeString,
                        value: point.value,
                      })
                    }
                  />
                )
              })}

              {/* X Axis Ticks */}
              {points.length > 0 && (
                <>
                  <text
                    x={PADDING.left}
                    y={SVG_HEIGHT - 8}
                    fill="#77766F"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {points[0].timeString}
                  </text>
                  <text
                    x={SVG_WIDTH - PADDING.right}
                    y={SVG_HEIGHT - 8}
                    fill="#77766F"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {points[points.length - 1].timeString}
                  </text>
                </>
              )}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredPoint && (
              <div
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-surface-raised px-2.5 py-1.5 shadow-xl font-mono text-xs"
                style={{
                  left: `${(hoveredPoint.x / SVG_WIDTH) * 100}%`,
                  top: `${(hoveredPoint.y / SVG_HEIGHT) * 100}%`,
                  transform: "translate(-50%, -120%)",
                }}
              >
                <p className="text-[10px] text-foreground-subtle">{hoveredPoint.time}</p>
                <p className="font-bold text-foreground">
                  {metric === "error_rate"
                    ? `${(hoveredPoint.value * 100).toFixed(2)}%`
                    : hoveredPoint.value.toFixed(1)}{" "}
                  <span className="font-normal text-sand">{metricMeta.unit}</span>
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
