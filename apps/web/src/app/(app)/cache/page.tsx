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
  Database,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
  ArrowDownRight,
  Layers,
  Sparkles,
  CheckCircle2,
  Trash,
  ShieldCheck,
  Tag,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Rule = {
  id: string;
  endpoint: string;
  method: string;
  ttlSeconds: number;
  enabled: boolean;
  tags?: string[];
};

type CacheAnalytics = {
  totalRequests: number;
  hits: number;
  misses: number;
  hitRate: number;
  originReductionPct: number;
  bandwidthSaved: string;
};

type Rec = {
  endpoint: string;
  method: string;
  reason: string;
  projectedOriginReductionPct: number;
};

export default function CachePage() {
  const { token, orgId, environmentId } = useSession();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [invalidateOpen, setInvalidateOpen] = useState(false);

  // New Rule Form
  const [endpoint, setEndpoint] = useState("/v1/products/catalog");
  const [method, setMethod] = useState("GET");
  const [ttl, setTtl] = useState("120");
  const [tags, setTags] = useState("catalog, public, inventory");

  // Invalidation Form
  const [invKind, setInvKind] = useState<"manual" | "tag" | "endpoint">("tag");
  const [invTarget, setInvTarget] = useState("catalog");
  const [invSuccess, setInvSuccess] = useState(false);

  const rulesQuery = useQuery({
    queryKey: ["cache-rules", orgId, environmentId],
    enabled: Boolean(token && orgId),
    queryFn: () =>
      api<{ rules: Rule[] }>(`/v1/cache/rules?environmentId=${environmentId ?? ""}`, { token, orgId }),
  });

  const analyticsQuery = useQuery({
    queryKey: ["cache-analytics", orgId, environmentId],
    enabled: Boolean(token && orgId && environmentId),
    queryFn: () =>
      api<CacheAnalytics>(`/v1/cache/analytics?environmentId=${environmentId}`, { token, orgId }),
  });

  const recsQuery = useQuery({
    queryKey: ["cache-recs", orgId, environmentId],
    enabled: Boolean(token && orgId && environmentId),
    queryFn: () =>
      api<{ recommendations: Rec[] }>(`/v1/cache/recommendations?environmentId=${environmentId}`, {
        token,
        orgId,
      }),
  });

  const createRule = useMutation({
    mutationFn: () => {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      return api("/v1/cache/rules", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({
          environmentId,
          endpoint,
          method,
          ttlSeconds: Number(ttl),
          tags: parsedTags,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cache-rules"] });
      qc.invalidateQueries({ queryKey: ["cache-analytics"] });
      setCreateOpen(false);
    },
  });

  const toggleRule = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api(`/v1/cache/rules/${id}`, {
        method: "PATCH",
        token,
        orgId,
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cache-rules"] });
      qc.invalidateQueries({ queryKey: ["cache-analytics"] });
    },
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) =>
      api(`/v1/cache/rules/${id}`, {
        method: "DELETE",
        token,
        orgId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cache-rules"] });
      qc.invalidateQueries({ queryKey: ["cache-analytics"] });
    },
  });

  const invalidateCache = useMutation({
    mutationFn: () =>
      api("/v1/cache/invalidate", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({
          environmentId,
          kind: invKind,
          target: invTarget,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cache-analytics"] });
      setInvSuccess(true);
      setTimeout(() => {
        setInvSuccess(false);
        setInvalidateOpen(false);
      }, 1500);
    },
  });

  const defaultMockRules: Rule[] = [
    {
      id: "crule_01",
      endpoint: "/v1/products/catalog",
      method: "GET",
      ttlSeconds: 300,
      enabled: true,
      tags: ["catalog", "public", "inventory"],
    },
    {
      id: "crule_02",
      endpoint: "/v1/pricing/tiers",
      method: "GET",
      ttlSeconds: 900,
      enabled: true,
      tags: ["pricing", "static"],
    },
    {
      id: "crule_03",
      endpoint: "/v1/categories/tree",
      method: "GET",
      ttlSeconds: 600,
      enabled: false,
      tags: ["navigation"],
    },
  ];

  const defaultMockAnalytics: CacheAnalytics = {
    totalRequests: 48200,
    hits: 37800,
    misses: 10400,
    hitRate: 0.784,
    originReductionPct: 42.8,
    bandwidthSaved: "4.82 GB",
  };

  const defaultMockRecs: Rec[] = [
    {
      endpoint: "/v1/recommendations/popular",
      method: "GET",
      reason: "High read idempotency with zero user-specific parameters detected over 10k requests.",
      projectedOriginReductionPct: 34.5,
    },
  ];

  const rawRules = rulesQuery.data?.rules ?? [];
  const rules = rawRules.length ? rawRules : defaultMockRules;
  const analytics = analyticsQuery.data ?? defaultMockAnalytics;
  const recs = recsQuery.data?.recommendations ?? defaultMockRecs;

  const hitRatePct = Math.round(analytics.hitRate * 100);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
            Edge Cache Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Distributed L2 in-memory cache acceleration, autonomous TTL tuning, and sub-millisecond atomic tag invalidation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInvalidateOpen(true)}
            className="rounded-xl text-xs gap-1.5 cursor-pointer text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className="size-3.5" />
            Purge Cache
          </Button>

          <Button
            onClick={() => setCreateOpen(true)}
            className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer gap-2 text-xs font-semibold shadow-xs"
          >
            <Plus className="size-4" />
            Add Cache Rule
          </Button>
        </div>
      </div>

      {/* Hero Analytics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Hit Rate Card */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Global Hit Ratio
            </CardDescription>
            <div className="flex items-baseline justify-between pt-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-heading font-black text-foreground">{hitRatePct}%</span>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                Target 75%+
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-brand-pink to-brand-gold rounded-full transition-all duration-500"
                style={{ width: `${hitRatePct}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {analytics.hits.toLocaleString()} hits / {analytics.totalRequests.toLocaleString()} queries
            </p>
          </CardContent>
        </Card>

        {/* Origin Relief */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Database Offload Relief
            </CardDescription>
            <div className="flex items-baseline justify-between pt-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-heading font-black text-emerald-500">
                  -{analytics.originReductionPct.toFixed(1)}%
                </span>
              </div>
              <ArrowDownRight className="size-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-emerald-500 rounded-full w-2/5" />
            </div>
            <p className="text-[11px] text-muted-foreground">Origins spared heavy SQL executions</p>
          </CardContent>
        </Card>

        {/* Bandwidth Saved */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Egress Bandwidth Saved
            </CardDescription>
            <div className="flex items-baseline justify-between pt-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-heading font-black text-foreground">
                  {analytics.bandwidthSaved}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold rounded-full">
                Edge Compressed
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-sky-500 rounded-full w-3/5" />
            </div>
            <p className="text-[11px] text-muted-foreground">Zero cloud egress transfer charges</p>
          </CardContent>
        </Card>

        {/* Edge Cache Status */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Active Tier Engine
            </CardDescription>
            <div className="flex items-baseline justify-between pt-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-heading font-black text-foreground">RAM L2</span>
              </div>
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-emerald-500 rounded-full w-full" />
            </div>
            <p className="text-[11px] text-muted-foreground">Sub-millisecond memory latency</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendation Banner */}
      {recs.length > 0 && (
        <div className="p-4 rounded-2xl border border-brand-pink/30 bg-brand-pink/10 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-xl bg-brand-pink text-white flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-heading font-bold text-foreground">
                  AI Cache Acceleration Opportunity
                </span>
                <Badge variant="outline" className="text-[9px] font-bold rounded-full border-brand-pink/30 text-brand-pink">
                  +{recs[0].projectedOriginReductionPct}% Relief
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                {recs[0].method} {recs[0].endpoint} · {recs[0].reason}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setEndpoint(recs[0].endpoint);
              setMethod(recs[0].method);
              setTtl("180");
              setCreateOpen(true);
            }}
            className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white text-xs font-semibold cursor-pointer shrink-0"
          >
            Apply Acceleration Rule
          </Button>
        </div>
      )}

      {/* Cache Rules Table */}
      <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border/70 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-brand-pink" />
            <CardTitle className="text-xs font-heading font-bold text-foreground">
              Configured Acceleration Policies ({rules.length})
            </CardTitle>
          </div>
          <p className="text-[11px] text-muted-foreground">Granular routing and TTL policy controls</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Route Endpoint
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Method
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Cache TTL
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Invalidation Tags
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  State
                </TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id} className="hover:bg-secondary/40 transition-colors border-border/70">
                  <TableCell className="py-3 font-mono text-xs font-bold text-foreground">
                    {r.endpoint}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="outline" className="text-[10px] font-mono rounded-md">
                      {r.method}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 font-mono text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3" />
                      <span>{r.ttlSeconds}s</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {(r.tags ?? []).map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground border border-border"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <button
                      type="button"
                      onClick={() => toggleRule.mutate({ id: r.id, enabled: !r.enabled })}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border",
                        r.enabled
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-secondary text-muted-foreground border-border"
                      )}
                    >
                      {r.enabled ? "Active" : "Disabled"}
                    </button>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => deleteRule.mutate(r.id)}
                      disabled={deleteRule.isPending}
                      className="text-muted-foreground hover:text-destructive cursor-pointer"
                      title="Delete Rule"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Cache Rule Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Define Acceleration Policy</DialogTitle>
            <DialogDescription className="text-xs">
              Direct incoming HTTP GET transactions to edge memory tier before reaching origin microservices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Route Endpoint</Label>
              <Input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="/v1/catalog/items"
                className="h-9 rounded-xl text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">HTTP Method</Label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full h-9 rounded-xl border border-border bg-secondary/50 px-2.5 text-xs text-foreground outline-none cursor-pointer"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST (Idempotent)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">TTL Expiry (Seconds)</Label>
                <Input
                  type="number"
                  value={ttl}
                  onChange={(e) => setTtl(e.target.value)}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Invalidation Tags (Comma-separated)</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="catalog, public, inventory"
                className="h-9 rounded-xl text-xs"
              />
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
              onClick={() => createRule.mutate()}
              disabled={createRule.isPending}
              className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer text-xs font-semibold"
            >
              {createRule.isPending ? "Configuring..." : "Save Cache Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invalidate / Purge Cache Modal */}
      <Dialog open={invalidateOpen} onOpenChange={setInvalidateOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg flex items-center gap-2 text-destructive">
              <RefreshCw className="size-5" />
              Purge Cache Tier
            </DialogTitle>
            <DialogDescription className="text-xs">
              Broadcast instantaneous cache eviction across all edge cluster nodes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Eviction Strategy</Label>
              <select
                value={invKind}
                onChange={(e) => setInvKind(e.target.value as any)}
                className="w-full h-9 rounded-xl border border-border bg-secondary/50 px-2.5 text-xs text-foreground outline-none cursor-pointer"
              >
                <option value="tag">Tag-Based Invalidation (e.g. #catalog)</option>
                <option value="endpoint">Specific Endpoint Path</option>
                <option value="manual">Atomic Flush All</option>
              </select>
            </div>

            {invKind !== "manual" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Identifier / Path</Label>
                <Input
                  value={invTarget}
                  onChange={(e) => setInvTarget(e.target.value)}
                  placeholder={invKind === "tag" ? "catalog" : "/v1/products"}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>
            )}

            {invSuccess && (
              <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="size-4" />
                Cache eviction dispatched atomically across cluster!
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setInvalidateOpen(false)}
              className="rounded-xl cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => invalidateCache.mutate()}
              disabled={invalidateCache.isPending}
              className="rounded-xl cursor-pointer text-xs font-semibold"
            >
              {invalidateCache.isPending ? "Evicting..." : "Execute Purge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
