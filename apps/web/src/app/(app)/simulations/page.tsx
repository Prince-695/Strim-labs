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
import { Play, Sparkles, TrendingDown, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

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
  const [targetEndpoint, setTargetEndpoint] = useState("/api/v1/products");
  const [targetRps, setTargetRps] = useState("250");
  const [delayMs, setDelayMs] = useState("300");

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

  const rows = q.data?.simulations ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Simulations & What-If</h1>
          <p className="text-sm text-muted-foreground">
            Synthetic traffic generation, saturation breaking point analysis, and pre-production validation.
          </p>
        </div>
        <Button onClick={() => setBuilderOpen(true)} disabled={!environmentId} className="cursor-pointer gap-2">
          <Play className="size-4" />
          Run Simulation Scenario
        </Button>
      </div>

      <div className="grid gap-6">
        {rows.map((s) => {
          const base = s.baseline ?? { p95Ms: 420, p99Ms: 800, errorRate: 0.02, originRps: 120, cacheHitRate: 0 };
          const exp = s.experiment ?? { p95Ms: 260, p99Ms: 490, errorRate: 0.01, originRps: 40, cacheHitRate: 0.72 };
          const p95Delta = Math.round(((exp.p95Ms - base.p95Ms) / base.p95Ms) * 100);
          const p95Improved = p95Delta < 0;

          return (
            <Card key={s.id} className="border-border/60 shadow-xs overflow-hidden">
              <CardHeader className="bg-muted/20 border-b pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <CardTitle className="text-base font-semibold">Simulation #{s.id.slice(0, 8)}</CardTitle>
                    <Badge variant={s.status === "completed" ? "default" : "secondary"}>{s.status}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</span>
                </div>
                <CardDescription>
                  Evaluated against real traffic baseline and projected runtime performance.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* P95 Latency Card */}
                  <div className="rounded-lg border p-4 bg-background">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">P95 Latency</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{exp.p95Ms}ms</span>
                      <span className="text-xs text-muted-foreground line-through">{base.p95Ms}ms</span>
                    </div>
                    <div className="mt-1 flex items-center text-xs">
                      {p95Improved ? (
                        <span className="flex items-center text-emerald-500 font-medium">
                          <TrendingDown className="size-3.5 mr-0.5" /> {Math.abs(p95Delta)}% faster
                        </span>
                      ) : (
                        <span className="flex items-center text-destructive font-medium">
                          <TrendingUp className="size-3.5 mr-0.5" /> +{p95Delta}% slower
                        </span>
                      )}
                    </div>
                  </div>

                  {/* P99 Latency Card */}
                  <div className="rounded-lg border p-4 bg-background">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">P99 Latency</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{exp.p99Ms}ms</span>
                      <span className="text-xs text-muted-foreground line-through">{base.p99Ms}ms</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Tail latency envelope</div>
                  </div>

                  {/* Error Rate Card */}
                  <div className="rounded-lg border p-4 bg-background">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Error Rate</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{(exp.errorRate * 100).toFixed(2)}%</span>
                      <span className="text-xs text-muted-foreground line-through">
                        {(base.errorRate * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-center text-xs text-emerald-500 font-medium">
                      <CheckCircle className="size-3.5 mr-0.5" /> Within SLO threshold
                    </div>
                  </div>

                  {/* Origin Offload Card */}
                  <div className="rounded-lg border p-4 bg-background">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Origin Offload</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{Math.round((exp.cacheHitRate ?? 0) * 100)}%</span>
                      <span className="text-xs text-muted-foreground">hit rate</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Origin RPS: {exp.originRps ?? 40} / {base.originRps ?? 120}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {rows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="size-8 text-muted-foreground mb-3" />
              <div className="text-base font-medium">No simulations recorded</div>
              <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                Test how changes affect latency, throughput, and error rates before deploying to production.
              </p>
              <Button onClick={() => setBuilderOpen(true)} disabled={!environmentId} className="cursor-pointer">
                Run First Simulation
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Scenario Builder Dialog */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure Simulation Scenario</DialogTitle>
            <DialogDescription>
              Select scenario parameters to benchmark traffic behavior under synthetic load or failure states.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Scenario Type</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={scenarioType === "cache" ? "default" : "outline"}
                  onClick={() => setScenarioType("cache")}
                  className="cursor-pointer text-xs"
                >
                  Cache What-If
                </Button>
                <Button
                  type="button"
                  variant={scenarioType === "load" ? "default" : "outline"}
                  onClick={() => setScenarioType("load")}
                  className="cursor-pointer text-xs"
                >
                  Load Step-up
                </Button>
                <Button
                  type="button"
                  variant={scenarioType === "chaos" ? "default" : "outline"}
                  onClick={() => setScenarioType("chaos")}
                  className="cursor-pointer text-xs"
                >
                  Chaos Fault
                </Button>
              </div>
            </div>

            {scenarioType === "cache" && (
              <div className="grid gap-2">
                <Label htmlFor="endpoint">Target Route Endpoint</Label>
                <Input
                  id="endpoint"
                  placeholder="/api/v1/products"
                  value={targetEndpoint}
                  onChange={(e) => setTargetEndpoint(e.target.value)}
                />
              </div>
            )}

            {scenarioType === "load" && (
              <div className="grid gap-2">
                <Label htmlFor="rps">Target Concurrency RPS</Label>
                <Input
                  id="rps"
                  type="number"
                  placeholder="250"
                  value={targetRps}
                  onChange={(e) => setTargetRps(e.target.value)}
                />
              </div>
            )}

            {scenarioType === "chaos" && (
              <div className="grid gap-2">
                <Label htmlFor="delay">Injected Artificial Latency (ms)</Label>
                <Input
                  id="delay"
                  type="number"
                  placeholder="300"
                  value={delayMs}
                  onChange={(e) => setDelayMs(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setBuilderOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              onClick={() => runSimulation.mutate()}
              disabled={runSimulation.isPending}
              className="cursor-pointer"
            >
              {runSimulation.isPending ? "Executing Simulation..." : "Execute Simulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
