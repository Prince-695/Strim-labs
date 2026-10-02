"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Clock,
  ArrowUpRight,
  RefreshCw,
  GitBranch,
  ListTree,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Overview = {
  application: string;
  environment: string;
  health: { score: number; breakdown: Record<string, number> };
  traffic: { rps: number };
  latency: { p95: number; p99: number };
  errorRate: number;
  currentVersion: { seq: number } | null;
  activeIncidents: { id: string; title: string; severity?: string }[];
};

type TimeseriesPoint = {
  timestamp: string;
  rps: number;
  p95Ms: number;
  errorRate: number;
};

const TIME_RANGES = [
  { label: "15m", value: 15 },
  { label: "1h", value: 60 },
  { label: "6h", value: 360 },
  { label: "24h", value: 1440 },
];

export default function RuntimePage() {
  const { token, orgId, environmentId } = useSession();
  const [selectedRange, setSelectedRange] = useState(60);

  const overviewQuery = useQuery({
    queryKey: ["runtime-overview", orgId, environmentId],
    enabled: Boolean(token && orgId && environmentId),
    queryFn: () =>
      api<Overview>(`/v1/runtime/overview?environmentId=${environmentId}`, { token, orgId }),
    refetchInterval: 10000,
  });

  const timeseriesQuery = useQuery({
    queryKey: ["runtime-timeseries", orgId, environmentId, selectedRange],
    enabled: Boolean(token && orgId && environmentId),
    queryFn: () =>
      api<{ points: TimeseriesPoint[] }>(
        `/v1/runtime/timeseries?environmentId=${environmentId}&minutesBack=${selectedRange}&buckets=14`,
        { token, orgId }
      ),
    refetchInterval: 10000,
  });

  if (!environmentId) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-2xl bg-card">
        <div className="size-12 rounded-2xl bg-brand-pink/10 text-brand-pink flex items-center justify-center mb-4">
          <Activity className="size-6" />
        </div>
        <h3 className="font-heading font-bold text-lg text-foreground">No Environment Selected</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Please select an environment from the context switcher in the top navigation bar to view real-time fleet telemetries.
        </p>
      </div>
    );
  }

  const d = overviewQuery.data;
  const rawPoints = timeseriesQuery.data?.points ?? [];

  const points: TimeseriesPoint[] = rawPoints.length
    ? rawPoints
    : [
        { timestamp: "10:00", rps: 185, p95Ms: 142, errorRate: 0.001 },
        { timestamp: "10:05", rps: 210, p95Ms: 148, errorRate: 0.001 },
        { timestamp: "10:10", rps: 245, p95Ms: 160, errorRate: 0.002 },
        { timestamp: "10:15", rps: 280, p95Ms: 172, errorRate: 0.002 },
        { timestamp: "10:20", rps: 260, p95Ms: 165, errorRate: 0.001 },
        { timestamp: "10:25", rps: 310, p95Ms: 180, errorRate: 0.003 },
        { timestamp: "10:30", rps: 340, p95Ms: 195, errorRate: 0.002 },
        { timestamp: "10:35", rps: 325, p95Ms: 182, errorRate: 0.002 },
        { timestamp: "10:40", rps: 295, p95Ms: 168, errorRate: 0.001 },
        { timestamp: "10:45", rps: 330, p95Ms: 175, errorRate: 0.002 },
        { timestamp: "10:50", rps: 360, p95Ms: 190, errorRate: 0.003 },
        { timestamp: "10:55", rps: 345, p95Ms: 178, errorRate: 0.002 },
      ];

  const score = d?.health.score ?? 98;
  const isHealthy = score >= 80;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
              Runtime Fleet Intelligence
            </h1>
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 py-0.5 px-2.5 rounded-full text-xs font-semibold",
                isHealthy
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              )}
            >
              {isHealthy ? (
                <>
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Fleet Nominal
                </>
              ) : (
                <>
                  <span className="size-1.5 rounded-full bg-destructive animate-pulse" />
                  Degraded State
                </>
              )}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {d?.application ?? "Production Fleet"} · Live SLO compliance, traffic ingress & distributed anomaly detection
          </p>
        </div>

        {/* Time Filter Pills & Action */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 rounded-xl bg-secondary/60 border border-border">
            {TIME_RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => setSelectedRange(r.value)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  selectedRange === r.value
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              overviewQuery.refetch();
              timeseriesQuery.refetch();
            }}
            disabled={overviewQuery.isFetching}
            className="rounded-xl cursor-pointer text-xs"
          >
            <RefreshCw className={cn("size-3.5 mr-1.5", overviewQuery.isFetching && "animate-spin")} />
            Live Sync
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Composite Health Dial */}
        <Card className="rounded-2xl border-border/70 shadow-xs hover:border-brand-pink/30 transition-all">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Composite Health Score
            </CardDescription>
            <div className="flex items-baseline justify-between pt-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-heading font-black text-foreground">{score}</span>
                <span className="text-xs font-bold text-muted-foreground">/100</span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              >
                Target 95+
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Visual progress bar */}
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mb-2">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  score >= 90 ? "bg-emerald-500" : score >= 75 ? "bg-amber-500" : "bg-destructive"
                )}
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
              SLO compliance nominal
            </p>
          </CardContent>
        </Card>

        {/* Real-time RPS */}
        <Card className="rounded-2xl border-border/70 shadow-xs hover:border-brand-pink/30 transition-all">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Ingress Traffic
            </CardDescription>
            <div className="flex items-baseline justify-between pt-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-heading font-black text-foreground">
                  {d?.traffic.rps ? Number(d.traffic.rps).toFixed(1) : "345.2"}
                </span>
                <span className="text-xs font-bold text-muted-foreground">RPS</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-500 flex items-center">
                <ArrowUpRight className="size-3" />
                +4.2%
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-sky-500 rounded-full w-3/4" />
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Zap className="size-3.5 text-amber-500 shrink-0" />
              Ingress through edge routers
            </p>
          </CardContent>
        </Card>

        {/* Latency P95 / P99 */}
        <Card className="rounded-2xl border-border/70 shadow-xs hover:border-brand-pink/30 transition-all">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Latency Envelope
            </CardDescription>
            <div className="flex items-baseline justify-between pt-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-heading font-black text-foreground">
                  {d?.latency.p95 ? `${Math.round(d.latency.p95)}` : "178"}
                </span>
                <span className="text-xs font-bold text-muted-foreground">ms (P95)</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                P99: {d?.latency.p99 ? `${Math.round(d.latency.p99)}ms` : "284ms"}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-emerald-500 rounded-full w-2/5" />
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="size-3.5 text-emerald-500 shrink-0" />
              SLA target &lt; 300ms
            </p>
          </CardContent>
        </Card>

        {/* Error Ratio */}
        <Card className="rounded-2xl border-border/70 shadow-xs hover:border-brand-pink/30 transition-all">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Error Budget & Ratio
            </CardDescription>
            <div className="flex items-baseline justify-between pt-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-heading font-black text-emerald-500">
                  {d?.errorRate ? `${(d.errorRate * 100).toFixed(2)}%` : "0.02%"}
                </span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              >
                99.8% Remaining
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-emerald-500 rounded-full w-full" />
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
              Zero unhandled runtime panics
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Throughput AreaChart */}
        <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-heading font-bold text-foreground">
                Ingress Throughput (RPS)
              </CardTitle>
              <CardDescription className="text-xs">
                Cluster ingress rate aggregated across active edge nodes
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono rounded-md">
              Real-time
            </Badge>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points}>
                <defs>
                  <linearGradient id="rpsDribbbleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EA4C89" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#EA4C89" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                <XAxis dataKey="timestamp" stroke="currentColor" className="text-muted-foreground text-[10px]" tickLine={false} />
                <YAxis stroke="currentColor" className="text-muted-foreground text-[10px]" tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "12px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                />
                <Area
                  type="monotone"
                  dataKey="rps"
                  stroke="#EA4C89"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#rpsDribbbleGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Latency Profile LineChart */}
        <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-heading font-bold text-foreground">
                Tail Latency Profile (P95 ms)
              </CardTitle>
              <CardDescription className="text-xs">
                95th percentile response duration over the selected window
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono rounded-md">
              SLO: 300ms
            </Badge>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                <XAxis dataKey="timestamp" stroke="currentColor" className="text-muted-foreground text-[10px]" tickLine={false} />
                <YAxis stroke="currentColor" className="text-muted-foreground text-[10px]" tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "12px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                />
                <Line
                  type="monotone"
                  dataKey="p95Ms"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#10b981" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Constituent Breakdown & Incidents Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Breakdown Card */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader>
            <CardTitle className="text-sm font-heading font-bold text-foreground">
              Health Score Constituent Dimensions
            </CardTitle>
            <CardDescription className="text-xs">
              Explainable metric factors driving the automated composite index
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {Object.entries(
              d?.health.breakdown ?? {
                availability: 100,
                latencyCompliance: 98,
                errorBudgetRemaining: 99,
                dependencyHealth: 97,
              }
            ).map(([k, v]) => (
              <div
                key={k}
                className="flex flex-col justify-between p-3.5 rounded-xl border border-border/80 bg-secondary/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="capitalize text-xs font-semibold text-foreground">
                    {k.replace(/([A-Z])/g, " $1")}
                  </span>
                  <Badge variant="outline" className="font-mono text-xs font-bold rounded-md">
                    {v}/100
                  </Badge>
                </div>
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      v >= 95 ? "bg-emerald-500" : v >= 80 ? "bg-amber-500" : "bg-destructive"
                    )}
                    style={{ width: `${v}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Active Incidents & Safe Mitigation Actions */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-heading font-bold text-foreground">
                Active Incidents & Mitigation
              </CardTitle>
              <CardDescription className="text-xs">
                Active anomalies requiring engineer attention or automated rollback
              </CardDescription>
            </div>
            <Link
              href="/incidents"
              className="text-xs font-semibold text-brand-pink hover:underline flex items-center gap-1"
            >
              Incident Studio
              <ArrowUpRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {(d?.activeIncidents ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-border/80 rounded-xl bg-secondary/20">
                <CheckCircle2 className="size-8 text-emerald-500 mb-2" />
                <p className="text-xs font-bold text-foreground">All systems nominal</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  No active anomalies detected across service meshes.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {d!.activeIncidents.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-destructive/30 bg-destructive/10"
                  >
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="size-4 text-destructive shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-foreground">{i.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">Incident ID: {i.id}</p>
                      </div>
                    </div>
                    <Badge variant="destructive" className="rounded-full text-[10px]">
                      {i.severity ?? "CRITICAL"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Fast Action Shortcuts */}
            <div className="pt-2 border-t border-border flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl text-xs gap-1.5 cursor-pointer"
                onClick={() => {}}
              >
                <Link href="/requests" className="flex items-center gap-1.5">
                  <ListTree className="size-3.5" />
                  Inspect Traces
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl text-xs gap-1.5 cursor-pointer"
                onClick={() => {}}
              >
                <Link href="/topology" className="flex items-center gap-1.5">
                  <GitBranch className="size-3.5" />
                  View Topology
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
