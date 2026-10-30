"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Bell,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Layers,
  Loader2,
  Mail,
  Slack,
  Webhook,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string }>;
}

const createRuleSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(64),
  severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
  condition: z.enum(["LATENCY_P95", "ERROR_RATE", "SERVICE_DOWN", "BREAKING_POINT"]),
  threshold: z.number().min(0.01),
  window: z.number().min(1),
});

type RuleForm = z.infer<typeof createRuleSchema>;

export default function AlertsRulesPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch Rules
  const {
    data: rulesData,
    isLoading: rulesLoading,
    error: rulesError,
    refetch: refetchRules,
  } = useQuery({
    queryKey: queryKeys.alerts.rules(orgId, projectId),
    queryFn: () =>
      fetchApi<{ rules: Schemas["AlertRule"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/alerts/rules`
      ).then((res) => res.rules),
  });

  // Fetch Channels
  const { data: channelsData, isLoading: channelsLoading } = useQuery({
    queryKey: queryKeys.alerts.channels(orgId, projectId),
    queryFn: () =>
      fetchApi<{ channels: Schemas["NotificationChannel"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/alerts/notification-channels`
      ).then((res) => res.channels),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isSubmitting },
  } = useForm<RuleForm>({
    resolver: zodResolver(createRuleSchema),
    defaultValues: {
      name: "",
      severity: "CRITICAL",
      condition: "LATENCY_P95",
      threshold: 250,
      window: 5,
    },
  });

  // Create Rule Mutation
  const createRuleMutation = useMutation({
    mutationFn: async (values: RuleForm) => {
      return fetchApi<{ rule: Schemas["AlertRule"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/alerts/rules`,
        {
          method: "POST",
          body: JSON.stringify({
            name: values.name.trim(),
            severity: values.severity,
            condition: values.condition,
            threshold: values.threshold,
            window: values.window,
            channelIds: [],
            enabled: true,
          }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.rules(orgId, projectId) });
      setCreateModalOpen(false);
      reset();
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to create alert rule");
    },
  });

  // Test Rule Mutation
  const testRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await fetchApi<{ ok: boolean; deliveredTo: number }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/alerts/rules/${ruleId}/test`,
        { method: "POST" }
      );
      return res;
    },
    onSuccess: (res) => {
      setTestSuccess(`Dry-run notification dispatched successfully to ${res.deliveredTo} destination(s).`);
    },
    onError: (err: any) => {
      setActionError(err.message || "Test dispatch failed");
    },
  });

  // Delete Rule Mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await fetchApi<{ ok: boolean }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/alerts/rules/${ruleId}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.rules(orgId, projectId) });
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to delete rule");
    },
  });

  if (rulesLoading || channelsLoading) {
    return <LoadingState message="Loading alert rules & incident policies..." />;
  }

  const rules = rulesData || [];
  const channels = channelsData || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alert Rules &amp; Policies"
        description="Threshold triggers, multi-channel dispatch, and automated breaking-point escalation."
        action={
          <Button
            size="sm"
            onClick={() => {
              setActionError(null);
              setCreateModalOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            <span>Create Alert Rule</span>
          </Button>
        }
      />

      {testSuccess && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
            <span>{testSuccess}</span>
          </div>
          <button onClick={() => setTestSuccess(null)} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {rules.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No alert rules defined"
          description="Configure thresholds for p95 latency spikes, HTTP error budgets, or breaking point saturation."
          action={{
            label: "Create First Rule",
            onClick: () => setCreateModalOpen(true),
          }}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Rule Name</TH>
                <TH>Severity</TH>
                <TH>Condition</TH>
                <TH>Threshold</TH>
                <TH>Evaluation Window</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rules.map((rule) => (
                <TR key={rule.id}>
                  <TD className="text-xs font-semibold text-foreground">{rule.name}</TD>
                  <TD>
                    <Badge
                      variant={
                        rule.severity === "CRITICAL"
                          ? "destructive"
                          : rule.severity === "WARNING"
                          ? "secondary"
                          : "outline"
                      }
                      className="font-mono text-[10px]"
                    >
                      {rule.severity}
                    </Badge>
                  </TD>
                  <TD className="text-xs font-mono text-muted-foreground">{rule.condition}</TD>
                  <TD className="text-xs font-mono font-bold text-foreground">
                    {rule.threshold ?? "—"}
                  </TD>
                  <TD className="text-xs font-mono text-muted-foreground">{rule.window} min</TD>
                  <TD>
                    <Badge variant={rule.enabled ? "default" : "secondary"} className="font-mono text-[10px]">
                      {rule.enabled ? "ENABLED" : "PAUSED"}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={testRuleMutation.isPending}
                        onClick={() => testRuleMutation.mutate(rule.id)}
                        className="h-7 text-xs text-brand hover:bg-brand/10"
                      >
                        <Send className="size-3 mr-1" /> Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRuleMutation.mutate(rule.id)}
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {/* Create Rule Dialog */}
      <Dialog
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Create Alert Rule"
        description="Specify evaluation thresholds and incident triggers."
      >
        <form
          onSubmit={handleSubmit((values) => createRuleMutation.mutate(values))}
          className="space-y-4 py-2"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Rule Name *</label>
            <Input
              {...register("name")}
              placeholder="e.g. p95 Latency > 250ms Warning"
              className="text-xs"
              autoFocus
            />
            {formErrors.name && (
              <p className="text-[11px] text-destructive">{formErrors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Severity</label>
              <select
                {...register("severity")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground font-mono outline-none"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="WARNING">WARNING</option>
                <option value="INFO">INFO</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Trigger Condition</label>
              <select
                {...register("condition")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground font-mono outline-none"
              >
                <option value="LATENCY_P95">Latency p95 (ms)</option>
                <option value="ERROR_RATE">Error Rate (%)</option>
                <option value="SERVICE_DOWN">Service Down</option>
                <option value="BREAKING_POINT">Breaking Point Reached</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Threshold Value *</label>
              <Input
                type="number"
                step="any"
                {...register("threshold", { valueAsNumber: true })}
                className="text-xs font-mono"
              />
              {formErrors.threshold && (
                <p className="text-[11px] text-destructive">{formErrors.threshold.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Evaluation Window (min)</label>
              <Input
                type="number"
                {...register("window", { valueAsNumber: true })}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting || createRuleMutation.isPending} className="gap-1.5">
              {createRuleMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Bell className="size-3.5" />
              )}
              <span>Create Rule</span>
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
