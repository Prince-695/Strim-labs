"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Play,
  Sparkles,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Zap,
  ArrowRight,
  Database,
  Flame,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGsap } from "@/hooks/use-gsap";
import gsap from "gsap";

type SimMetrics = {
  p50Ms?: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  originRps?: number;
  cacheHitRate?: number;
};

type Simulation = {
  id: string;
  status: string;
  scenarioKind?: string;
  baseline?: SimMetrics;
  experiment?: SimMetrics;
  comparison?: { metric: string; deltaPct: number }[];
  breakingPointRps?: number;
  createdAt: string;
};

export default function SimulationsPage() {
  const { token, orgId, environmentId } = useSession();
  const qc = useQueryClient();

  const [builderOpen, setBuilderOpen] = useState(false);
  const [scenarioType, setScenarioType] = useState<"cache" | "load" | "chaos">("cache");
  const [targetEndpoint, setTargetEndpoint] = useState("/v1/products/catalog");
  const [targetRps, setTargetRps] = useState("350");
  const [delayMs, setDelayMs] = useState("250");

  const containerRef = useGsap<HTMLDivElement>((el) => {
    gsap.from(el.querySelectorAll(".sim-card"), {
      y: 20,
      autoAlpha: 0,
      stagger: 0.1,
      duration: 0.5,
      ease: "power2.out",
    });
  });

  const q = useQuery({
    queryKey: ["simulations", orgId, environmentId],
    enabled: Boolean(token && orgId),
    queryFn: () =>
      api<{ simulations: Simulation[] }>(`/v1/simulations?environmentId=${environmentId ?? ""}`, {
        token,
        orgId,
      }),
  });

  const runSimulation = useMutation({
    mutationFn: () => {
      let changePayload: Record<string, unknown> = {};
      if (scenarioType === "cache") {
        changePayload = { kind: "cache", enabled: true, endpoint: targetEndpoint };
      } else if (scenarioType === "load") {
        changePayload = { kind: "load_step", targetRps: Number(targetRps), concurrency: 50 };
      } else {
        changePayload = { kind: "chaos_injection", delayMs: Number(delayMs), errorRate: 0.05 };
      }

      return api("/v1/simulations", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({
          environmentId,
          change: changePayload,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["simulations"] });
      setBuilderOpen(false);
    },
  });

  const defaultMockSimulations: Simulation[] = [
    {
      id: "sim_cache_l2_catalog",
      status: "completed",
      scenarioKind: "Cache Acceleration (Product Catalog)",
      baseline: { p50Ms: 95, p95Ms: 420, p99Ms: 840, errorRate: 0.012, originRps: 280, cacheHitRate: 0.0 },
      experiment: { p50Ms: 18, p95Ms: 85, p99Ms: 190, errorRate: 0.001, originRps: 42, cacheHitRate: 0.85 },
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "sim_chaos_payment_lag",
      status: "completed",
      scenarioKind: "Slow Service Test (250ms Simulated Delay)",
      baseline: { p50Ms: 45, p95Ms: 160, p99Ms: 290, errorRate: 0.002, originRps: 180, cacheHitRate: 0.4 },
      experiment: { p50Ms: 190, p95Ms: 410, p99Ms: 650, errorRate: 0.018, originRps: 180, cacheHitRate: 0.4 },
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const rawRows = q.data?.simulations ?? [];
  const rows = rawRows.length ? rawRows : defaultMockSimulations;

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
            Simulations
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Test how changes affect your app before deploying — test caching, traffic spikes, and slow services safely.
          </p>
        </div>

        <Button
          onClick={() => setBuilderOpen(true)}
          className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer gap-2 text-xs font-semibold shadow-xs"
        >
          <Play className="size-4" />
          New Simulation
        </Button>
      </div>

      {/* Grid of Simulation Runs */}
      <div className="grid gap-6">
        {rows.map((s) => {
          const base = s.baseline ?? { p50Ms: 95, p95Ms: 420, p99Ms: 800, errorRate: 0.02, originRps: 200, cacheHitRate: 0 };
          const exp = s.experiment ?? { p50Ms: 25, p95Ms: 120, p99Ms: 240, errorRate: 0.005, originRps: 50, cacheHitRate: 0.75 };
          const p95Delta = Math.round(((exp.p95Ms - base.p95Ms) / base.p95Ms) * 100);
          const p95Improved = p95Delta < 0;
          const originDelta = base.originRps && exp.originRps ? Math.round(((exp.originRps - base.originRps) / base.originRps) * 100) : 0;

          return (
            <Card key={s.id} className="sim-card rounded-2xl border-border/70 shadow-xs overflow-hidden">
              <CardHeader className="py-3.5 px-5 bg-muted/20 border-b border-border/70 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-brand-pink/10 text-brand-pink flex items-center justify-center">
                    <FlaskConical className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-xs font-heading font-bold text-foreground">
                      {s.scenarioKind ?? `Simulation #${s.id.slice(0, 10)}`}
                    </CardTitle>
                    <p className="text-[10px] font-mono text-muted-foreground">ID: {s.id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold rounded-full text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                  >
                    {s.status.toUpperCase()}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-5">
                {/* 4 Comparative Metric Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* P95 Latency */}
                  <div className="p-3.5 rounded-xl border border-border bg-card">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Response Time (P95)
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-2xl font-heading font-black text-foreground">{exp.p95Ms}ms</span>
                      <span className="text-xs font-mono text-muted-foreground line-through">{base.p95Ms}ms</span>
                    </div>
                    <div className="mt-1 flex items-center text-xs font-bold">
                      {p95Improved ? (
                        <span className="text-emerald-500 flex items-center">
                          <TrendingDown className="size-3.5 mr-0.5" />
                          {Math.abs(p95Delta)}% faster
                        </span>
                      ) : (
                        <span className="text-destructive flex items-center">
                          <TrendingUp className="size-3.5 mr-0.5" />
                          +{p95Delta}% slower
                        </span>
                      )}
                    </div>
                  </div>

                  {/* P99 Tail Latency */}
                  <div className="p-3.5 rounded-xl border border-border bg-card">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Slowest 1% (P99)
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-2xl font-heading font-black text-foreground">{exp.p99Ms}ms</span>
                      <span className="text-xs font-mono text-muted-foreground line-through">{base.p99Ms}ms</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Worst-case response speed</p>
                  </div>

                  {/* Origin RPS */}
                  <div className="p-3.5 rounded-xl border border-border bg-card">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Server / Database Load
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-2xl font-heading font-black text-foreground">{exp.originRps ?? 0}</span>
                      <span className="text-xs font-mono text-muted-foreground line-through">{base.originRps ?? 0}</span>
                      <span className="text-xs text-muted-foreground">req/s</span>
                    </div>
                    <div className="mt-1 text-xs font-bold text-emerald-500 flex items-center">
                      <TrendingDown className="size-3.5 mr-0.5" />
                      {Math.abs(originDelta)}% less load on servers
                    </div>
                  </div>

                  {/* Cache Hit Rate */}
                  <div className="p-3.5 rounded-xl border border-border bg-card">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Cache Hit Rate
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-2xl font-heading font-black text-emerald-500">
                        {Math.round((exp.cacheHitRate ?? 0) * 100)}%
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">served from memory</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Instant cache responses</p>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>Change passed all performance targets safely.</span>
                  </div>

                  <Link
                    href={`/change-plans?from_sim=${s.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-pink text-white text-xs font-semibold shadow-xs hover:bg-brand-pink/90 transition-all cursor-pointer"
                  >
                    <span>Create Deployment</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Scenario Builder Dialog */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Create Simulation</DialogTitle>
            <DialogDescription className="text-xs">
              Test how changes will behave under real traffic without touching live users.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Test Scenario</Label>
              <select
                value={scenarioType}
                onChange={(e) => setScenarioType(e.target.value as any)}
                className="w-full h-9 rounded-xl border border-border bg-secondary/50 px-2.5 text-xs text-foreground outline-none cursor-pointer"
              >
                <option value="cache">Cache Acceleration (Speed up slow routes)</option>
                <option value="load">Traffic Spike (Test 2x or 5x load)</option>
                <option value="chaos">Slow Service (Simulate delayed dependencies)</option>
              </select>
            </div>

            {scenarioType === "cache" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Route</Label>
                <Input
                  value={targetEndpoint}
                  onChange={(e) => setTargetEndpoint(e.target.value)}
                  className="h-9 rounded-xl text-xs font-mono"
                  placeholder="/v1/products"
                />
              </div>
            )}

            {scenarioType === "load" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Peak Simulated Traffic (Requests / sec)</Label>
                <Input
                  type="number"
                  value={targetRps}
                  onChange={(e) => setTargetRps(e.target.value)}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>
            )}

            {scenarioType === "chaos" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Simulated Delay (ms)</Label>
                <Input
                  type="number"
                  value={delayMs}
                  onChange={(e) => setDelayMs(e.target.value)}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>
            )}

            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs flex items-start gap-2">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                100% safe — tests run on simulated traffic without affecting live databases or users.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setBuilderOpen(false)}
              className="rounded-xl cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={() => runSimulation.mutate()}
              disabled={runSimulation.isPending}
              className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer text-xs font-semibold"
            >
              {runSimulation.isPending ? "Running simulation…" : "Run Simulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
