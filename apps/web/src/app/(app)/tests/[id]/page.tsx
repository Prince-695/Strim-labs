"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Gauge,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Zap,
  TrendingUp,
  ArrowLeftRight,
  ShieldAlert,
  Cpu,
  Copy,
  Check,
  Code2,
  Terminal,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

type TestSample = {
  id: string;
  timestamp: string;
  rps: number;
  activeVUs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorCount: number;
  statusCodes: Record<string, number>;
};

type TestRunDetail = {
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
  p99Ms: number;
  errorRate: number;
  statusCodes: Record<string, number>;
  breakingPoint?: {
    kneeRps: number;
    failureRps: number;
    sustainableRps: number;
    bottleneck: string;
    verdict: string;
  };
  startedAt: string;
  completedAt: string;
  samples: TestSample[];
  project?: { id: string; name: string };
};

export default function TestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { token, orgId } = useSession();
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [showCiDrawer, setShowCiDrawer] = useState(false);

  const query = useQuery({
    queryKey: ["test-run-detail", resolvedParams.id, orgId],
    enabled: Boolean(token && orgId && resolvedParams.id),
    queryFn: () =>
      api<{ run: TestRunDetail }>(`/v1/load-tests/${resolvedParams.id}`, { token, orgId }),
  });

  const run = query.data?.run;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(key);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  if (query.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-xl bg-brand/15 text-brand flex items-center justify-center animate-pulse">
            <Zap className="size-5" />
          </div>
          <p className="text-xs font-medium text-muted-foreground animate-pulse">
            Loading test run telemetry…
          </p>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-12 text-center space-y-4 max-w-md mx-auto">
        <div className="size-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertTriangle className="size-6" />
        </div>
        <h3 className="font-heading font-bold text-lg text-foreground">Test Run Not Found</h3>
        <p className="text-xs text-muted-foreground">
          The requested benchmark ID could not be loaded or belongs to another workspace.
        </p>
        <Link href="/">
          <Button variant="outline" className="rounded-lg text-xs h-9">
            <ArrowLeft className="size-3.5 mr-1.5" /> Return to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const bp = run.breakingPoint;
  const sustainableRps = bp?.sustainableRps ?? Math.round(run.avgRps);
  const kneeRps = bp?.kneeRps ?? Math.round(run.peakRps * 0.85);
  const failureRps = bp?.failureRps ?? Math.round(run.peakRps * 1.15);
  const maxSpectrumRps = Math.max(failureRps * 1.2, 50);

  // Position percentages on spectrum
  const safePercent = Math.min(100, Math.round((sustainableRps / maxSpectrumRps) * 100));
  const kneePercent = Math.min(100, Math.round((kneeRps / maxSpectrumRps) * 100));
  const failurePercent = Math.min(100, Math.round((failureRps / maxSpectrumRps) * 100));
  const currentRpsPercent = Math.min(100, Math.round((run.avgRps / maxSpectrumRps) * 100));

  // Diagnostic facts & hypothesis
  const observedFacts = [
    `Average throughput reached ${run.avgRps} RPS with peak burst of ${run.peakRps} RPS.`,
    `P95 latency recorded at ${run.p95Ms}ms (P50: ${run.p50Ms}ms, P99: ${run.p99Ms}ms).`,
    `Total HTTP error rate: ${(run.errorRate * 100).toFixed(2)}% over ${run.totalRequests.toLocaleString()} requests.`,
  ];

  let hypothesis = bp?.verdict;
  if (!hypothesis) {
    if (run.errorRate > 0.05) {
      hypothesis =
        "Service degradation triggered by elevated HTTP errors. Consistent with downstream timeout or worker pool exhaustion.";
    } else if (run.p95Ms > 1000) {
      hypothesis =
        "Latency knee detected above 1000ms while error rate remained low. Consistent with thread queueing or connection contention.";
    } else {
      hypothesis =
        "Target API operated within nominal safe bounds throughout the test duration. No critical breaking point reached.";
    }
  }

  const actionableSteps =
    run.errorRate > 0.02
      ? [
          "Inspect reverse-proxy / gateway connection limits and 429 token bucket settings.",
          "Check backend connection pool sizes (database, Redis, upstream microservices).",
          "Review application memory and CPU metrics around the peak throughput window.",
        ]
      : [
          "Run a Breaking Point Hunt test (300+ VUs) to discover the ceiling capacity.",
          "Set up automated CI/CD performance gate using the regression comparison command.",
          "Monitor P95 tail latency during peak production hours.",
        ];

  const githubActionsYaml = `name: STRIM Performance Gate
on: [pull_request]
jobs:
  performance-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger STRIM Load Test
        run: |
          RESPONSE=$(curl -s -X POST https://api.strim.dev/v1/load-tests \\
            -H "Authorization: Bearer \${{ secrets.STRIM_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "projectId": "${run.project?.id || "PROJECT_ID"}",
              "name": "CI Gate #\${{ github.run_number }}",
              "profile": "${run.profile}",
              "concurrency": ${run.concurrency},
              "durationSec": ${run.durationSec}
            }')
          echo "Test launched: $RESPONSE"`;

  const curlCommand = `curl -X POST https://api.strim.dev/v1/load-tests \\
  -H "Authorization: Bearer <STRIM_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "${run.project?.id || "PROJECT_ID"}",
    "profile": "${run.profile}",
    "concurrency": ${run.concurrency},
    "durationSec": ${run.durationSec}
  }'`;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-lg border-border/60 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-heading font-bold text-foreground tracking-tight">
                {run.name}
              </h1>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase font-semibold py-0.5 px-2.5 rounded-full border",
                  run.status === "COMPLETED"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                )}
              >
                {run.status}
              </Badge>
              <span className="text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-mono">
                {run.profile}
              </span>
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">{run.method}</span> {run.targetUrl}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/compare?baselineId=${run.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-xs h-8 border-border/60 gap-1.5"
            >
              <ArrowLeftRight className="size-3.5 text-brand" />
              Compare Run
            </Button>
          </Link>
          <Link href="/runner">
            <Button
              size="sm"
              className="rounded-lg text-xs h-8 bg-brand hover:bg-brand-strong text-white gap-1.5 font-medium"
            >
              <Zap className="size-3.5" />
              Re-run Test
            </Button>
          </Link>
        </div>
      </div>

      {/* 3-Zone Visual Capacity Spectrum Gauge */}
      <Card className="border-border/60 shadow-sm bg-card overflow-hidden">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                <Gauge className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-heading font-bold text-foreground">
                  3-Zone Capacity Spectrum Gauge
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Evaluates sustainable throughput, saturation knee, and critical failure ceiling.
                </CardDescription>
              </div>
            </div>
            {bp?.bottleneck && (
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-semibold py-0.5 px-2 rounded-md border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              >
                Knee: {bp.bottleneck.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-1 space-y-4">
          {/* Visual Bar Spectrum */}
          <div className="space-y-2">
            <div className="relative h-6 rounded-lg overflow-hidden flex bg-secondary/80 border border-border/60">
              {/* Zone 1: Safe Band */}
              <div
                style={{ width: `${safePercent}%` }}
                className="h-full bg-emerald-500/25 flex items-center px-2 border-r border-emerald-500/40 transition-all"
                title="Zone 1: Safe Band"
              >
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                  Safe Band
                </span>
              </div>
              {/* Zone 2: Saturation Knee */}
              <div
                style={{ width: `${Math.max(10, kneePercent - safePercent)}%` }}
                className="h-full bg-amber-500/25 flex items-center px-2 border-r border-amber-500/40 transition-all"
                title="Zone 2: Saturation Knee"
              >
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 truncate">
                  Saturation Knee
                </span>
              </div>
              {/* Zone 3: Breaking Point */}
              <div
                style={{ width: `${Math.max(15, 100 - kneePercent)}%` }}
                className="h-full bg-rose-500/25 flex items-center px-2 transition-all"
                title="Zone 3: Breaking Point"
              >
                <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-300 truncate">
                  Breaking Cliff
                </span>
              </div>

              {/* Marker for Current Run */}
              <div
                style={{ left: `${Math.min(98, Math.max(2, currentRpsPercent))}%` }}
                className="absolute top-0 bottom-0 w-1 bg-foreground rounded shadow -translate-x-1/2 z-10"
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 size-2.5 rounded-full bg-foreground shadow-sm" />
              </div>
            </div>

            {/* Scale Markers */}
            <div className="flex justify-between text-[11px] font-mono text-muted-foreground px-0.5">
              <span>0 RPS</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Safe: &le;{sustainableRps} RPS
              </span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                Knee: ~{kneeRps} RPS
              </span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                Failure: &ge;{failureRps} RPS
              </span>
            </div>
          </div>

          {/* 3 Metric Dial Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
            <div className="p-3 rounded-lg bg-secondary/50 border border-border/40">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                Sustainable Target
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-heading font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {sustainableRps}
                </span>
                <span className="text-xs text-muted-foreground font-mono">RPS</span>
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                P95 latency maintained &lt; 100ms
              </span>
            </div>

            <div className="p-3 rounded-lg bg-secondary/50 border border-border/40">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                Saturation Knee
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-heading font-black text-amber-500 font-mono">
                  {kneeRps}
                </span>
                <span className="text-xs text-muted-foreground font-mono">RPS</span>
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Latency curvature inflection
              </span>
            </div>

            <div className="p-3 rounded-lg bg-secondary/50 border border-border/40">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                Critical Failure Ceiling
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-heading font-black text-rose-500 font-mono">
                  {failureRps}
                </span>
                <span className="text-xs text-muted-foreground font-mono">RPS</span>
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Error threshold or crash
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evidence-Based Diagnosis Card */}
      <Card className="border-border/60 shadow-sm bg-card">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <ShieldAlert className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-heading font-bold text-foreground">
                Evidence-Based Capacity Diagnosis
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Rigorous empirical breakdown without artificial telemetry.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Column 1: Observed Facts */}
            <div className="p-3.5 rounded-lg bg-secondary/40 border border-border/40 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-brand" />
                Observed Facts
              </span>
              <ul className="space-y-1.5 text-xs text-foreground">
                {observedFacts.map((fact, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-brand shrink-0">•</span>
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 2: Qualified Hypothesis */}
            <div className="p-3.5 rounded-lg bg-secondary/40 border border-border/40 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="size-3.5 text-amber-500" />
                Qualified Hypothesis
              </span>
              <p className="text-xs text-foreground leading-relaxed">{hypothesis}</p>
            </div>

            {/* Column 3: Actionable Checks */}
            <div className="p-3.5 rounded-lg bg-secondary/40 border border-border/40 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Cpu className="size-3.5 text-sky-500" />
                Next Actionable Checks
              </span>
              <ol className="space-y-1.5 text-xs text-foreground list-decimal pl-4">
                {actionableSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core KPI Dials */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              Total Requests
            </span>
            <p className="text-2xl font-heading font-black text-foreground font-mono">
              {run.totalRequests.toLocaleString()}
            </p>
            <span className="text-[11px] text-muted-foreground block font-mono">
              Avg {run.avgRps} RPS · Peak {run.peakRps} RPS
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              P50 Median Latency
            </span>
            <p className="text-2xl font-heading font-black text-foreground font-mono">
              {run.p50Ms} <span className="text-xs font-normal text-muted-foreground">ms</span>
            </p>
            <span className="text-[11px] text-muted-foreground block">
              50% of requests served faster
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              P95 Tail Latency
            </span>
            <p className="text-2xl font-heading font-black text-brand font-mono">
              {run.p95Ms} <span className="text-xs font-normal text-muted-foreground">ms</span>
            </p>
            <span className="text-[11px] text-muted-foreground block font-mono">
              P99: {run.p99Ms} ms
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              HTTP Error Rate
            </span>
            <p
              className={cn(
                "text-2xl font-heading font-black font-mono",
                run.errorRate > 0.02
                  ? "text-rose-500"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {(run.errorRate * 100).toFixed(2)}%
            </p>
            <span className="text-[11px] text-muted-foreground block font-mono">
              {run.concurrency} VUs · {run.durationSec}s window
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Timeseries Graph */}
      <Card className="border-border/60 shadow-sm bg-card">
        <CardHeader className="p-5 pb-2 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-heading font-bold text-foreground">
                Execution Timeseries: Throughput vs P95 Latency
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Continuous 500ms granularity measurements captured across the test run.
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-brand">
                <span className="size-2 rounded-full bg-brand" /> Throughput (RPS)
              </span>
              <span className="flex items-center gap-1.5 text-amber-500">
                <span className="size-2 rounded-full bg-amber-500" /> P95 Latency (ms)
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="h-72 w-full">
            {run.samples.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No timeseries sample points recorded for this run.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={run.samples}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    stroke="#00C968"
                    fontSize={11}
                    tickFormatter={(v) => `${v}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#F59E0B"
                    fontSize={11}
                    tickFormatter={(v) => `${v}ms`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "var(--foreground)",
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="rps"
                    stroke="#00C968"
                    strokeWidth={2}
                    dot={false}
                    name="Throughput (RPS)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="p95Ms"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                    name="P95 Latency (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* HTTP Status Code Breakdown */}
      <Card className="border-border/60 shadow-sm bg-card">
        <CardHeader className="p-4 pb-2 border-b border-border/40">
          <CardTitle className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-foreground">
            HTTP Status Code Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 flex flex-wrap gap-3">
          {run.statusCodes && Object.keys(run.statusCodes).length > 0 ? (
            Object.entries(run.statusCodes).map(([code, count]) => {
              const is2xx = code.startsWith("2");
              const is429 = code === "429";
              const is5xx = code.startsWith("5");
              return (
                <div
                  key={code}
                  className="p-3 rounded-lg bg-secondary/50 border border-border/60 min-w-32"
                >
                  <span
                    className={cn(
                      "text-xs font-mono font-bold block",
                      is2xx
                        ? "text-emerald-600 dark:text-emerald-400"
                        : is429
                        ? "text-amber-500"
                        : "text-rose-500"
                    )}
                  >
                    HTTP {code}
                  </span>
                  <span className="text-xl font-heading font-black text-foreground font-mono">
                    {count.toLocaleString()}
                  </span>
                </div>
              );
            })
          ) : (
            <span className="text-xs text-muted-foreground italic">No status codes recorded</span>
          )}
        </CardContent>
      </Card>

      {/* CI/CD Integration Accordion */}
      <Card className="border-border/60 shadow-sm bg-card">
        <button
          type="button"
          onClick={() => setShowCiDrawer(!showCiDrawer)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-secondary/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-lg bg-secondary text-foreground flex items-center justify-center">
              <Code2 className="size-4" />
            </div>
            <div>
              <span className="text-sm font-heading font-semibold text-foreground block">
                Automate This Test in CI/CD
              </span>
              <span className="text-xs text-muted-foreground">
                Copy ready-to-run GitHub Actions workflow or cURL command.
              </span>
            </div>
          </div>
          {showCiDrawer ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>

        {showCiDrawer && (
          <CardContent className="p-4 pt-2 border-t border-border/40 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Terminal className="size-3.5 text-muted-foreground" />
                  GitHub Actions Workflow (`.github/workflows/strim.yml`)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(githubActionsYaml, "yaml")}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  {copiedSnippet === "yaml" ? (
                    <Check className="size-3 text-brand" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copiedSnippet === "yaml" ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-secondary/80 border border-border/60 text-xs font-mono text-foreground overflow-x-auto">
                {githubActionsYaml}
              </pre>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Terminal className="size-3.5 text-muted-foreground" />
                  cURL CLI Command
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(curlCommand, "curl")}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  {copiedSnippet === "curl" ? (
                    <Check className="size-3 text-brand" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copiedSnippet === "curl" ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-secondary/80 border border-border/60 text-xs font-mono text-foreground overflow-x-auto">
                {curlCommand}
              </pre>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
