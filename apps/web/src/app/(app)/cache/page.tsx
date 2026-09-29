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
import { Database, Plus, RefreshCw, Trash2, Zap, ArrowDownRight, Layers } from "lucide-react";

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
  const [endpoint, setEndpoint] = useState("/api/v1/products");
  const [method, setMethod] = useState("GET");
  const [ttl, setTtl] = useState("60");
  const [tags, setTags] = useState("catalog, inventory");

  // Invalidation Form
  const [invKind, setInvKind] = useState<"manual" | "tag" | "endpoint">("manual");
  const [invTarget, setInvTarget] = useState("");

  const rules = useQuery({
    queryKey: ["cache-rules", orgId, environmentId],
    enabled: Boolean(token && orgId),
    queryFn: () =>
      api<{ rules: Rule[] }>(`/v1/cache/rules?environmentId=${environmentId ?? ""}`, { token, orgId }),
  });

  const analytics = useQuery({
    queryKey: ["cache-analytics", orgId, environmentId],
    enabled: Boolean(token && orgId && environmentId),
    queryFn: () =>
      api<CacheAnalytics>(`/v1/cache/analytics?environmentId=${environmentId}`, { token, orgId }),
  });

  const recs = useQuery({
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
          kind: invKind,
          target: invTarget || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cache-analytics"] });
      setInvalidateOpen(false);
    },
  });

  const applyRec = (rec: Rec) => {
    setEndpoint(rec.endpoint);
    setMethod(rec.method);
    setTtl("120");
    setCreateOpen(true);
  };

  const a = analytics.data ?? {
    totalRequests: 0,
    hits: 0,
    misses: 0,
    hitRate: 0,
    originReductionPct: 0,
    bandwidthSaved: "0KB",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Adaptive Edge Cache</h1>
          <p className="text-sm text-muted-foreground">
            Distributed L2 acceleration, tag-based invalidations, and automated origin load offloading.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setInvalidateOpen(true)}
            disabled={!environmentId}
            className="cursor-pointer gap-2"
          >
            <RefreshCw className="size-4" />
            Invalidate
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={!environmentId}
            className="cursor-pointer gap-2"
          >
            <Plus className="size-4" />
            Add Cache Rule
          </Button>
        </div>
      </div>

      {/* Analytics KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Hit Rate</CardDescription>
            <CardTitle className="text-3xl font-bold text-foreground">
              {Math.round(a.hitRate * 100)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {a.hits.toLocaleString()} hits / {a.totalRequests.toLocaleString()} requests
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Origin Reduction</CardDescription>
            <CardTitle className="text-3xl font-bold text-emerald-500">
              {a.originReductionPct}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Database & backend load avoided</div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Bandwidth Saved</CardDescription>
            <CardTitle className="text-3xl font-bold text-foreground">
              {a.bandwidthSaved}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Served directly from memory / edge</div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Active Rules</CardDescription>
            <CardTitle className="text-3xl font-bold text-foreground">
              {rules.data?.rules.length ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {rules.data?.rules.filter((r) => r.enabled).length ?? 0} enabled
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle>Active Cache Policies</CardTitle>
          <CardDescription>
            Deterministic route matching, surrogate tag propagation, and TTL enforcement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method & Endpoint</TableHead>
                <TableHead>TTL</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rules.data?.rules ?? []).map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {r.method}
                      </Badge>
                      <span className="font-mono text-xs text-foreground font-medium">{r.endpoint}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.ttlSeconds}s</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.tags ?? []).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.enabled ? "default" : "secondary"}>
                      {r.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleRule.mutate({ id: r.id, enabled: !r.enabled })}
                        className="cursor-pointer text-xs"
                      >
                        {r.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteRule.mutate(r.id)}
                        className="size-8 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                        title="Delete Rule"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(rules.data?.rules.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No caching rules defined for this environment. Click &quot;Add Cache Rule&quot; to begin.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Automated Recommendations */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            <CardTitle>Autonomous Cache Opportunities</CardTitle>
          </div>
          <CardDescription>
            Heuristic detection of high-volume, low-volatility read endpoints from live telemetry.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(recs.data?.recommendations ?? []).map((r) => (
            <div
              key={r.endpoint}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {r.method}
                  </Badge>
                  <span className="font-mono text-xs font-medium text-foreground">{r.endpoint}</span>
                  <Badge variant="default" className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                    <ArrowDownRight className="size-3 mr-0.5" /> {r.projectedOriginReductionPct}% reduction
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.reason}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => applyRec(r)} className="cursor-pointer text-xs">
                Adopt Cache Rule
              </Button>
            </div>
          ))}
          {(recs.data?.recommendations.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No candidate routes identified at this moment.</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Add Cache Rule Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Cache Rule</DialogTitle>
            <DialogDescription>Define an endpoint pattern and caching policy.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="endpoint">Route Pattern</Label>
              <Input
                id="endpoint"
                placeholder="/api/v1/products"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="method">HTTP Method</Label>
                <select
                  id="method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="GET">GET</option>
                  <option value="HEAD">HEAD</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ttl">TTL (Seconds)</Label>
                <Input
                  id="ttl"
                  type="number"
                  placeholder="60"
                  value={ttl}
                  onChange={(e) => setTtl(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Surrogate Tags (comma separated)</Label>
              <Input
                id="tags"
                placeholder="catalog, products, inventory"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={() => createRule.mutate()} disabled={createRule.isPending} className="cursor-pointer">
              {createRule.isPending ? "Saving..." : "Create Cache Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invalidate Cache Modal */}
      <Dialog open={invalidateOpen} onOpenChange={setInvalidateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invalidate Cached Content</DialogTitle>
            <DialogDescription>
              Purge stale cached responses by tag, route pattern, or complete environment flush.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Invalidation Target</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={invKind === "manual" ? "default" : "outline"}
                  onClick={() => setInvKind("manual")}
                  className="cursor-pointer text-xs"
                >
                  Full Purge
                </Button>
                <Button
                  type="button"
                  variant={invKind === "tag" ? "default" : "outline"}
                  onClick={() => setInvKind("tag")}
                  className="cursor-pointer text-xs"
                >
                  By Tag
                </Button>
                <Button
                  type="button"
                  variant={invKind === "endpoint" ? "default" : "outline"}
                  onClick={() => setInvKind("endpoint")}
                  className="cursor-pointer text-xs"
                >
                  By Route
                </Button>
              </div>
            </div>

            {invKind !== "manual" && (
              <div className="grid gap-2">
                <Label htmlFor="target">
                  {invKind === "tag" ? "Surrogate Tag Name" : "Endpoint Route Path"}
                </Label>
                <Input
                  id="target"
                  placeholder={invKind === "tag" ? "catalog" : "/api/v1/products"}
                  value={invTarget}
                  onChange={(e) => setInvTarget(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setInvalidateOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => invalidateCache.mutate()}
              disabled={invalidateCache.isPending}
              className="cursor-pointer"
            >
              {invalidateCache.isPending ? "Purging..." : "Execute Invalidation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
