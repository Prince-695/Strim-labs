"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  BarChart3,
  Calendar,
  Clock,
  ArrowLeft,
  Filter,
  Download,
  Activity,
  Layers,
} from "lucide-react";
import { fetchApi, queryKeys } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string }>;
}

export default function MetricsExplorerPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const router = useRouter();

  const [selectedMetric, setSelectedMetric] = useState<"rps" | "latency" | "errors">("rps");
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h" | "7d">("1h");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.monitoring.timeseries(orgId, projectId, { metric: selectedMetric, timeRange }),
    queryFn: () =>
      fetchApi<{
        metric: string;
        granularity: string;
        points: { timestamp: string; value: number }[];
      }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/monitoring/timeseries?metric=${selectedMetric}&granularity=1m`
      ),
    refetchInterval: 15000,
  });

  if (isLoading) return <LoadingState message="Querying telemetry timeseries database..." />;

  if (error || !data) {
    return (
      <ErrorState
        title="Failed to load timeseries"
        description={(error as any)?.message || "Could not retrieve metric data."}
        onRetry={refetch}
      />
    );
  }

  const chartData = data.points.map((pt) => ({
    time: new Date(pt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    value: pt.value,
    baseline: Math.round(pt.value * 0.9),
  }));

  const values = data.points.map((p) => p.value);
  const minVal = values.length ? Math.min(...values) : 0;
  const maxVal = values.length ? Math.max(...values) : 0;
  const avgVal = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/app/organizations/${orgId}/projects/${projectId}/monitoring`)}
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>Observability Overview</span>
        </Button>
      </div>

      <PageHeader
        title="Metrics Explorer"
        description="Deep-dive telemetry analysis across response throughput, latency distributions, and saturation signals."
      />

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        {/* Metric Selector */}
        <div className="flex items-center gap-1">
          {[
            { id: "rps", label: "Throughput (RPS)" },
            { id: "latency", label: "p95 Latency (ms)" },
            { id: "errors", label: "Error Rate (%)" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMetric(m.id as any)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedMetric === m.id
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-muted/50 p-1">
          {(["1h", "6h", "24h", "7d"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`rounded px-2.5 py-1 text-xs font-mono font-medium transition-colors ${
                timeRange === range
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Minimum Observed</div>
          <div className="mt-1 font-mono text-xl font-bold text-foreground">
            {minVal} {selectedMetric === "rps" ? "req/s" : selectedMetric === "latency" ? "ms" : "%"}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Average</div>
          <div className="mt-1 font-mono text-xl font-bold text-brand">
            {avgVal} {selectedMetric === "rps" ? "req/s" : selectedMetric === "latency" ? "ms" : "%"}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Peak Maximum</div>
          <div className="mt-1 font-mono text-xl font-bold text-amber-500">
            {maxVal} {selectedMetric === "rps" ? "req/s" : selectedMetric === "latency" ? "ms" : "%"}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-sm font-semibold text-foreground">
            {selectedMetric.toUpperCase()} Timeseries Progression ({timeRange})
          </h3>
          <span className="font-mono text-xs text-muted-foreground">Live Telemetry (15s poll)</span>
        </div>

        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="time" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#f4f4f5",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
              <Line
                type="monotone"
                dataKey="value"
                name="Measured Value"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="baseline"
                name="P90 Baseline"
                stroke="#71717a"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
