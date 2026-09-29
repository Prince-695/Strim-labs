"use client";

import { useState } from "react";
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
import { Plus, ShieldAlert, CheckCircle2, Play, RotateCcw, Eye, Trash2, ArrowRight } from "lucide-react";

type Plan = {
  id: string;
  title: string;
  description: string;
  objective: string;
  state: string;
  riskLevel?: string;
  rolloutPercent: number;
  blastRadius?: { services?: string[] };
  gitCommit?: string;
  gitBranch?: string;
  gitPullRequest?: string;
  createdAt: string;
  approvals?: { id: string; decision: string; justification?: string; createdAt: string }[];
  rollouts?: { id: string; percent: number; status: string; createdAt: string }[];
};

export default function ChangePlansPage() {
  const { token, orgId, environmentId } = useSession();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailPlan, setDetailPlan] = useState<Plan | null>(null);

  // New Plan Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [gitBranch, setGitBranch] = useState("");
  const [gitCommit, setGitCommit] = useState("");
  const [configRows, setConfigRows] = useState<{ key: string; value: string; type: "string" | "number" | "boolean" | "json" }[]>([
    { key: "cache.enabled", value: "true", type: "boolean" },
    { key: "checkout.timeoutMs", value: "3000", type: "number" },
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["change-plans"] }),
  });

  const removePlan = useMutation({
    mutationFn: (id: string) =>
      api(`/v1/change-plans/${id}`, { method: "DELETE", token, orgId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change-plans"] });
      if (detailPlan) setDetailPlan(null);
    },
  });

  const rows = q.data?.changePlans ?? [];

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Change Plans</h1>
          <p className="text-sm text-muted-foreground">
            Multi-stage canary deployment, risk governance, and automated blast-radius validation.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!environmentId} className="cursor-pointer gap-2">
          <Plus className="size-4" />
          Create Change Plan
        </Button>
      </div>

      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle>Active Lifecycle Plans</CardTitle>
          <CardDescription>
            Strict state machine: DRAFT → SIMULATING → APPROVAL_PENDING → ROLLING_OUT → MONITORING → COMPLETED
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title & Objective</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Canary Stage</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const isRiskHigh = p.riskLevel === "HIGH" || p.riskLevel === "CRITICAL";
                return (
                  <TableRow key={p.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell>
                      <div className="font-medium text-foreground">{p.title}</div>
                      <div className="text-xs text-muted-foreground">{p.objective || p.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.state === "COMPLETED"
                            ? "default"
                            : p.state === "ROLLED_BACK" || p.state === "REJECTED"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {p.state}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {isRiskHigh && <ShieldAlert className="size-4 text-destructive" />}
                        <span className={isRiskHigh ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {p.riskLevel ?? "LOW"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${p.rolloutPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono">{p.rolloutPercent}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDetailPlan(p)}
                          className="size-8 p-0 cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="size-4" />
                        </Button>
                        {p.state === "DRAFT" || p.state === "VALIDATING" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => act.mutate({ id: p.id, action: "simulate" })}
                            disabled={act.isPending}
                            className="cursor-pointer"
                          >
                            <Play className="size-3.5 mr-1" /> Simulate
                          </Button>
                        ) : null}
                        {p.state === "APPROVAL_PENDING" || p.state === "SIMULATION_PASSED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => act.mutate({ id: p.id, action: "approve" })}
                            disabled={act.isPending}
                            className="cursor-pointer"
                          >
                            <CheckCircle2 className="size-3.5 mr-1 text-green-500" /> Approve
                          </Button>
                        ) : null}
                        {p.state === "APPROVED" || p.state === "ROLLING_OUT" ? (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => act.mutate({ id: p.id, action: "rollout" })}
                            disabled={act.isPending}
                            className="cursor-pointer"
                          >
                            <ArrowRight className="size-3.5 mr-1" /> Rollout Step
                          </Button>
                        ) : null}
                        {p.state === "ROLLING_OUT" || p.state === "MONITORING" ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => act.mutate({ id: p.id, action: "rollback" })}
                            disabled={act.isPending}
                            className="cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 mr-1" /> Rollback
                          </Button>
                        ) : null}
                        {["DRAFT", "REJECTED", "ROLLED_BACK"].includes(p.state) ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removePlan.mutate(p.id)}
                            disabled={removePlan.isPending}
                            className="size-8 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                            title="Delete Plan"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No change plans found. Click &quot;Create Change Plan&quot; to define a runtime configuration change.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Interactive Change Plan Builder Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Enterprise Change Plan</DialogTitle>
            <DialogDescription>
              Define your proposed configuration changes, execution objective, and safety constraints.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="title">Change Plan Title</Label>
              <Input
                id="title"
                placeholder="e.g. Enable Redis L2 caching on product catalog"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="objective">Objective</Label>
                <Input
                  id="objective"
                  placeholder="e.g. Reduce origin database load by 40%"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gitBranch">Git Branch / PR (Optional)</Label>
                <Input
                  id="gitBranch"
                  placeholder="feat/cache-tuning (#104)"
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Detailed Description</Label>
              <Textarea
                id="description"
                rows={2}
                placeholder="Details of the configuration changes, expected latency impact, and fallback contingencies..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Proposed Configuration Key-Values</Label>
                <Button size="sm" variant="outline" type="button" onClick={addConfigRow} className="cursor-pointer text-xs">
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
                      className="flex-1 font-mono text-xs"
                    />
                    <select
                      value={row.type}
                      onChange={(e) => updateConfigRow(idx, "type", e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
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
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => removeConfigRow(idx)}
                      disabled={configRows.length === 1}
                      className="size-9 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={!title.trim() || create.isPending}
              className="cursor-pointer"
            >
              {create.isPending ? "Submitting..." : "Initialize Change Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Details Modal */}
      {detailPlan && (
        <Dialog open={Boolean(detailPlan)} onOpenChange={() => setDetailPlan(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-4">
                <DialogTitle>{detailPlan.title}</DialogTitle>
                <Badge>{detailPlan.state}</Badge>
              </div>
              <DialogDescription>{detailPlan.objective}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                <div className="font-semibold text-xs text-muted-foreground uppercase">Description</div>
                <div>{detailPlan.description || "No description provided."}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Risk Classification</div>
                  <div className="mt-1 font-medium text-foreground">{detailPlan.riskLevel ?? "LOW"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Canary Rollout</div>
                  <div className="mt-1 font-medium text-foreground">{detailPlan.rolloutPercent}% target</div>
                </div>
              </div>

              {detailPlan.blastRadius?.services && detailPlan.blastRadius.services.length > 0 && (
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">
                    Blast Radius Walk (Dependent Services)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detailPlan.blastRadius.services.map((svc) => (
                      <Badge key={svc} variant="outline">
                        {svc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDetailPlan(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
