"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Play,
  ArrowUpRight,
  Gauge,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ArrowLeftRight,
  TrendingUp,
  Cpu,
  Target,
  Activity,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TestRun = {
  id: string;
  name: string;
  profile: string;
  status: string;
  targetUrl: string;
  method: string;
  concurrency: number;
  durationSec: number;
  totalRequests: number;
  avgRps: number;
  peakRps: number;
  p50Ms: number;
  p95Ms: number;
  errorRate: number;
  breakingPoint?: { kneeRps: number; failureRps: number; bottleneck: string; verdict: string };
  createdAt: string;
};

export function DashboardView() {
  const { token, orgId, projectId, projects } = useSession();
  const currentProject = projects.find((p) => p.id === projectId) ?? projects[0];

  const runsQuery = useQuery({
    queryKey: ["load-runs", orgId, projectId],
    enabled: Boolean(token && orgId),
    queryFn: () =>
      api<{ runs: TestRun[] }>(`/v1/load-tests${projectId ? `?projectId=${projectId}` : ""}`, {
        token,
        orgId,
      }),
    refetchInterval: 5000,
  });

  const runs = runsQuery.data?.runs ?? [];
  const latestCompleted = runs.find((r) => r.status === "COMPLETED");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-xl font-heading font-bold tracking-tight text-foreground">
            Capacity & Telemetry Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated API load testing, saturation knee identification, and breaking point analysis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/runner">
            <Button className="rounded-lg bg-brand hover:bg-brand-strong text-white font-medium text-xs h-8 px-3.5 shadow-sm gap-1.5 transition-all">
              <Zap className="size-3.5" />
              Launch Load Test
            </Button>
          </Link>
        </div>
      </div>

      {/* Target API Banner */}
      <Card className="border-border/60 shadow-sm bg-card">
        <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Active Benchmark Target
              </span>
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-mono font-bold py-0 px-2 rounded-md border-brand/40 text-brand bg-brand-subtle"
              >
                {currentProject?.defaultMethod ?? "GET"}
              </Badge>
            </div>
            <h3 className="text-base font-heading font-bold text-foreground truncate">
              {currentProject?.name ?? "No Target Selected"}
            </h3>
            <p className="text-xs font-mono text-muted-foreground truncate max-w-xl">
              {currentProject?.targetUrl ?? "Register a target API to begin testing"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/runner">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg text-xs font-medium h-8 px-3 gap-1.5 border-border/60"
              >
                <Activity className="size-3.5 text-brand" />
                Open Runner Cockpit
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Capacity & Breaking Point Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/60 shadow-sm bg-card">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Sustainable Capacity Ceiling
              </span>
              <Gauge className="size-4 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl font-heading font-black text-foreground font-mono mt-1">
              {latestCompleted?.breakingPoint?.kneeRps
                ? `${latestCompleted.breakingPoint.kneeRps} RPS`
                : latestCompleted?.avgRps
                ? `${Math.round(latestCompleted.avgRps)} RPS`
                : "No baseline"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">
              {latestCompleted?.breakingPoint?.kneeRps
                ? "Safe maximum throughput prior to latency inflection"
                : "Run a test to derive capacity limit"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-card">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Saturation Knee Point
              </span>
              <AlertTriangle className="size-4 text-amber-500" />
            </div>
            <CardTitle className="text-2xl font-heading font-black text-amber-500 font-mono mt-1">
              {latestCompleted?.breakingPoint?.failureRps
                ? `${latestCompleted.breakingPoint.failureRps} RPS`
                : latestCompleted?.peakRps
                ? `${Math.round(latestCompleted.peakRps)} RPS`
                : "Nominal"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground truncate">
              {latestCompleted?.breakingPoint?.bottleneck
                ? `Knee: ${latestCompleted.breakingPoint.bottleneck.replace(/_/g, " ")}`
                : "Empirical saturation knee marker"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-card">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                P95 Latency & Errors
              </span>
              <Clock className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl font-heading font-black text-foreground font-mono mt-1">
              {latestCompleted?.p95Ms ? `${latestCompleted.p95Ms} ms` : "0 ms"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Error Rate:{" "}
              <span
                className={cn(
                  "font-bold font-mono",
                  (latestCompleted?.errorRate ?? 0) > 0.02
                    ? "text-rose-500"
                    : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {((latestCompleted?.errorRate ?? 0) * 100).toFixed(2)}%
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Test Runs Table */}
      <Card className="border-border/60 shadow-sm bg-card overflow-hidden">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-heading font-bold text-foreground">
              Recent Benchmark Runs
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Execution telemetry, throughput metrics, and knee diagnoses.
            </CardDescription>
          </div>
          {runs.length >= 2 && (
            <Link href={`/compare?runA=${runs[1]?.id}&runB=${runs[0]?.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg text-xs font-medium h-7 px-2.5 gap-1.5 border-border/60"
              >
                <ArrowLeftRight className="size-3 text-brand" />
                Compare Latest Two
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="size-10 rounded-xl bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
                <Cpu className="size-5" />
              </div>
              <h4 className="font-heading font-bold text-sm text-foreground">
                No load test runs recorded yet
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Launch a test run against your target API using one of the 4 canonical presets.
              </p>
              <Link href="/runner">
                <Button className="rounded-lg bg-brand hover:bg-brand-strong text-white font-medium text-xs h-8 px-3.5 mt-2">
                  <Zap className="size-3.5 mr-1" />
                  Launch First Test
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground text-[10px] uppercase font-semibold text-left bg-secondary/30">
                    <th className="py-2.5 px-4">Test Name & Target</th>
                    <th className="py-2.5 px-4">Profile</th>
                    <th className="py-2.5 px-4">Peak RPS</th>
                    <th className="py-2.5 px-4">P95 Latency</th>
                    <th className="py-2.5 px-4">Capacity Knee</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {runs.map((run) => (
                    <tr key={run.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-2.5 px-4">
                        <Link
                          href={`/tests/${run.id}`}
                          className="font-semibold text-foreground hover:text-brand block truncate max-w-xs"
                        >
                          {run.name}
                        </Link>
                        <span className="text-[10px] text-muted-foreground font-mono truncate max-w-xs block">
                          {run.targetUrl}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-foreground">
                          {run.profile} ({run.concurrency} VUs)
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-foreground">
                        {Math.round(run.peakRps || run.avgRps)} RPS
                      </td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">
                        {run.p95Ms} ms
                      </td>
                      <td className="py-2.5 px-4">
                        {run.breakingPoint?.kneeRps ? (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {run.breakingPoint.kneeRps} RPS
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">Analyzing…</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase font-semibold py-0.5 px-2 rounded-full",
                            run.status === "COMPLETED"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : run.status === "RUNNING"
                              ? "border-brand/40 bg-brand/10 text-brand animate-pulse"
                              : "border-destructive/30 bg-destructive/10 text-destructive"
                          )}
                        >
                          {run.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Link href={`/tests/${run.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-md text-xs h-7 px-2 gap-1 text-muted-foreground hover:text-foreground"
                          >
                            Details
                            <ArrowUpRight className="size-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
