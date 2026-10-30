"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  Play,
  Square,
  Copy,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
  Layers,
  Target,
  TrendingUp,
  Loader2,
  Download,
  AlertOctagon,
  Gauge,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HttpMethodBadge } from "@/components/data-display/http-method-badge";
import { MetricCard } from "@/components/data-display/metric-card";
import { PageHeader } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string; testId: string }>;
}

export default function LoadTestExecutionPage({ params }: PageProps) {
  const { orgId, projectId, testId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "errors">("overview");

  // Query Test Run Details (polls rapidly if running)
  const {
    data: run,
    isLoading: runLoading,
    error: runError,
    refetch: refetchRun,
  } = useQuery({
    queryKey: queryKeys.loadTests.detail(orgId, projectId, testId),
    queryFn: () =>
      fetchApi<Schemas["TestRun"]>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/load-tests/${testId}`
      ),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "RUNNING" || status === "QUEUED" ? 2000 : false;
    },
  });

  // Query Breaking Point Diagnostics
  const { data: diagnostics } = useQuery({
    queryKey: queryKeys.loadTests.diagnostics(orgId, projectId, testId),
    enabled: Boolean(run?.status === "COMPLETED"),
    queryFn: () =>
      fetchApi<Schemas["BreakingPoint"]>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/diagnostics`
      ).catch(() => null),
  });

  // Query Timeline Samples
  const { data: timelineData } = useQuery({
    queryKey: queryKeys.loadTests.timeline(orgId, projectId, testId),
    queryFn: () =>
      fetchApi<Schemas["TestSample"][]>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/timeline`
      ).catch(() => []),
    refetchInterval: run?.status === "RUNNING" ? 3000 : false,
  });

  // Query Errors Analysis
  const { data: errorsData } = useQuery({
    queryKey: queryKeys.loadTests.errors(orgId, projectId, testId),
    queryFn: () =>
      fetchApi<Schemas["TestErrors"]>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/errors`
      ).catch(() => null),
  });

  // Start Test Mutation
  const startMutation = useMutation({
    mutationFn: () =>
      fetchApi<{ testRun: Schemas["TestRun"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/start`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.loadTests.detail(orgId, projectId, testId),
      });
    },
  });

  // Abort Test Mutation
  const abortMutation = useMutation({
    mutationFn: () =>
      fetchApi<{ ok: boolean }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/cancel`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.loadTests.detail(orgId, projectId, testId),
      });
    },
  });

  if (runLoading) return <LoadingState message="Loading benchmark execution telemetry..." />;

  if (runError || !run) {
    return (
      <ErrorState
        title="Test run not found"
        description={(runError as any)?.message || "Could not retrieve test details."}
        onRetry={refetchRun}
      />
    );
  }

  const samples = timelineData || [];
  const chartPoints = samples.map((s, idx) => ({
    time: `${idx * 2}s`,
    rps: s.rps,
    p95: s.p95Ms,
    errors: s.errorCount,
  }));

  const isRunning = run.status === "RUNNING";
  const isQueued = run.status === "QUEUED";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/app/organizations/${orgId}/projects/${projectId}/load-tests`)}
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>All Load Tests</span>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <HttpMethodBadge method={run.method} />
            <h1 className="text-base font-bold text-foreground">{run.name}</h1>
            <Badge
              variant={
                run.status === "COMPLETED"
                  ? "default"
                  : run.status === "RUNNING"
                  ? "secondary"
                  : "destructive"
              }
              className={`font-mono text-xs ${isRunning ? "bg-amber-500 animate-pulse text-white" : ""}`}
            >
              {run.status}
            </Badge>
          </div>
          <div className="font-mono text-xs text-muted-foreground break-all">
            Target: <span className="text-foreground">{run.targetUrl}</span> • Profile:{" "}
            <span className="text-brand">{run.profile}</span> • {run.concurrency} VUs
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isQueued && (
            <Button
              size="sm"
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate()}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {startMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              <span>Start Execution</span>
            </Button>
          )}

          {isRunning && (
            <Button
              size="sm"
              variant="destructive"
              disabled={abortMutation.isPending}
              onClick={() => abortMutation.mutate()}
              className="gap-1.5"
            >
              {abortMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Square className="size-4" />
              )}
              <span>Abort Test</span>
            </Button>
          )}
        </div>
      </div>

      {/* Running Pulse Banner */}
      {isRunning && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs font-mono text-amber-200 animate-pulse">
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-amber-400" />
            <span>Distributed load generator running. Polling live metrics every 2 seconds...</span>
          </div>
        </div>
      )}

      {/* Breaking Point Verdict Card */}
      {diagnostics && (
        <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="size-5 text-purple-400" />
              <h3 className="text-sm font-bold text-foreground">
                Breaking Point Detected: {diagnostics.kneeRps.toFixed(1)} RPS
              </h3>
            </div>
            <Badge tone="brand" className="bg-purple-600 font-mono text-[10px]">
              {diagnostics.zone}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Sustainable throughput is <span className="font-bold text-foreground font-mono">{diagnostics.sustainableRps.toFixed(1)} RPS</span>,
            with failure point reached at <span className="font-bold text-purple-300 font-mono">{diagnostics.failureRps.toFixed(1)} RPS</span>,
            constrained primarily by <span className="font-semibold text-foreground">{diagnostics.bottleneck}</span>.
          </p>
          {diagnostics.verdict && (
            <div className="rounded-lg bg-surface-muted/60 p-3 text-xs text-muted-foreground border border-border/60">
              <span className="font-semibold text-foreground">Verdict & Remediation: </span>
              {diagnostics.verdict}
            </div>
          )}
        </div>
      )}

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Average Throughput"
          value={run.avgRps ? `${run.avgRps.toFixed(1)} req/s` : "—"}
          helperText={run.peakRps ? `Peak: ${run.peakRps.toFixed(1)} req/s` : "0 req/s"}
          icon={Activity}
        />
        <MetricCard
          title="p95 Latency"
          value={run.p95Ms ? `${run.p95Ms.toFixed(1)} ms` : "—"}
          helperText={run.p50Ms ? `p50: ${run.p50Ms.toFixed(1)}ms • p99: ${run.p99Ms.toFixed(1)}ms` : "No samples"}
          icon={Clock}
        />
        <MetricCard
          title="Total Requests Logged"
          value={run.totalRequests ? run.totalRequests.toLocaleString() : "0"}
          helperText={`Planned window: ${run.durationSec}s`}
          icon={TrendingUp}
        />
        <MetricCard
          title="Error Rate"
          value={run.errorRate !== undefined && run.errorRate !== null ? `${(run.errorRate * 100).toFixed(2)}%` : "0.00%"}
          helperText={run.errorRate > 0.01 ? "Service degradation observed" : "100% successful requests"}
          icon={AlertOctagon}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("overview")}
          className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
            activeTab === "overview"
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Performance Timeline Chart
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
            activeTab === "timeline"
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Sample Intervals ({samples.length})
        </button>
        <button
          onClick={() => setActiveTab("errors")}
          className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
            activeTab === "errors"
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Failure Analysis
        </button>
      </div>

      {/* Overview Chart Tab */}
      {activeTab === "overview" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="size-4 text-brand" />
              <span>Throughput vs. Latency Progression</span>
            </h3>
            <span className="font-mono text-xs text-muted-foreground">Recorded Telemetry Samples</span>
          </div>

          {chartPoints.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
              No telemetry timeline points recorded yet. Launch the test to record live samples.
            </div>
          ) : (
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="time" stroke="#71717a" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#6366f1" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#eab308" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#f4f4f5",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="rps"
                    name="Throughput (RPS)"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="p95"
                    name="p95 Latency (ms)"
                    stroke="#eab308"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Samples Table Tab */}
      {activeTab === "timeline" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Timestamp</TH>
                <TH>RPS</TH>
                <TH>p50 Latency</TH>
                <TH>p95 Latency</TH>
                <TH>p99 Latency</TH>
                <TH>Error Count</TH>
              </TR>
            </THead>
            <TBody>
              {samples.map((s, idx) => (
                <TR key={idx}>
                  <TD className="text-xs font-mono text-muted-foreground">
                    {new Date(s.timestamp).toLocaleTimeString()}
                  </TD>
                  <TD className="text-xs font-mono font-semibold text-foreground">
                    {s.rps.toFixed(1)} req/s
                  </TD>
                  <TD className="text-xs font-mono text-foreground">{s.p50Ms.toFixed(1)} ms</TD>
                  <TD className="text-xs font-mono text-foreground">{s.p95Ms.toFixed(1)} ms</TD>
                  <TD className="text-xs font-mono text-foreground">{s.p99Ms.toFixed(1)} ms</TD>
                  <TD className="text-xs font-mono text-foreground">{s.errorCount}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {/* Errors Tab */}
      {activeTab === "errors" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Failure Analysis</h3>
          {errorsData ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Total Failed Requests:</span>
                <span className="text-destructive font-bold">{errorsData.totalErrors}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Error Rate:</span>
                <span className="text-destructive font-bold">{(errorsData.errorRate * 100).toFixed(2)}%</span>
              </div>
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status Code Breakdown:</span>
                {Object.entries(errorsData.statusCodes || {}).map(([code, count]) => (
                  <div key={code} className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground font-mono">HTTP {code}:</span>
                    <span className="text-foreground font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No errors observed during execution.</p>
          )}
        </div>
      )}
    </div>
  );
}
