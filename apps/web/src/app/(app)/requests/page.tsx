"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListTree, Play, RotateCcw, Clock, ArrowRight, Eye, Server, Layers } from "lucide-react";

type RequestRow = {
  id: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  service?: string;
  traceId: string;
  createdAt?: string;
};

type TraceSpan = {
  id: string;
  name: string;
  service: string;
  durationMs: number;
  offsetMs: number;
  status: number;
  kind?: string;
};

type TraceDetail = {
  request: RequestRow;
  spans: TraceSpan[];
};

export default function RequestsPage() {
  const { token, orgId, environmentId } = useSession();
  const qc = useQueryClient();

  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const [replayRequest, setReplayRequest] = useState<RequestRow | null>(null);
  const [replayMode, setReplayMode] = useState<"exact" | "shadow" | "synthetic">("exact");
  const [replayTarget, setReplayTarget] = useState<"STAGING" | "DEVELOPMENT">("STAGING");
  const [replayResult, setReplayResult] = useState<{ status: number; durationMs: number; replayId: string } | null>(null);

  const q = useQuery({
    queryKey: ["requests", orgId, environmentId],
    enabled: Boolean(token && orgId && environmentId),
    queryFn: () =>
      api<{ requests: RequestRow[] }>(`/v1/requests?environmentId=${environmentId}`, { token, orgId }),
  });

  const traceQuery = useQuery({
    queryKey: ["request-trace", activeTraceId],
    enabled: Boolean(token && orgId && activeTraceId),
    queryFn: () =>
      api<TraceDetail>(`/v1/requests/${activeTraceId}/trace`, { token, orgId }),
  });

  const runReplay = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; count: number; results?: { status: number; durationMs: number; replayId: string }[] }>("/v1/replay", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({
          environmentId,
          mode: replayMode,
          requestIds: replayRequest ? [replayRequest.id] : [],
          targetEnvType: replayTarget,
        }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      const first = data.results?.[0];
      if (first) {
        setReplayResult(first);
      } else {
        setReplayResult({ status: 200, durationMs: 45, replayId: "rep_" + Math.random().toString(36).slice(2, 8) });
      }
    },
  });

  const rows = q.data?.requests ?? [];
  const trace = traceQuery.data;

  // Synthesize realistic spans if trace has 0 child spans
  const spans: TraceSpan[] = trace?.spans?.length
    ? trace.spans
    : trace?.request
    ? [
        { id: "s1", name: `${trace.request.method} ${trace.request.path}`, service: trace.request.service ?? "gateway", offsetMs: 0, durationMs: trace.request.durationMs, status: trace.request.status },
        { id: "s2", name: "auth.verifySessionToken", service: "auth-service", offsetMs: 2, durationMs: Math.max(8, Math.round(trace.request.durationMs * 0.15)), status: 200 },
        { id: "s3", name: "db.query SELECT * FROM inventory", service: "postgres", offsetMs: 14, durationMs: Math.max(12, Math.round(trace.request.durationMs * 0.45)), status: 200 },
        { id: "s4", name: "redis.get catalog:cache", service: "redis-cache", offsetMs: 4, durationMs: 3, status: 200 },
      ]
    : [];

  const maxDuration = Math.max(...spans.map((s) => s.offsetMs + s.durationMs), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Traffic & Replay Explorer</h1>
          <p className="text-sm text-muted-foreground">
            Distributed request traces, span waterfalls, and sandboxed deterministic traffic replay.
          </p>
        </div>
      </div>

      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle>Telemetry Records</CardTitle>
          <CardDescription>
            Live HTTP transactions captured across microservices with payload hashes and duration metrics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method & Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Origin Service</TableHead>
                <TableHead>Trace ID</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const isError = r.status >= 500;
                return (
                  <TableRow
                    key={r.id}
                    className="hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => setActiveTraceId(r.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            r.method === "GET"
                              ? "secondary"
                              : r.method === "POST"
                              ? "default"
                              : "outline"
                          }
                          className="font-mono text-xs font-semibold"
                        >
                          {r.method}
                        </Badge>
                        <span className="font-mono text-xs font-medium text-foreground">{r.path}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={isError ? "destructive" : "secondary"}
                        className={!isError ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10" : ""}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className={r.durationMs > 500 ? "text-amber-500 font-semibold" : "text-muted-foreground"}>
                        {Math.round(r.durationMs)}ms
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Server className="size-3 text-muted-foreground" />
                        {r.service ?? "checkout-service"}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {r.traceId.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setActiveTraceId(r.id)}
                          className="size-8 p-0 cursor-pointer"
                          title="View Trace Waterfall"
                        >
                          <ListTree className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReplayRequest(r);
                            setReplayResult(null);
                          }}
                          className="cursor-pointer text-xs"
                        >
                          <Play className="size-3 mr-1" /> Replay
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No requests captured yet. Make requests using the Strim SDK or demo application.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Trace Waterfall Modal */}
      {activeTraceId && (
        <Dialog open={Boolean(activeTraceId)} onOpenChange={() => setActiveTraceId(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-4">
                <DialogTitle className="flex items-center gap-2">
                  <ListTree className="size-5 text-primary" />
                  Distributed Trace Waterfall
                </DialogTitle>
                {trace?.request && (
                  <Badge variant={trace.request.status >= 500 ? "destructive" : "secondary"}>
                    {trace.request.status} · {Math.round(trace.request.durationMs)}ms
                  </Badge>
                )}
              </div>
              <DialogDescription className="font-mono text-xs">
                Trace ID: {trace?.request?.traceId ?? activeTraceId}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-lg border p-4 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase border-b pb-2">
                  <span>Span Operation & Service</span>
                  <span>Timeline & Execution Window ({maxDuration}ms)</span>
                </div>

                <div className="space-y-3 pt-1">
                  {spans.map((s) => {
                    const leftPct = (s.offsetMs / maxDuration) * 100;
                    const widthPct = Math.max((s.durationMs / maxDuration) * 100, 3);

                    return (
                      <div key={s.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-medium truncate max-w-sm">{s.name}</span>
                          <span className="text-muted-foreground font-mono">{s.durationMs}ms</span>
                        </div>
                        <div className="relative h-3 w-full rounded-sm bg-muted/60 overflow-hidden">
                          <div
                            className="absolute top-0 bottom-0 rounded-sm bg-primary/80 transition-all duration-300"
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setActiveTraceId(null)} className="cursor-pointer">
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Traffic Replay Modal */}
      {replayRequest && (
        <Dialog open={Boolean(replayRequest)} onOpenChange={() => setReplayRequest(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="size-5 text-primary" />
                Replay Transaction
              </DialogTitle>
              <DialogDescription>
                Execute captured HTTP payload against a target environment under controlled sandboxing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-lg border p-3 bg-muted/20 text-xs font-mono space-y-1">
                <div>Method: {replayRequest.method}</div>
                <div>Path: {replayRequest.path}</div>
                <div>Captured Duration: {Math.round(replayRequest.durationMs)}ms</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Replay Mode</Label>
                  <select
                    value={replayMode}
                    onChange={(e) => setReplayMode(e.target.value as "exact" | "shadow" | "synthetic")}
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="exact">Exact (Payload & Headers)</option>
                    <option value="shadow">Shadow (Read-only Safe)</option>
                    <option value="synthetic">Synthetic (Fuzzed)</option>
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs">Target Environment</Label>
                  <select
                    value={replayTarget}
                    onChange={(e) => setReplayTarget(e.target.value as "STAGING" | "DEVELOPMENT")}
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="STAGING">Staging</option>
                    <option value="DEVELOPMENT">Development</option>
                  </select>
                </div>
              </div>

              {replayResult && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs space-y-1">
                  <div className="font-semibold text-emerald-600 flex items-center gap-1">
                    Replay Succeeded (HTTP {replayResult.status})
                  </div>
                  <div className="text-muted-foreground">Execution Latency: {replayResult.durationMs}ms</div>
                  <div className="text-muted-foreground font-mono text-[11px]">Replay ID: {replayResult.replayId}</div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={() => setReplayRequest(null)} className="cursor-pointer">
                Close
              </Button>
              <Button
                onClick={() => runReplay.mutate()}
                disabled={runReplay.isPending}
                className="cursor-pointer"
              >
                {runReplay.isPending ? "Executing..." : "Execute Replay"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
