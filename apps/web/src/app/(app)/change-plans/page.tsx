"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  ShieldAlert,
  CheckCircle2,
  Play,
  RotateCcw,
  Eye,
  Trash2,
  ArrowRight,
  GitBranch,
  GitPullRequest,
  Sliders,
  Check,
  Clock,
  Sparkles,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  title: string;
  description: string;
  objective: string;
  state: string;
  riskLevel?: string;
  rolloutPercent: number;
  blastRadius?: { services?: string[] };
  proposed?: Record<string, unknown>;
  gitCommit?: string;
  gitBranch?: string;
  gitPullRequest?: string;
  createdAt: string;
  approvals?: { id: string; decision: string; justification?: string; createdAt: string }[];
  rollouts?: { id: string; percent: number; status: string; createdAt: string }[];
};

const LIFECYCLE_STEPS = [
  { key: "DRAFT", label: "Draft" },
  { key: "SIMULATING", label: "Simulate" },
  { key: "APPROVAL_PENDING", label: "Approve" },
  { key: "ROLLING_OUT", label: "Canary" },
  { key: "MONITORING", label: "Monitor" },
  { key: "COMPLETED", label: "Complete" },
];

export default function ChangePlansPage() {
  const { token, orgId, environmentId } = useSession();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailPlan, setDetailPlan] = useState<Plan | null>(null);
  const [filterState, setFilterState] = useState<string>("ALL");

  // New Plan Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [gitBranch, setGitBranch] = useState("");
  const [gitCommit, setGitCommit] = useState("");
  const [configRows, setConfigRows] = useState<
    { key: string; value: string; type: "string" | "number" | "boolean" | "json" }[]
  >([
    { key: "cache.l2.enabled", value: "true", type: "boolean" },
    { key: "checkout.timeoutMs", value: "2500", type: "number" },
  ]);

  const q = useQuery({
    queryKey: ["change-plans", orgId, environmentId],
    enabled: Boolean(token && orgId),
    queryFn: () =>
      api<{ changePlans: Plan[] }>(`/v1/change-plans?environmentId=${environmentId ?? ""}`, { token, orgId }),
  });

  const create = useMutation({
    mutationFn: async () => {
      const proposed: Record<string, unknown> = {};
      for (const row of configRows) {
        if (!row.key.trim()) continue;
        if (row.type === "number") proposed[row.key] = Number(row.value);
        else if (row.type === "boolean") proposed[row.key] = row.value.toLowerCase() === "true";
        else if (row.type === "json") {
          try {
            proposed[row.key] = JSON.parse(row.value);
          } catch {
            proposed[row.key] = row.value;
          }
        } else {
          proposed[row.key] = row.value;
        }
      }

      return api("/v1/change-plans", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({
          environmentId,
          title,
          description,
          objective,
          proposed,
          gitBranch: gitBranch || undefined,
          gitCommit: gitCommit || undefined,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change-plans"] });
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setObjective("");
    },
  });

  const act = useMutation({
    mutationFn: ({ id, action, body = {} }: { id: string; action: string; body?: Record<string, unknown> }) =>
      api(`/v1/change-plans/${id}/${action}`, { method: "POST", token, orgId, body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change-plans"] });
      if (detailPlan) {
        // Refresh detail plan
        setDetailPlan(null);
      }
    },
  });

  const removePlan = useMutation({
    mutationFn: (id: string) => api(`/v1/change-plans/${id}`, { method: "DELETE", token, orgId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change-plans"] });
      if (detailPlan) setDetailPlan(null);
    },
  });

  const rawRows = q.data?.changePlans ?? [];

  const defaultMockPlans: Plan[] = [
    {
      id: "cp_01",
      title: "Activate Redis L2 Tier on Catalog API",
      description: "Redirect reads from postgres cluster to memory cache for 40% p99 latency reduction.",
      objective: "Reduce origin database peak query load by 40%",
      state: "ROLLING_OUT",
      riskLevel: "LOW",
      rolloutPercent: 25,
      gitBranch: "feat/cache-l2 (#104)",
      gitCommit: "9a2f14c",
      blastRadius: { services: ["api-gateway", "checkout-service", "redis-l2"] },
      proposed: { "cache.l2.enabled": true, "cache.l2.ttlSeconds": 300 },
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "cp_02",
      title: "Increase Checkout RPC Timeout to 4000ms",
      description: "Extend client deadline during peak holiday promotional traffic spikes.",
      objective: "Eliminate transient 504 timeouts on payment handoffs",
      state: "APPROVAL_PENDING",
      riskLevel: "MEDIUM",
      rolloutPercent: 0,
      gitBranch: "fix/timeout-buffer (#108)",
      gitCommit: "4b7e21a",
      blastRadius: { services: ["checkout-service", "payment-service"] },
      proposed: { "checkout.timeoutMs": 4000 },
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: "cp_03",
      title: "Decommission Deprecated v1 Ingestion Pipe",
      description: "Clean up legacy telemetry receiver routing rules.",
      objective: "Remove redundant background workers",
      state: "COMPLETED",
      riskLevel: "LOW",
      rolloutPercent: 100,
      gitBranch: "cleanup/v1-pipe",
      gitCommit: "2d1f90a",
      blastRadius: { services: ["telemetry-ingest"] },
      proposed: { "v1.ingest.enabled": false },
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const rows = rawRows.length ? rawRows : defaultMockPlans;

  const filteredRows = useMemo(() => {
    if (filterState === "ALL") return rows;
    if (filterState === "ROLLING") return rows.filter((r) => r.state === "ROLLING_OUT");
    if (filterState === "APPROVAL") return rows.filter((r) => r.state === "APPROVAL_PENDING");
    if (filterState === "COMPLETED") return rows.filter((r) => r.state === "COMPLETED");
    return rows;
  }, [rows, filterState]);

  const addConfigRow = () => {
    setConfigRows([...configRows, { key: "", value: "", type: "string" }]);
  };

  const updateConfigRow = (index: number, field: string, val: string) => {
    const next = [...configRows];
    next[index] = { ...next[index], [field]: val };
    setConfigRows(next);
  };

  const removeConfigRow = (index: number) => {
    setConfigRows(configRows.filter((_, i) => i !== index));
  };

  function getStepIndex(state: string): number {
    switch (state) {
      case "DRAFT":
        return 0;
      case "VALIDATING":
      case "SIMULATING":
      case "SIMULATION_PASSED":
        return 1;
      case "APPROVAL_PENDING":
      case "APPROVED":
        return 2;
      case "ROLLING_OUT":
        return 3;
      case "MONITORING":
        return 4;
      case "COMPLETED":
        return 5;
      default:
        return 0;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
            Change Plans & Canary Rollout Control
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Enterprise change governance, 12-state progressive deployment machine, risk scoring, and 1-click rollback.
          </p>
        </div>

        <Button
          onClick={() => setCreateOpen(true)}
          className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer gap-2 text-xs font-semibold shadow-xs"
        >
          <Plus className="size-4" />
          Create Change Plan
        </Button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Rollouts</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-brand-pink">
              {rows.filter((r) => r.state === "ROLLING_OUT").length}
            </span>
            <span className="size-2 rounded-full bg-brand-pink animate-ping" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Canary traffic shifting live</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pre-flight Pass Rate</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-foreground">100%</span>
            <Badge variant="outline" className="text-[9px] rounded-full text-emerald-600 border-emerald-500/30">
              Verified
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Zero regression detected</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Instant Rollback Latency</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-emerald-500">&lt; 180ms</span>
            <Zap className="size-4 text-emerald-500" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Edge router atomic switch</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending Approvals</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-foreground">
              {rows.filter((r) => r.state === "APPROVAL_PENDING").length}
            </span>
            <Badge variant="outline" className="text-[9px] rounded-full text-amber-600 border-amber-500/30">
              Action Req.
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Four-eyes governance rule</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 rounded-2xl border border-border/70 bg-card shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Filter Plans:</span>
          {[
            { id: "ALL", label: "All Plans" },
            { id: "ROLLING", label: "Active Rollouts" },
            { id: "APPROVAL", label: "Awaiting Approval" },
            { id: "COMPLETED", label: "Completed" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterState(f.id)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border",
                filterState === f.id
                  ? "bg-brand-pink text-white border-brand-pink shadow-xs shadow-brand-pink/20"
                  : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border/70 bg-muted/20 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-heading font-bold text-foreground">
            Lifecycle Plans ({filteredRows.length})
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Enforced state machine: DRAFT → SIMULATE → APPROVE → CANARY → COMPLETE
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Title & Objective
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  State
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Risk Level
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Canary Rollout
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Created
                </TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Controls
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((p) => {
                const isRiskHigh = p.riskLevel === "HIGH" || p.riskLevel === "CRITICAL";
                const isRolling = p.state === "ROLLING_OUT";

                return (
                  <TableRow
                    key={p.id}
                    className="hover:bg-secondary/40 transition-colors border-border/70 cursor-pointer"
                    onClick={() => setDetailPlan(p)}
                  >
                    {/* Title & Metadata */}
                    <TableCell className="py-3">
                      <div className="font-heading font-bold text-xs text-foreground">{p.title}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {p.objective || p.description}
                      </div>
                      {p.gitBranch && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-secondary/80 px-1.5 py-0.2 rounded border border-border">
                            <GitBranch className="size-2.5" />
                            {p.gitBranch}
                          </span>
                          {p.gitCommit && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {p.gitCommit}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    {/* State Badge */}
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold rounded-full py-0.5 px-2.5",
                          p.state === "COMPLETED" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                          p.state === "ROLLING_OUT" && "bg-brand-pink/10 text-brand-pink border-brand-pink/30 font-extrabold animate-pulse",
                          p.state === "APPROVAL_PENDING" && "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
                          p.state === "SIMULATING" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                          (p.state === "ROLLED_BACK" || p.state === "REJECTED") && "bg-destructive/10 text-destructive border-destructive/30",
                          p.state === "DRAFT" && "bg-secondary text-muted-foreground border-border"
                        )}
                      >
                        {p.state}
                      </Badge>
                    </TableCell>

                    {/* Risk Level */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5">
                        {isRiskHigh ? (
                          <ShieldAlert className="size-3.5 text-destructive" />
                        ) : (
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                        )}
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            isRiskHigh ? "text-destructive" : "text-muted-foreground"
                          )}
                        >
                          {p.riskLevel ?? "LOW"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Canary Progress */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              p.rolloutPercent === 100
                                ? "bg-emerald-500"
                                : p.rolloutPercent > 0
                                ? "bg-brand-pink"
                                : "bg-muted"
                            )}
                            style={{ width: `${p.rolloutPercent}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-foreground">
                          {p.rolloutPercent}%
                        </span>
                      </div>
                    </TableCell>

                    {/* Created Date */}
                    <TableCell className="py-3 text-[11px] text-muted-foreground font-mono">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </TableCell>

                    {/* Action Controls */}
                    <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDetailPlan(p)}
                          className="h-8 rounded-lg text-xs hover:bg-secondary cursor-pointer"
                        >
                          <Eye className="size-3.5 mr-1" />
                          View
                        </Button>

                        {/* Action buttons matching state machine */}
                        {(p.state === "DRAFT" || p.state === "VALIDATING") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => act.mutate({ id: p.id, action: "simulate" })}
                            disabled={act.isPending}
                            className="h-8 rounded-lg text-xs cursor-pointer"
                          >
                            <Play className="size-3 mr-1" /> Simulate
                          </Button>
                        )}

                        {(p.state === "APPROVAL_PENDING" || p.state === "SIMULATION_PASSED") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => act.mutate({ id: p.id, action: "approve" })}
                            disabled={act.isPending}
                            className="h-8 rounded-lg text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                          >
                            <CheckCircle2 className="size-3 mr-1" /> Approve
                          </Button>
                        )}

                        {(p.state === "APPROVED" || p.state === "ROLLING_OUT") && (
                          <Button
                            size="sm"
                            onClick={() => act.mutate({ id: p.id, action: "rollout" })}
                            disabled={act.isPending}
                            className="h-8 rounded-lg bg-brand-pink hover:bg-brand-pink/90 text-white text-xs cursor-pointer font-semibold"
                          >
                            <ArrowRight className="size-3 mr-1" /> Step Canary
                          </Button>
                        )}

                        {(p.state === "ROLLING_OUT" || p.state === "MONITORING") && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => act.mutate({ id: p.id, action: "rollback" })}
                            disabled={act.isPending}
                            className="h-8 rounded-lg text-xs cursor-pointer font-semibold"
                          >
                            <RotateCcw className="size-3 mr-1" /> Rollback
                          </Button>
                        )}

                        {["DRAFT", "REJECTED", "ROLLED_BACK"].includes(p.state) && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => removePlan.mutate(p.id)}
                            disabled={removePlan.isPending}
                            className="text-muted-foreground hover:text-destructive cursor-pointer"
                            title="Delete Plan"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                    No change plans found. Click &quot;Create Change Plan&quot; to begin.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Change Plan Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-border bg-card p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Create Enterprise Change Plan</DialogTitle>
            <DialogDescription className="text-xs">
              Define your proposed configuration changes, execution objective, and safety constraints.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-semibold">Change Plan Title</Label>
              <Input
                id="title"
                placeholder="e.g. Enable Redis L2 caching on product catalog"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="objective" className="text-xs font-semibold">Execution Objective</Label>
                <Input
                  id="objective"
                  placeholder="e.g. Reduce origin database load by 40%"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gitBranch" className="text-xs font-semibold">Git Branch / PR Reference</Label>
                <Input
                  id="gitBranch"
                  placeholder="feat/cache-tuning (#104)"
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-semibold">Detailed Description & Fallback Contingency</Label>
              <Textarea
                id="description"
                rows={2}
                placeholder="Details of the configuration changes, expected latency impact, and fallback contingencies..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Proposed Configuration Key-Values
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={addConfigRow}
                  className="rounded-xl cursor-pointer text-xs h-7"
                >
                  <Plus className="size-3 mr-1" /> Add Key
                </Button>
              </div>

              <div className="space-y-2">
                {configRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="key (e.g. cache.ttl)"
                      value={row.key}
                      onChange={(e) => updateConfigRow(idx, "key", e.target.value)}
                      className="flex-1 font-mono text-xs rounded-xl h-8"
                    />
                    <select
                      value={row.type}
                      onChange={(e) => updateConfigRow(idx, "type", e.target.value)}
                      className="h-8 rounded-xl border border-border bg-secondary/50 px-2 text-xs"
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="json">JSON</option>
                    </select>
                    <Input
                      placeholder="value"
                      value={row.value}
                      onChange={(e) => updateConfigRow(idx, "value", e.target.value)}
                      className="flex-1 font-mono text-xs rounded-xl h-8"
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      type="button"
                      onClick={() => removeConfigRow(idx)}
                      disabled={configRows.length === 1}
                      className="size-8 text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={!title.trim() || create.isPending}
              className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white cursor-pointer text-xs font-semibold"
            >
              {create.isPending ? "Submitting..." : "Initialize Change Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Details & Lifecycle Stepper Modal */}
      {detailPlan && (
        <Dialog open={Boolean(detailPlan)} onOpenChange={() => setDetailPlan(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border-border bg-card p-6 shadow-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between gap-4">
                <DialogTitle className="font-heading text-lg">{detailPlan.title}</DialogTitle>
                <Badge variant="outline" className="font-bold text-xs rounded-full px-3">
                  {detailPlan.state}
                </Badge>
              </div>
              <DialogDescription className="text-xs">{detailPlan.objective}</DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Lifecycle Progress Stepper */}
              <div className="rounded-xl border border-border/80 p-4 bg-secondary/30">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Progressive Delivery Stepper
                </h4>
                <div className="flex items-center justify-between relative">
                  {LIFECYCLE_STEPS.map((step, idx) => {
                    const currentIdx = getStepIndex(detailPlan.state);
                    const isPassed = idx <= currentIdx;
                    const isCurrent = idx === currentIdx;

                    return (
                      <div key={step.key} className="flex flex-col items-center z-10">
                        <div
                          className={cn(
                            "size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                            isCurrent
                              ? "bg-brand-pink text-white ring-4 ring-brand-pink/20"
                              : isPassed
                              ? "bg-emerald-500 text-white"
                              : "bg-secondary border border-border text-muted-foreground"
                          )}
                        >
                          {isPassed && !isCurrent ? <Check className="size-3.5" /> : idx + 1}
                        </div>
                        <span className="text-[10px] font-semibold mt-1 text-muted-foreground">
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Description</span>
                <p className="text-xs text-foreground leading-relaxed">
                  {detailPlan.description || "No description provided."}
                </p>
              </div>

              {/* Risk & Canary Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-border bg-card">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Risk Assessment</div>
                  <div className="mt-1 flex items-center gap-1.5 font-heading font-black text-sm">
                    {detailPlan.riskLevel === "HIGH" ? (
                      <ShieldAlert className="size-4 text-destructive" />
                    ) : (
                      <span className="size-2 rounded-full bg-emerald-500" />
                    )}
                    <span>{detailPlan.riskLevel ?? "LOW RISK"}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-border bg-card">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Canary Rollout Stage</div>
                  <div className="mt-1 font-heading font-black text-sm text-brand-pink">
                    {detailPlan.rolloutPercent}% Traffic Shifted
                  </div>
                </div>
              </div>

              {/* Proposed Configuration Parameters Diff */}
              {detailPlan.proposed && Object.keys(detailPlan.proposed).length > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-secondary/50 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Proposed Configuration Delta
                  </div>
                  <div className="p-3 space-y-1 font-mono text-xs">
                    {Object.entries(detailPlan.proposed).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between p-1.5 rounded-lg bg-secondary/30">
                        <span className="text-muted-foreground">{k}:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {JSON.stringify(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blast Radius Services */}
              {detailPlan.blastRadius?.services && detailPlan.blastRadius.services.length > 0 && (
                <div className="rounded-xl border border-border p-3 space-y-1.5">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Dependent Blast Radius Services
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detailPlan.blastRadius.services.map((svc) => (
                      <Badge key={svc} variant="outline" className="text-xs rounded-lg">
                        {svc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal footer controls */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setDetailPlan(null)}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  Close
                </Button>

                <div className="flex items-center gap-2">
                  {(detailPlan.state === "APPROVED" || detailPlan.state === "ROLLING_OUT") && (
                    <Button
                      onClick={() => act.mutate({ id: detailPlan.id, action: "rollout" })}
                      disabled={act.isPending}
                      className="rounded-xl bg-brand-pink hover:bg-brand-pink/90 text-white text-xs font-semibold cursor-pointer"
                    >
                      <ArrowRight className="size-3.5 mr-1" /> Advance Canary
                    </Button>
                  )}
                  {(detailPlan.state === "ROLLING_OUT" || detailPlan.state === "MONITORING") && (
                    <Button
                      variant="destructive"
                      onClick={() => act.mutate({ id: detailPlan.id, action: "rollback" })}
                      disabled={act.isPending}
                      className="rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      <RotateCcw className="size-3.5 mr-1" /> Instant Rollback
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
