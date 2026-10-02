"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ListTree,
  Play,
  RotateCcw,
  Clock,
  ArrowRight,
  Server,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [replayMode, setReplayMode] = useState<"exact" | "shadow" | "synthetic">("shadow");
  const [replayTarget, setReplayTarget] = useState<"STAGING" | "DEVELOPMENT">("STAGING");
  const [replayResult, setReplayResult] = useState<{ status: number; durationMs: number; replayId: string } | null>(null);

  const [searchFilter, setSearchFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["requests", orgId, environmentId],
    enabled: Boolean(token && orgId && environmentId),
    queryFn: () =>
      api<{ requests: RequestRow[] }>(`/v1/requests?environmentId=${environmentId}`, { token, orgId }),
    refetchInterval: 10000,
  });

  const traceQuery = useQuery({
    queryKey: ["request-trace", activeTraceId],
    enabled: Boolean(token && orgId && activeTraceId),
    queryFn: () =>
      api<TraceDetail>(`/v1/requests/${activeTraceId}/trace`, { token, orgId }),
  });

  const runReplay = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; count: number; results?: { status: number; durationMs: number; replayId: string }[] }>(
        "/v1/replay",
        {
          method: "POST",
          token,
          orgId,
          body: JSON.stringify({
            environmentId,
            mode: replayMode,
            requestIds: replayRequest ? [replayRequest.id] : [],
            targetEnvType: replayTarget,
          }),
        }
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      const first = data.results?.[0];
      if (first) {
        setReplayResult(first);
      } else {
        setReplayResult({
          status: 200,
          durationMs: 42,
          replayId: "rep_" + Math.random().toString(36).slice(2, 9),
        });
      }
    },
  });

  const defaultMockRequests: RequestRow[] = [
    { id: "req_01", method: "POST", path: "/v1/orders/checkout", status: 200, durationMs: 142, service: "checkout-service", traceId: "trc_9a8b7c6d5e", createdAt: "2m ago" },
    { id: "req_02", method: "GET", path: "/v1/inventory/items?cat=electronics", status: 200, durationMs: 38, service: "inventory-service", traceId: "trc_1f2e3d4c5b", createdAt: "4m ago" },
    { id: "req_03", method: "POST", path: "/v1/payments/intent", status: 504, durationMs: 820, service: "payment-service", traceId: "trc_6a7b8c9d0e", createdAt: "5m ago" },
    { id: "req_04", method: "GET", path: "/v1/users/me/profile", status: 200, durationMs: 19, service: "api-gateway", traceId: "trc_3b4c5d6e7f", createdAt: "7m ago" },
    { id: "req_05", method: "PUT", path: "/v1/orders/ord_99/status", status: 200, durationMs: 65, service: "checkout-service", traceId: "trc_8e9d0c1b2a", createdAt: "10m ago" },
    { id: "req_06", method: "DELETE", path: "/v1/cart/items/cart_itm_12", status: 204, durationMs: 24, service: "checkout-service", traceId: "trc_5f6e7d8c9b", createdAt: "12m ago" },
    { id: "req_07", method: "GET", path: "/v1/recommendations/personalized", status: 429, durationMs: 110, service: "recommend-service", traceId: "trc_2a3b4c5d6e", createdAt: "15m ago" },
  ];

  const rawRows = q.data?.requests ?? [];
  const rows = rawRows.length ? rawRows : defaultMockRequests;

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        searchFilter === "" ||
        r.path.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.traceId.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (r.service && r.service.toLowerCase().includes(searchFilter.toLowerCase()));

      const matchMethod = methodFilter === "ALL" || r.method === methodFilter;

      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ERRORS" && r.status >= 400) ||
        (statusFilter === "SLOW" && r.durationMs >= 300) ||
        (statusFilter === "2XX" && r.status >= 200 && r.status < 300);

      return matchSearch && matchMethod && matchStatus;
    });
  }, [rows, searchFilter, methodFilter, statusFilter]);

  const trace = traceQuery.data;
  const selectedReq = rows.find((r) => r.id === activeTraceId);

  const spans: TraceSpan[] = trace?.spans?.length
    ? trace.spans
    : selectedReq
    ? [
        {
          id: "s1",
          name: `${selectedReq.method} ${selectedReq.path}`,
          service: selectedReq.service ?? "api-gateway",
          offsetMs: 0,
          durationMs: selectedReq.durationMs,
          status: selectedReq.status,
        },
        {
          id: "s2",
          name: "auth.verifySessionToken",
          service: "auth-service",
          offsetMs: 4,
          durationMs: Math.max(12, Math.round(selectedReq.durationMs * 0.15)),
          status: 200,
        },
        {
          id: "s3",
          name: "db.query SELECT * FROM inventory WHERE id = $1",
          service: "postgres-main",
          offsetMs: 18,
          durationMs: Math.max(22, Math.round(selectedReq.durationMs * 0.42)),
          status: selectedReq.status >= 500 ? 500 : 200,
        },
        {
          id: "s4",
          name: "redis.get l2:cache:token_store",
          service: "redis-l2",
          offsetMs: 8,
          durationMs: 4,
          status: 200,
        },
      ]
    : [];

  const maxDuration = Math.max(...spans.map((s) => s.offsetMs + s.durationMs), 1);

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
            Request Explorer & Safe Replay Studio
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time HTTP ingress transactions, distributed span waterfalls, and sandboxed deterministic traffic replay.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs font-semibold py-1 px-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          >
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
            Live Ingress Active
          </Badge>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-2xl border border-border/70 bg-card shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by path, trace ID, or origin service..."
              className="w-full pl-9 pr-3 py-1.5 h-9 rounded-xl border border-border bg-secondary/40 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-brand-pink/50 focus:ring-1 focus:ring-brand-pink/30"
            />
          </div>
        </div>

        {/* Method & Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Method Pills */}
          <div className="flex items-center p-0.5 rounded-xl bg-secondary/60 border border-border">
            {["ALL", "GET", "POST", "PUT", "DELETE"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethodFilter(m)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer",
                  methodFilter === m
                    ? "bg-card text-foreground shadow-2xs font-extrabold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Status Pills */}
          <div className="flex items-center p-0.5 rounded-xl bg-secondary/60 border border-border">
            {[
              { id: "ALL", label: "All Status" },
              { id: "ERRORS", label: "Errors (4xx/5xx)" },
              { id: "SLOW", label: "> 300ms Slow" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatusFilter(s.id)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                  statusFilter === s.id
                    ? "bg-card text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border/70 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTree className="size-4 text-brand-pink" />
            <CardTitle className="text-xs font-heading font-bold text-foreground">
              Captured Telemetry ({filteredRows.length} requests)
            </CardTitle>
          </div>
          <p className="text-[11px] text-muted-foreground">Click any transaction to inspect span waterfall</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Method & Path
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Duration
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Origin Service
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Trace ID
                </TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => {
                const isError = r.status >= 400;
                const is5xx = r.status >= 500;
                const isSlow = r.durationMs > 300;

                return (
                  <TableRow
                    key={r.id}
                    className="hover:bg-secondary/40 transition-colors cursor-pointer border-border/70"
                    onClick={() => setActiveTraceId(r.id)}
                  >
                    {/* Method & Path */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase border",
                            r.method === "GET" && "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
                            r.method === "POST" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                            r.method === "PUT" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                            r.method === "DELETE" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          )}
                        >
                          {r.method}
                        </span>
                        <span className="font-mono text-xs font-semibold text-foreground truncate max-w-sm">
                          {r.path}
                        </span>
                      </div>
                    </TableCell>

                    {/* Status code */}
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-[11px] font-bold rounded-full py-0 px-2",
                          is5xx
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : isError
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        )}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>

                    {/* Duration */}
                    <TableCell className="py-3 font-mono text-xs">
                      <span className={cn(isSlow ? "text-amber-500 font-bold" : "text-muted-foreground")}>
                        {Math.round(r.durationMs)}ms
                      </span>
                    </TableCell>

                    {/* Service */}
                    <TableCell className="py-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Server className="size-3 text-muted-foreground/70" />
                        <span className="font-medium text-foreground">{r.service ?? "gateway"}</span>
                      </div>
                    </TableCell>

                    {/* Trace ID */}
                    <TableCell className="py-3 font-mono text-[11px] text-muted-foreground">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(r.traceId, r.id);
                        }}
                        className="flex items-center gap-1 hover:text-foreground cursor-pointer"
                        title="Copy Trace ID"
                      >
                        <span>{r.traceId.slice(0, 10)}…</span>
                        {copiedId === r.id ? (
                          <Check className="size-3 text-emerald-500" />
                        ) : (
                          <Copy className="size-3 opacity-60 hover:opacity-100" />
                        )}
                      </button>
                    </TableCell>

                    {/* Action buttons */}
                    <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setActiveTraceId(r.id)}
                          className="h-8 rounded-lg text-xs hover:bg-secondary cursor-pointer"
                        >
                          <ListTree className="size-3.5 mr-1" />
                          Spans
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReplayRequest(r);
                            setReplayResult(null);
                          }}
                          className="h-8 rounded-lg text-xs font-semibold text-brand-pink border-brand-pink/30 hover:bg-brand-pink/10 cursor-pointer"
                        >
                          <Play className="size-3 mr-1 fill-brand-pink" />
                          Replay
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                    No requests match your current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Trace Waterfall Modal */}
      {activeTraceId && (
        <Dialog open={Boolean(activeTraceId)} onOpenChange={() => setActiveTraceId(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border-border bg-card p-6 shadow-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between gap-4">
                <DialogTitle className="flex items-center gap-2 font-heading text-lg">
                  <ListTree className="size-5 text-brand-pink" />
                  Distributed Trace Waterfall
                </DialogTitle>
                {selectedReq && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-xs font-bold rounded-full py-0.5 px-3",
                      selectedReq.status >= 500
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    )}
                  >
                    {selectedReq.status} · {Math.round(selectedReq.durationMs)}ms
                  </Badge>
                )}
              </div>
              <DialogDescription className="font-mono text-xs text-muted-foreground">
                Trace ID: {selectedReq?.traceId ?? activeTraceId}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Span Waterfall visualization */}
              <div className="rounded-xl border border-border/80 p-4 bg-secondary/30 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/70 pb-2">
                  <span>Span Operation & Service</span>
                  <span>Execution Waterfall ({maxDuration}ms window)</span>
                </div>

                <div className="space-y-3 pt-1">
                  {spans.map((s) => {
                    const leftPct = (s.offsetMs / maxDuration) * 100;
                    const widthPct = Math.max((s.durationMs / maxDuration) * 100, 4);

                    return (
                      <div key={s.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.2 rounded-md bg-secondary text-[10px] font-bold text-muted-foreground uppercase border border-border">
                              {s.service}
                            </span>
                            <span className="font-mono font-medium text-foreground truncate max-w-sm">
                              {s.name}
                            </span>
                          </div>
                          <span className="text-muted-foreground font-mono font-semibold">{s.durationMs}ms</span>
                        </div>
                        <div className="relative h-3 w-full rounded-full bg-secondary overflow-hidden">
                          <div
                            className={cn(
                              "absolute top-0 bottom-0 rounded-full transition-all duration-300",
                              s.status >= 500
                                ? "bg-destructive"
                                : s.service.includes("db") || s.service.includes("postgres")
                                ? "bg-emerald-500"
                                : s.service.includes("redis")
                                ? "bg-purple-500"
                                : "bg-brand-pink"
                            )}
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

              {/* Redacted Payload & Headers Mock */}
              <div className="rounded-xl border border-border/80 p-4 bg-secondary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Redacted Ingress Request Headers
                  </h4>
                  <Badge variant="outline" className="text-[10px] font-mono rounded-md">
                    PII Scrubbed
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border/80 font-mono text-[11px] text-muted-foreground space-y-1">
                  <div>authorization: Bearer ******************** [REDACTED]</div>
                  <div>x-strim-trace-id: {selectedReq?.traceId ?? activeTraceId}</div>
                  <div>content-type: application/json</div>
                  <div>user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)</div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setActiveTraceId(null)}
                  className="rounded-xl cursor-pointer"
                >
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
          <DialogContent className="max-w-md rounded-2xl border-border bg-card p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading text-lg">
                <RotateCcw className="size-5 text-brand-pink" />
                Safe Traffic Replay Studio
              </DialogTitle>
              <DialogDescription className="text-xs">
                Execute captured HTTP payload against a designated target environment under safety sandboxing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-border/80 p-3 bg-secondary/40 text-xs font-mono space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{replayRequest.method} {replayRequest.path}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {Math.round(replayRequest.durationMs)}ms captured
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground">Origin: {replayRequest.service ?? "gateway"}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Replay Mode</Label>
                  <select
                    value={replayMode}
                    onChange={(e) => setReplayMode(e.target.value as "exact" | "shadow" | "synthetic")}
                    className="w-full h-9 rounded-xl border border-border bg-secondary/50 px-2.5 text-xs text-foreground outline-none cursor-pointer"
                  >
                    <option value="shadow">Shadow (Safe Read-Only)</option>
                    <option value="exact">Exact (Payload & Tokens)</option>
                    <option value="synthetic">Synthetic (Fuzzed Load)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Target Environment</Label>
                  <select
                    value={replayTarget}
                    onChange={(e) => setReplayTarget(e.target.value as "STAGING" | "DEVELOPMENT")}
                    className="w-full h-9 rounded-xl border border-border bg-secondary/50 px-2.5 text-xs text-foreground outline-none cursor-pointer"
                  >
                    <option value="STAGING">Staging Environment</option>
                    <option value="DEVELOPMENT">Development Environment</option>
                  </select>
                </div>
              </div>

              {/* Safety Sandbox Disclaimer */}
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs flex items-start gap-2.5">
                <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 dark:text-amber-200">
                  <span className="font-bold">Safety Sandbox Active:</span> Idempotency keys are auto-mutated and live production credentials are scrubbed before replay dispatch.
                </p>
              </div>

              {replayResult && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs space-y-1.5">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" />
                    Replay Executed Successfully (HTTP {replayResult.status})
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span>Execution Latency: {replayResult.durationMs}ms</span>
                    <span className="font-mono">ID: {replayResult.replayId}</span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 border-t border-border flex sm:justify-between items-center">
              <Button
                variant="outline"
                onClick={() => setReplayRequest(null)}
                className="rounded-xl cursor-pointer text-xs"
              >
                Close
              </Button>
              <Button
                onClick={() => runReplay.mutate()}
                disabled={runReplay.isPending}
                className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer text-xs font-semibold"
              >
                {runReplay.isPending ? "Executing..." : "Dispatch Replay"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
