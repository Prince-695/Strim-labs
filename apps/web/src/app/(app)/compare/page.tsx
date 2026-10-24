"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TestRun = {
  id: string;
  name: string;
  profile: string;
  avgRps: number;
  peakRps: number;
  p95Ms: number;
  errorRate: number;
  createdAt: string;
};

type ComparisonResult = {
  runA: { id: string; name: string; avgRps: number; p95Ms: number; errorRate: number; peakRps: number };
  runB: { id: string; name: string; avgRps: number; p95Ms: number; errorRate: number; peakRps: number };
  deltas: {
    avgRpsDeltaPct: number;
    p95LatencyDeltaPct: number;
    errorRateDelta: number;
    peakRpsDeltaPct: number;
    improved: boolean;
    summary: string;
  };
};

export default function ComparePage() {
  const searchParams = useSearchParams();
  const { token, orgId, projectId } = useSession();

  const [runAId, setRunAId] = useState<string>(
    searchParams.get("baselineId") ?? searchParams.get("runA") ?? ""
  );
  const [runBId, setRunBId] = useState<string>(searchParams.get("runB") ?? "");

  // In-Studio Regression Gate Thresholds
  const [maxLatencyDegradationPct, setMaxLatencyDegradationPct] = useState<number>(10);
  const [maxErrorRateTolerancePct, setMaxErrorRateTolerancePct] = useState<number>(0.5);
  const [minThroughputRetentionPct, setMinThroughputRetentionPct] = useState<number>(90);
  const [showThresholdDrawer, setShowThresholdDrawer] = useState<boolean>(true);

  const runsQuery = useQuery({
    queryKey: ["all-runs-for-compare", orgId, projectId],
    enabled: Boolean(token && orgId),
    queryFn: () =>
      api<{ runs: TestRun[] }>(`/v1/load-tests${projectId ? `?projectId=${projectId}` : ""}`, {
        token,
        orgId,
      }),
  });

  const runs = runsQuery.data?.runs ?? [];

  // Default selection if available
  const effectiveRunAId = runAId || (runs[1]?.id ?? runs[0]?.id ?? "");
  const effectiveRunBId = runBId || (runs[0]?.id ?? "");

  const compareQuery = useQuery({
    queryKey: ["run-comparison", orgId, effectiveRunAId, effectiveRunBId],
    enabled: Boolean(
      token && orgId && effectiveRunAId && effectiveRunBId && effectiveRunAId !== effectiveRunBId
    ),
    queryFn: () =>
      api<{ comparison: ComparisonResult }>(
        `/v1/compare?runA=${effectiveRunAId}&runB=${effectiveRunBId}`,
        { token, orgId }
      ),
  });

  const comp = compareQuery.data?.comparison;

  // Dynamic gate verdict evaluation
  const gateVerdict = useMemo(() => {
    if (!comp) return null;
    if (comp.runA.id === comp.runB.id) {
      return {
        verdict: "INCONCLUSIVE" as const,
        reason: "Identical test runs selected. Select two different runs to evaluate regression.",
      };
    }

    const latencyDelta = comp.deltas.p95LatencyDeltaPct;
    const errorDeltaPct = comp.deltas.errorRateDelta * 100;
    const throughputDelta = comp.deltas.avgRpsDeltaPct;

    const reasons: string[] = [];
    if (latencyDelta > maxLatencyDegradationPct) {
      reasons.push(
        `P95 latency degraded by +${latencyDelta.toFixed(1)}% (exceeds ${maxLatencyDegradationPct}% limit)`
      );
    }
    if (errorDeltaPct > maxErrorRateTolerancePct) {
      reasons.push(
        `Error rate increased by +${errorDeltaPct.toFixed(2)}% (exceeds ${maxErrorRateTolerancePct}% limit)`
      );
    }
    const retainedThroughput = 100 + throughputDelta;
    if (retainedThroughput < minThroughputRetentionPct) {
      reasons.push(
        `Throughput retention is ${retainedThroughput.toFixed(1)}% (below ${minThroughputRetentionPct}% requirement)`
      );
    }

    if (reasons.length > 0) {
      return {
        verdict: "FAIL" as const,
        reason: reasons.join("; "),
      };
    }

    return {
      verdict: "PASS" as const,
      reason:
        "All performance criteria satisfied within configured tolerances. Safe to deploy.",
    };
  }, [comp, maxLatencyDegradationPct, maxErrorRateTolerancePct, minThroughputRetentionPct]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
              <ArrowLeftRight className="size-4" />
            </div>
            <h1 className="text-xl font-heading font-bold tracking-tight text-foreground">
              Regression Comparison Studio
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Compare benchmark runs side-by-side with live gate evaluation for pull requests and releases.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowThresholdDrawer(!showThresholdDrawer)}
          className="rounded-lg text-xs h-8 gap-1.5 border-border/60"
        >
          <Sliders className="size-3.5 text-brand" />
          {showThresholdDrawer ? "Hide Tolerances" : "Adjust Tolerances"}
        </Button>
      </div>

      {/* Run Selectors */}
      <Card className="border-border/60 shadow-sm bg-card">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Baseline Run (Before / Production)
            </span>
            <Select
              value={effectiveRunAId}
              onValueChange={(val) => {
                if (val) setRunAId(val);
              }}
            >
              <SelectTrigger className="h-9 text-xs rounded-lg bg-secondary/50 border-border/60">
                <SelectValue placeholder="Select baseline run…" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {runs.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    {r.name} ({Math.round(r.avgRps)} RPS · P95: {r.p95Ms}ms)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Candidate Run (After / Pull Request)
            </span>
            <Select
              value={effectiveRunBId}
              onValueChange={(val) => {
                if (val) setRunBId(val);
              }}
            >
              <SelectTrigger className="h-9 text-xs rounded-lg bg-secondary/50 border-border/60">
                <SelectValue placeholder="Select candidate run…" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {runs.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    {r.name} ({Math.round(r.avgRps)} RPS · P95: {r.p95Ms}ms)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* In-Studio Threshold Adjuster Drawer */}
      {showThresholdDrawer && (
        <Card className="border-border/60 shadow-sm bg-secondary/30">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-brand" />
                <CardTitle className="text-xs font-heading font-semibold uppercase tracking-wider text-foreground">
                  In-Studio Regression Gate Tolerances
                </CardTitle>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMaxLatencyDegradationPct(10);
                  setMaxErrorRateTolerancePct(0.5);
                  setMinThroughputRetentionPct(90);
                }}
                className="text-[11px] text-muted-foreground hover:text-brand flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="size-3" />
                Reset Defaults
              </button>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Adjusting sliders instantly recalculates the CI/CD PASS / FAIL verdict below.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-card border border-border/60 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-foreground">Max Latency Degradation</span>
                <span className="font-mono font-bold text-brand">+{maxLatencyDegradationPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={maxLatencyDegradationPct}
                onChange={(e) => setMaxLatencyDegradationPct(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />
              <span className="text-[10px] text-muted-foreground block">
                Fail candidate if P95 slows by &gt; {maxLatencyDegradationPct}%
              </span>
            </div>

            <div className="p-3 rounded-lg bg-card border border-border/60 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-foreground">Max Error Rate Tolerance</span>
                <span className="font-mono font-bold text-brand">+{maxErrorRateTolerancePct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={maxErrorRateTolerancePct}
                onChange={(e) => setMaxErrorRateTolerancePct(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />
              <span className="text-[10px] text-muted-foreground block">
                Fail candidate if errors increase by &gt; {maxErrorRateTolerancePct}%
              </span>
            </div>

            <div className="p-3 rounded-lg bg-card border border-border/60 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-foreground">Min Throughput Retention</span>
                <span className="font-mono font-bold text-brand">{minThroughputRetentionPct}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={minThroughputRetentionPct}
                onChange={(e) => setMinThroughputRetentionPct(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />
              <span className="text-[10px] text-muted-foreground block">
                Fail candidate if RPS drops below {minThroughputRetentionPct}% of baseline
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Deployment Gate Verdict Banner */}
      {gateVerdict && (
        <Card
          className={cn(
            "border-l-4 shadow-sm",
            gateVerdict.verdict === "PASS"
              ? "border-l-emerald-500 bg-emerald-500/5 border-emerald-500/30"
              : gateVerdict.verdict === "FAIL"
              ? "border-l-rose-500 bg-rose-500/5 border-rose-500/30"
              : "border-l-amber-500 bg-amber-500/5 border-amber-500/30"
          )}
        >
          <CardContent className="p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {gateVerdict.verdict === "PASS" ? (
                <ShieldCheck className="size-6 text-emerald-500 shrink-0 mt-0.5" />
              ) : gateVerdict.verdict === "FAIL" ? (
                <ShieldAlert className="size-6 text-rose-500 shrink-0 mt-0.5" />
              ) : (
                <HelpCircle className="size-6 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-heading font-bold text-sm text-foreground">
                    Deployment Gate: {gateVerdict.verdict}
                  </h4>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] uppercase font-bold py-0.5 px-2 rounded-full",
                      gateVerdict.verdict === "PASS"
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : gateVerdict.verdict === "FAIL"
                        ? "border-rose-500/40 bg-rose-500/15 text-rose-500"
                        : "border-amber-500/40 bg-amber-500/15 text-amber-500"
                    )}
                  >
                    {gateVerdict.verdict}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {gateVerdict.reason}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delta Metrics Cards */}
      {comp && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border/60 shadow-sm bg-card">
            <CardHeader className="p-4 pb-1">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                P95 Tail Latency Delta
              </span>
              <div className="flex items-center gap-2 mt-1">
                <CardTitle
                  className={cn(
                    "text-2xl font-heading font-black font-mono",
                    comp.deltas.p95LatencyDeltaPct < 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : comp.deltas.p95LatencyDeltaPct <= maxLatencyDegradationPct
                      ? "text-foreground"
                      : "text-rose-500"
                  )}
                >
                  {comp.deltas.p95LatencyDeltaPct > 0
                    ? `+${comp.deltas.p95LatencyDeltaPct}%`
                    : `${comp.deltas.p95LatencyDeltaPct}%`}
                </CardTitle>
                {comp.deltas.p95LatencyDeltaPct < 0 ? (
                  <TrendingDown className="size-4 text-emerald-500" />
                ) : (
                  <TrendingUp className="size-4 text-rose-500" />
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-xs text-muted-foreground font-mono">
              {comp.runA.p95Ms} ms &rarr; {comp.runB.p95Ms} ms
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm bg-card">
            <CardHeader className="p-4 pb-1">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Average Throughput Delta
              </span>
              <div className="flex items-center gap-2 mt-1">
                <CardTitle
                  className={cn(
                    "text-2xl font-heading font-black font-mono",
                    comp.deltas.avgRpsDeltaPct >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-500"
                  )}
                >
                  {comp.deltas.avgRpsDeltaPct > 0
                    ? `+${comp.deltas.avgRpsDeltaPct}%`
                    : `${comp.deltas.avgRpsDeltaPct}%`}
                </CardTitle>
                {comp.deltas.avgRpsDeltaPct >= 0 && (
                  <TrendingUp className="size-4 text-emerald-500" />
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-xs text-muted-foreground font-mono">
              {Math.round(comp.runA.avgRps)} RPS &rarr; {Math.round(comp.runB.avgRps)} RPS
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm bg-card">
            <CardHeader className="p-4 pb-1">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Error Rate Delta
              </span>
              <div className="flex items-center gap-2 mt-1">
                <CardTitle
                  className={cn(
                    "text-2xl font-heading font-black font-mono",
                    comp.deltas.errorRateDelta <= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-500"
                  )}
                >
                  {comp.deltas.errorRateDelta > 0
                    ? `+${(comp.deltas.errorRateDelta * 100).toFixed(2)}%`
                    : `${(comp.deltas.errorRateDelta * 100).toFixed(2)}%`}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-xs text-muted-foreground font-mono">
              {(comp.runA.errorRate * 100).toFixed(2)}% &rarr; {(comp.runB.errorRate * 100).toFixed(2)}%
            </CardContent>
          </Card>
        </div>
      )}

      {/* Side-by-Side Comparison Table */}
      {comp && (
        <Card className="border-border/60 shadow-sm bg-card overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-border/40">
            <CardTitle className="text-sm font-heading font-bold text-foreground">
              Side-by-Side Performance Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground text-[10px] uppercase font-semibold text-left bg-secondary/40">
                  <th className="py-2.5 px-4">Performance Metric</th>
                  <th className="py-2.5 px-4 font-mono">Run A: {comp.runA.name}</th>
                  <th className="py-2.5 px-4 font-mono">Run B: {comp.runB.name}</th>
                  <th className="py-2.5 px-4 text-right">Relative Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-foreground">
                    Average Throughput
                  </td>
                  <td className="py-2.5 px-4">{Math.round(comp.runA.avgRps)} RPS</td>
                  <td className="py-2.5 px-4 font-semibold text-foreground">
                    {Math.round(comp.runB.avgRps)} RPS
                  </td>
                  <td
                    className={cn(
                      "py-2.5 px-4 text-right font-bold",
                      comp.deltas.avgRpsDeltaPct >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-500"
                    )}
                  >
                    {comp.deltas.avgRpsDeltaPct > 0
                      ? `+${comp.deltas.avgRpsDeltaPct}%`
                      : `${comp.deltas.avgRpsDeltaPct}%`}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-foreground">
                    P95 Response Latency
                  </td>
                  <td className="py-2.5 px-4">{comp.runA.p95Ms} ms</td>
                  <td className="py-2.5 px-4 font-semibold text-foreground">{comp.runB.p95Ms} ms</td>
                  <td
                    className={cn(
                      "py-2.5 px-4 text-right font-bold",
                      comp.deltas.p95LatencyDeltaPct < 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : comp.deltas.p95LatencyDeltaPct <= maxLatencyDegradationPct
                        ? "text-foreground"
                        : "text-rose-500"
                    )}
                  >
                    {comp.deltas.p95LatencyDeltaPct > 0
                      ? `+${comp.deltas.p95LatencyDeltaPct}%`
                      : `${comp.deltas.p95LatencyDeltaPct}%`}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-foreground">
                    Peak Burst Throughput
                  </td>
                  <td className="py-2.5 px-4">{Math.round(comp.runA.peakRps)} RPS</td>
                  <td className="py-2.5 px-4 font-semibold text-foreground">
                    {Math.round(comp.runB.peakRps)} RPS
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold">
                    {comp.deltas.peakRpsDeltaPct > 0
                      ? `+${comp.deltas.peakRpsDeltaPct}%`
                      : `${comp.deltas.peakRpsDeltaPct}%`}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-foreground">
                    HTTP Error Rate
                  </td>
                  <td className="py-2.5 px-4">{(comp.runA.errorRate * 100).toFixed(2)}%</td>
                  <td className="py-2.5 px-4 font-semibold text-foreground">
                    {(comp.runB.errorRate * 100).toFixed(2)}%
                  </td>
                  <td
                    className={cn(
                      "py-2.5 px-4 text-right font-bold",
                      comp.deltas.errorRateDelta <= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-500"
                    )}
                  >
                    {(comp.deltas.errorRateDelta * 100).toFixed(2)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
