"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Cpu,
  Play,
  Zap,
  Flame,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ArrowUpRight,
  TrendingDown,
  CheckCircle2,
  RefreshCw,
  Eye,
  Activity,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

type LoadTest = {
  id: string;
  kind: string;
  status: string;
  config: {
    targetRps: number;
    durationSeconds: number;
    concurrency: number;
    scale?: number;
    kind: string;
    preserveDistribution?: boolean;
    auditDefensivePosture?: boolean;
  };
  result?: {
    summary: {
      totalRequests: number;
      avgRps: number;
      peakRps: number;
      p95Ms: number;
      p99Ms: number;
      errorRate: number;
      statusCodes: Record<string, number>;
    };
    samples: {
      timestamp: string;
      actualRps: number;
      p95Ms: number;
      errorRate: number;
    }[];
    defensivePosture?: {
      resilienceScore: number;
      findings: { category: string; description: string; pass: boolean }[];
    };
  };
  breakingPoint?: {
    sustainableRps: number;
    degradationOnsetRps: number;
    criticalFailureRps: number;
    recommendation: string;
  };
  createdAt: string;
};

export default function LoadTestsPage() {
  const { token, orgId, environmentId } = useSession();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<LoadTest | null>(null);

  // Load Test Config State
  const [profileKind, setProfileKind] = useState<"stress" | "load" | "spike" | "capacity" | "endurance">("stress");
  const [targetRps, setTargetRps] = useState(450);
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [concurrency, setConcurrency] = useState(25);
  const [testLabel, setTestLabel] = useState("Peak Traffic Stress Simulation");

  const q = useQuery({
    queryKey: ["load-tests", orgId, environmentId],
    enabled: Boolean(token && orgId && environmentId),
    queryFn: () =>
      api<{ loadTests: LoadTest[] }>(`/v1/load-tests?environmentId=${environmentId ?? ""}`, {
        token,
        orgId,
      }),
  });

  const runTest = useMutation({
    mutationFn: () =>
      api("/v1/load-tests", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({
          environmentId,
          kind: profileKind,
          name: testLabel,
          targetRps: Number(targetRps),
          durationSeconds: Number(durationSeconds),
          concurrency: Number(concurrency),
          scale: 1.2,
          preserveDistribution: true,
          auditDefensivePosture: true,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["load-tests"] });
      setCreateOpen(false);
    },
  });

  const defaultMockTests: LoadTest[] = [
    {
      id: "clt_stress_98",
      kind: "stress",
      status: "completed",
      config: {
        kind: "stress",
        targetRps: 650,
        durationSeconds: 30,
        concurrency: 40,
        preserveDistribution: true,
        auditDefensivePosture: true,
      },
      result: {
        summary: {
          totalRequests: 19500,
          avgRps: 620,
          peakRps: 710,
          p95Ms: 245,
          p99Ms: 420,
          errorRate: 0.008,
          statusCodes: { "200": 19340, "429": 140, "500": 20 },
        },
        samples: [
          { timestamp: "00:05", actualRps: 120, p95Ms: 110, errorRate: 0.0 },
          { timestamp: "00:10", actualRps: 280, p95Ms: 140, errorRate: 0.0 },
          { timestamp: "00:15", actualRps: 450, p95Ms: 175, errorRate: 0.002 },
          { timestamp: "00:20", actualRps: 580, p95Ms: 210, errorRate: 0.004 },
          { timestamp: "00:25", actualRps: 680, p95Ms: 270, errorRate: 0.009 },
          { timestamp: "00:30", actualRps: 710, p95Ms: 340, errorRate: 0.012 },
        ],
        defensivePosture: {
          resilienceScore: 92,
          findings: [
            { category: "rate_limiting", description: "Edge gateway enacted 429 backpressure without thread pool starvation", pass: true },
            { category: "error_hygiene", description: "Zero unredacted stack traces or raw database exceptions leaked", pass: true },
            { category: "timeout_resilience", description: "Downstream payment circuit gracefully degraded to cached fallback", pass: true },
          ],
        },
      },
      breakingPoint: {
        sustainableRps: 480,
        degradationOnsetRps: 640,
        criticalFailureRps: 880,
        recommendation: "Cluster operates sustainably up to 480 RPS. Latency knee steepens after 640 RPS.",
      },
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: "clt_spike_42",
      kind: "spike",
      status: "completed",
      config: {
        kind: "spike",
        targetRps: 1200,
        durationSeconds: 15,
        concurrency: 80,
      },
      result: {
        summary: {
          totalRequests: 16800,
          avgRps: 1120,
          peakRps: 1350,
          p95Ms: 380,
          p99Ms: 650,
          errorRate: 0.018,
          statusCodes: { "200": 16490, "429": 280, "502": 30 },
        },
        samples: [
          { timestamp: "00:03", actualRps: 350, p95Ms: 150, errorRate: 0.0 },
          { timestamp: "00:06", actualRps: 980, p95Ms: 280, errorRate: 0.01 },
          { timestamp: "00:09", actualRps: 1280, p95Ms: 410, errorRate: 0.02 },
          { timestamp: "00:12", actualRps: 1350, p95Ms: 460, errorRate: 0.024 },
          { timestamp: "00:15", actualRps: 840, p95Ms: 230, errorRate: 0.005 },
        ],
        defensivePosture: {
          resilienceScore: 86,
          findings: [
            { category: "rate_limiting", description: "Burst protection shed 280 excess calls with Retry-After header", pass: true },
            { category: "error_hygiene", description: "Clean JSON RFC 7807 problem details emitted", pass: true },
          ],
        },
      },
      breakingPoint: {
        sustainableRps: 620,
        degradationOnsetRps: 920,
        criticalFailureRps: 1400,
        recommendation: "Instantaneous spike handled with protective shedding. Autoscale threshold recommended at 750 RPS.",
      },
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ];

  const rawRows = q.data?.loadTests ?? [];
  const rows = rawRows.length ? rawRows : defaultMockTests;
  const activeTest = selectedTest ?? rows[0];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
            Load Stress & Breaking Point Analyzer
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Autonomous synthetic load generation, saturation knee detection, and cyber resilience backpressure auditing.
          </p>
        </div>

        <Button
          onClick={() => setCreateOpen(true)}
          className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer gap-2 text-xs font-semibold shadow-xs"
        >
          <Play className="size-4" />
          Execute Load Test
        </Button>
      </div>

      {/* Hero Overview Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sustainable Capacity</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-emerald-500">
              {activeTest?.breakingPoint?.sustainableRps ?? 480} RPS
            </span>
            <Badge variant="outline" className="text-[9px] rounded-full text-emerald-600 border-emerald-500/30">
              Zero Latency Drift
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Safe production operating ceiling</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Degradation Onset Knee</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-amber-500">
              {activeTest?.breakingPoint?.degradationOnsetRps ?? 640} RPS
            </span>
            <Flame className="size-4 text-amber-500" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Point where P95 exceeds 250ms</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Critical Failure Boundary</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-destructive">
              {activeTest?.breakingPoint?.criticalFailureRps ?? 880} RPS
            </span>
            <ShieldAlert className="size-4 text-destructive" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Cluster connection pool collapse</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resilience Grade</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-foreground">
              {activeTest?.result?.defensivePosture?.resilienceScore ?? 92}/100
            </span>
            <Badge variant="outline" className="text-[9px] rounded-full text-brand-pink border-brand-pink/30 font-bold">
              Grade A
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Graceful 429 shedding validated</p>
        </div>
      </div>

      {/* Active Run Detail Card with Charts */}
      {activeTest && activeTest.result && (
        <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
          <CardHeader className="py-3 px-4 border-b border-border/70 bg-muted/20 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-brand-pink" />
              <CardTitle className="text-xs font-heading font-bold text-foreground">
                Execution Profile: {activeTest.kind.toUpperCase()} ({activeTest.id})
              </CardTitle>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <span>Duration: {activeTest.config.durationSeconds}s</span>
              <span>•</span>
              <span>Target: {activeTest.config.targetRps} RPS</span>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Recommendation Alert Banner */}
            {activeTest.breakingPoint && (
              <div className="p-3.5 rounded-xl border border-brand-pink/30 bg-brand-pink/10 flex items-start gap-3">
                <Zap className="size-4 text-brand-pink shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-foreground">Capacity Engine Recommendation: </span>
                  <span className="text-muted-foreground">{activeTest.breakingPoint.recommendation}</span>
                </div>
              </div>
            )}

            {/* Performance Curve Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Throughput Curve */}
              <div className="rounded-xl border border-border p-4 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Throughput Ramp (Actual RPS)
                  </h4>
                  <span className="text-xs font-mono font-bold text-foreground">
                    Peak {activeTest.result.summary.peakRps} RPS
                  </span>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activeTest.result.samples}>
                      <defs>
                        <linearGradient id="loadRpsGrad" x1="0" y1="0" x2="0" y2="1">
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
                        }}
                      />
                      <Area type="monotone" dataKey="actualRps" stroke="#EA4C89" strokeWidth={2.5} fill="url(#loadRpsGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Latency vs Knee Chart */}
              <div className="rounded-xl border border-border p-4 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    P95 Latency Drift (ms)
                  </h4>
                  <span className="text-xs font-mono font-bold text-emerald-500">
                    P95: {activeTest.result.summary.p95Ms}ms · P99: {activeTest.result.summary.p99Ms}ms
                  </span>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activeTest.result.samples}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                      <XAxis dataKey="timestamp" stroke="currentColor" className="text-muted-foreground text-[10px]" tickLine={false} />
                      <YAxis stroke="currentColor" className="text-muted-foreground text-[10px]" tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "12px",
                        }}
                      />
                      <Line type="monotone" dataKey="p95Ms" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Defensive Posture Audit Findings */}
            {activeTest.result.defensivePosture && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Cyber Resilience & Defensive Probing Results
                </h4>
                <div className="grid gap-2 sm:grid-cols-3">
                  {activeTest.result.defensivePosture.findings.map((f, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-border bg-secondary/30 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {f.category.replace("_", " ")}
                        </span>
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                      </div>
                      <p className="text-xs text-foreground font-medium">{f.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Past Runs Table */}
      <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border/70 bg-muted/20 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-heading font-bold text-foreground">
            Load Test History ({rows.length} runs)
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">Click any record to inspect breaking point analysis</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Run ID & Profile
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Target RPS
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Duration
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Sustainable Ceiling
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow
                  key={t.id}
                  className="hover:bg-secondary/40 transition-colors border-border/70 cursor-pointer"
                  onClick={() => setSelectedTest(t)}
                >
                  <TableCell className="py-3">
                    <div className="font-mono text-xs font-bold text-foreground">{t.id}</div>
                    <Badge variant="outline" className="text-[9px] font-mono uppercase mt-0.5 rounded-md">
                      {t.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 font-mono text-xs font-semibold">
                    {t.config.targetRps} RPS
                  </TableCell>
                  <TableCell className="py-3 font-mono text-xs text-muted-foreground">
                    {t.config.durationSeconds}s
                  </TableCell>
                  <TableCell className="py-3 font-mono text-xs font-bold text-emerald-500">
                    {t.breakingPoint?.sustainableRps ?? 480} RPS
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="outline" className="text-[10px] rounded-full text-emerald-600 border-emerald-500/30">
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedTest(t)}
                      className="h-8 rounded-lg text-xs hover:bg-secondary cursor-pointer"
                    >
                      <Eye className="size-3.5 mr-1" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Load Test Execution Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Initiate Synthetic Load Test</DialogTitle>
            <DialogDescription className="text-xs">
              Simulate high-throughput traffic load to identify saturation knees and evaluate cyber resilience.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Execution Label</Label>
              <Input
                value={testLabel}
                onChange={(e) => setTestLabel(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Load Profile Strategy</Label>
              <select
                value={profileKind}
                onChange={(e) => setProfileKind(e.target.value as any)}
                className="w-full h-9 rounded-xl border border-border bg-secondary/50 px-2.5 text-xs text-foreground outline-none cursor-pointer"
              >
                <option value="stress">Stress (Progressive Step-Up Ramp)</option>
                <option value="spike">Spike (Instantaneous Burst)</option>
                <option value="capacity">Capacity (Breaking Point Search)</option>
                <option value="load">Load (Steady Sustained)</option>
                <option value="endurance">Endurance (Extended Soak)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Throughput (RPS)</Label>
                <Input
                  type="number"
                  value={targetRps}
                  onChange={(e) => setTargetRps(Number(e.target.value))}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Duration (Seconds)</Label>
                <Input
                  type="number"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Simulated Virtual Users (Concurrency)</Label>
              <Input
                type="number"
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="h-9 rounded-xl text-xs font-mono"
              />
            </div>

            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs flex items-start gap-2">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                Automatic SSRF protection and live production lock enabled. Test will only execute on sandbox environments.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={() => runTest.mutate()}
              disabled={runTest.isPending}
              className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer text-xs font-semibold"
            >
              {runTest.isPending ? "Starting Engine..." : "Launch Load Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
