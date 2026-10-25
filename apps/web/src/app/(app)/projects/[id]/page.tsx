"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  Key,
  Layers,
  Play,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { fmtDateTime, fmtMs, fmtRps } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { useDiscoveredRoutes, useProjectObservability } from "@/lib/queries";
import { useSession } from "@/lib/session";
import type { DiscoveredRoute } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default function ProjectObservabilityPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params?.id;
  const { projects } = useSession();

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const { data: obs, isLoading: obsLoading, refetch: refetchObs } = useProjectObservability(projectId);
  const { data: routes, isLoading: routesLoading } = useDiscoveredRoutes(projectId);

  const [copiedKey, setCopiedKey] = useState(false);

  const isPending = project?.status === "PENDING_SDK";
  const passRatio = obs?.passRatio ?? 100;
  const failRatio = obs?.failRatio ?? 0;
  const bp = obs?.latestBreakpoint;

  const copyApiKey = () => {
    if (!project?.apiKey) return;
    navigator.clipboard.writeText(project.apiKey);
    setCopiedKey(true);
    toast.success("API Key copied to clipboard");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Pending SDK Setup Alert Banner */}
      {isPending && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
                <Radio className="size-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Awaiting Telemetry from @strim/sdk
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Install the STRIM SDK in your server code to start streaming real-time production telemetry and auto-discovering routes.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="rounded bg-surface-muted px-2 py-0.5 font-mono text-[11px]">
                    npm install @strim/sdk
                  </code>
                  <span className="text-xs text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={copyApiKey}
                    className="flex items-center gap-1 font-mono text-xs text-brand hover:underline"
                  >
                    <Key className="size-3" /> Copy Project API Key
                  </button>
                </div>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                fetch("http://localhost:8080/v1/ingest", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-strim-key": project?.apiKey || "",
                  },
                  body: JSON.stringify({
                    events: [
                      { method: "GET", path: "/api/health", statusCode: 200, durationMs: 24 },
                      { method: "POST", path: "/api/orders", statusCode: 200, durationMs: 65 },
                      { method: "GET", path: "/api/users/profile", statusCode: 200, durationMs: 48 },
                    ],
                  }),
                }).then(() => {
                  refetchObs();
                  toast.success("Test telemetry event sent!");
                });
              }}
            >
              <Zap className="size-3.5 text-warning" /> Send Test Telemetry Ping
            </Button>
          </div>
        </Card>
      )}

      {/* Top 4 Real-time Observability Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Production Health Flag */}
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Production Health</span>
            <Activity className="size-4 text-emerald-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {isPending ? "Pending SDK" : passRatio >= 98 ? "100% Healthy" : "Degraded"}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`size-2 rounded-full ${
                isPending
                  ? "bg-neutral-400"
                  : passRatio >= 98
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-rose-500"
              }`}
            />
            <span>
              {isPending
                ? "Awaiting first batch"
                : `${obs?.totalRequests || 0} requests monitored (24h)`}
            </span>
          </div>
        </Card>

        {/* Card 2: Pass/Fail Ratio */}
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Pass / Fail Ratio</span>
            <ShieldCheck className="size-4 text-brand" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {passRatio}%
            </span>
            <span className="font-mono text-xs text-muted-foreground">Passing</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-emerald-500">
              2xx: {obs?.totalSuccess ?? 0}
            </span>
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-amber-500">
              4xx: {obs?.totalWarning ?? 0}
            </span>
            <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-rose-500">
              5xx: {obs?.totalError ?? 0}
            </span>
          </div>
        </Card>

        {/* Card 3: Latency Baseline */}
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>P95 Response Latency</span>
            <Clock className="size-4 text-warning" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {obs?.avgP95Ms ? `${obs.avgP95Ms}` : "42"}
            </span>
            <span className="font-mono text-xs text-muted-foreground">ms</span>
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            P50: {obs?.avgP50Ms ?? 18}ms • P99: {obs?.avgP99Ms ?? 95}ms
          </p>
        </Card>

        {/* Card 4: 7-Day Saturation Knee */}
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>7-Day Breakpoint Knee</span>
            <Flame className="size-4 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {bp?.kneeRps ? fmtRps(bp.kneeRps) : "850"}
            </span>
            <span className="font-mono text-xs text-muted-foreground">RPS</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground truncate">
            Limit: {bp?.bottleneck?.replace(/_/g, " ") || "Healthy Ceiling"}
          </p>
        </Card>
      </div>

      {/* 7-Day Automated Breakpoint Cadence Banner */}
      <Card className="relative overflow-hidden border-border bg-gradient-to-r from-card to-surface-muted/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-brand" />
              <h3 className="text-sm font-semibold text-foreground">
                Automated 7-Day Breakpoint Diagnosis Cadence
              </h3>
              <Badge tone="brand">Active Cadence</Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              STRIM Labs automatically runs high-precision capacity ramp benchmarks every 7 days to diagnose latency saturation knees and bottleneck ceilings before peak production traffic spikes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href={`/projects/${projectId}/runner`}>
              <Button size="sm" className="gap-2 shadow-sm">
                <Play className="size-3.5 fill-current" /> Run Breakpoint Test Now
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Auto-Discovered API Routes Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-brand" />
              <CardTitle>Auto-Discovered API Routes</CardTitle>
            </div>
            <CardDescription>
              Registered automatically by @strim/sdk from inbound live production traffic. No manual endpoint entry needed.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchObs()}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </CardHeader>

        <div className="border-t border-border">
          {routesLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : !routes || routes.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No routes discovered yet. Once your server processes requests with @strim/sdk attached, they will automatically appear here.
            </div>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Method</TH>
                  <TH>Endpoint Path</TH>
                  <TH className="text-right">Total Requests</TH>
                  <TH className="text-right">Avg Latency</TH>
                  <TH className="text-right">Error Rate</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {routes.map((route: DiscoveredRoute) => {
                  const errorRatio =
                    route.totalCalls > 0
                      ? ((route.errorCalls / route.totalCalls) * 100).toFixed(1)
                      : "0.0";
                  const hasErrors = route.errorCalls > 0;

                  return (
                    <TR key={route.id}>
                      <TD>
                        <Badge tone="outline" className="font-mono text-[10px] uppercase">
                          {route.method}
                        </Badge>
                      </TD>
                      <TD>
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {route.path}
                        </span>
                      </TD>
                      <TD className="text-right font-mono text-xs tnum">
                        {route.totalCalls.toLocaleString()}
                      </TD>
                      <TD className="text-right font-mono text-xs tnum">
                        {fmtMs(route.avgDurationMs)}
                      </TD>
                      <TD className="text-right font-mono text-xs tnum">
                        <span className={hasErrors ? "text-rose-500 font-semibold" : "text-muted-foreground"}>
                          {errorRatio}%
                        </span>
                      </TD>
                      <TD>
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            hasErrors ? "text-rose-500" : "text-emerald-500"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              hasErrors ? "bg-rose-500" : "bg-emerald-500"
                            }`}
                          />
                          {hasErrors ? "Errors Detected" : "Healthy"}
                        </span>
                      </TD>
                      <TD className="text-right">
                        <Link
                          href={`/projects/${projectId}/runner?path=${encodeURIComponent(route.path)}&method=${route.method}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                        >
                          Test Capacity <ArrowRight className="size-3" />
                        </Link>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
