"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  Clock,
  AlertOctagon,
  ShieldCheck,
  Server,
  Zap,
  BarChart3,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/data-display/metric-card";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string }>;
}

export default function MonitoringOverviewPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const router = useRouter();
  const [granularity, setGranularity] = useState<"1m" | "5m" | "1h">("5m");

  // Query Overview Telemetry
  const { data: telemetry, isLoading: telemetryLoading, error, refetch } = useQuery({
    queryKey: queryKeys.monitoring.overview(orgId, projectId),
    queryFn: () =>
      fetchApi<{
        servicesCount: number;
        healthyServices: number;
        activeIncidents: number;
        summary: Schemas["MetricsSummary"];
      }>(`/api/v1/organizations/${orgId}/projects/${projectId}/monitoring/overview`),
    refetchInterval: 15000,
  });

  // Query Timeseries
  const { data: timeseriesData, isLoading: timeseriesLoading } = useQuery({
    queryKey: queryKeys.monitoring.timeseries(orgId, projectId, { metric: "rps", granularity }),
    queryFn: () =>
      fetchApi<{
        metric: string;
        granularity: string;
        points: { timestamp: string; value: number }[];
      }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/monitoring/timeseries?metric=rps&granularity=${granularity}`
      ),
    refetchInterval: 15000,
  });

  if (telemetryLoading || timeseriesLoading) {
    return <LoadingState message="Connecting to telemetry ingestion stream..." />;
  }

  if (error || !telemetry) {
    return (
      <ErrorState
        title="Failed to load telemetry"
        description={(error as any)?.message || "Could not retrieve project monitoring stream."}
        onRetry={refetch}
      />
    );
  }

  const summary = telemetry.summary;
  const chartPoints = (timeseriesData?.points || []).map((pt) => ({
    time: new Date(pt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    rps: pt.value,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Live Observability"
        description="Continuous request telemetry, p95 latency percentiles, and automated incident monitoring."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/app/organizations/${orgId}/projects/${projectId}/monitoring/traces`)}
              className="gap-1.5 text-xs"
            >
              <Activity className="size-3.5" />
              <span>Distributed Traces</span>
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`/app/organizations/${orgId}/projects/${projectId}/monitoring/metrics`)}
              className="gap-1.5 text-xs"
            >
              <BarChart3 className="size-3.5" />
              <span>Metrics Explorer</span>
            </Button>
          </div>
        }
      />

      {/* Observability Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Throughput Rate"
          value={`${summary.rps.toFixed(1)} req/s`}
          helperText={`${summary.totalRequests.toLocaleString()} total requests logged`}
          icon={Activity}
        />
        <MetricCard
          title="p95 Latency"
          value={`${summary.p95Ms.toFixed(1)} ms`}
          helperText={`p50: ${summary.p50Ms.toFixed(1)}ms • p99: ${summary.p99Ms.toFixed(1)}ms`}
          icon={Clock}
        />
        <MetricCard
          title="Error Rate"
          value={`${(summary.errorRate * 100).toFixed(2)}%`}
          helperText={`${(summary.successRate * 100).toFixed(2)}% availability SLA`}
          icon={AlertOctagon}
        />
        <MetricCard
          title="Service Health"
          value={`${telemetry.healthyServices} / ${telemetry.servicesCount}`}
          helperText={telemetry.activeIncidents ? `${telemetry.activeIncidents} active incidents` : "All microservices healthy"}
          icon={ShieldCheck}
        />
      </div>

      {/* Real-Time Throughput Timeseries Chart */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="size-4 text-brand" />
              <span>Request Volume &amp; Throughput Over Time</span>
            </h3>
            <p className="text-xs text-muted-foreground">Aggregated incoming requests per second</p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-muted/50 p-1">
            {(["1m", "5m", "1h"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`rounded px-2.5 py-1 text-xs font-mono font-medium transition-colors ${
                  granularity === g
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="rpsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
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
              <Area
                type="monotone"
                dataKey="rps"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#rpsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Subdomain Explorers Navigation */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href={`/app/organizations/${orgId}/projects/${projectId}/monitoring/traces`}
          className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-brand/40 hover:bg-surface-muted/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Activity className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground group-hover:text-brand">
                Distributed Traces
              </div>
              <div className="text-xs text-muted-foreground">Waterfall span latency &amp; call trees</div>
            </div>
          </div>
        </Link>

        <Link
          href={`/app/organizations/${orgId}/projects/${projectId}/monitoring/errors`}
          className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-brand/40 hover:bg-surface-muted/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
              <AlertOctagon className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground group-hover:text-brand">
                Error Breakdown
              </div>
              <div className="text-xs text-muted-foreground">HTTP 5xx status distribution &amp; stack dumps</div>
            </div>
          </div>
        </Link>

        <Link
          href={`/app/organizations/${orgId}/projects/${projectId}/monitoring/resources`}
          className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-brand/40 hover:bg-surface-muted/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <Cpu className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground group-hover:text-brand">
                Host Resources
              </div>
              <div className="text-xs text-muted-foreground">CPU, Memory footprint, instance health</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
