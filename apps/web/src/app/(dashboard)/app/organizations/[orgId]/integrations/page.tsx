"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Webhook,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  Layers,
  Loader2,
  AlertCircle,
  Slack,
  Github,
  Activity,
  BellRing,
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
  params: Promise<{ orgId: string }>;
}

const WEBHOOK_EVENTS = [
  { id: "INCIDENT_CREATED", label: "Incident Created" },
  { id: "INCIDENT_RESOLVED", label: "Incident Resolved" },
  { id: "ALERT_FIRED", label: "Alert Fired" },
  { id: "LOAD_TEST_COMPLETED", label: "Load Test Completed" },
  { id: "SERVICE_DOWN", label: "Service Health Degraded" },
  { id: "SERVICE_RECOVERED", label: "Service Recovered" },
] as const;

const createWebhookSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(64),
  url: z.string().url("Must be a valid HTTPS endpoint"),
  events: z.array(z.string()).min(1, "Select at least one event"),
});

type CreateWebhookForm = z.infer<typeof createWebhookSchema>;

export default function OrganizationIntegrationsPage({ params }: PageProps) {
  const { orgId } = use(params);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"webhooks" | "integrations">("webhooks");
  const [createWebhookOpen, setCreateWebhookOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch Webhooks
  const {
    data: webhooks,
    isLoading: webhooksLoading,
    error: webhooksError,
    refetch: refetchWebhooks,
  } = useQuery({
    queryKey: queryKeys.organizations.webhooks(orgId),
    queryFn: () =>
      fetchApi<Schemas["Webhook"][]>(`/api/v1/organizations/${orgId}/webhooks`),
  });

  // Fetch Integrations
  const {
    data: integrations,
    isLoading: integrationsLoading,
    refetch: refetchIntegrations,
  } = useQuery({
    queryKey: queryKeys.organizations.integrations(orgId),
    queryFn: () =>
      fetchApi<Schemas["Integration"][]>(`/api/v1/organizations/${orgId}/integrations`),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors: formErrors, isSubmitting },
  } = useForm<CreateWebhookForm>({
    resolver: zodResolver(createWebhookSchema),
    defaultValues: {
      name: "",
      url: "",
      events: ["INCIDENT_CREATED", "ALERT_FIRED", "LOAD_TEST_COMPLETED"],
    },
  });

  const selectedEvents = watch("events");

  const toggleEvent = (eventId: string) => {
    if (selectedEvents.includes(eventId)) {
      setValue("events", selectedEvents.filter((e) => e !== eventId), { shouldValidate: true });
    } else {
      setValue("events", [...selectedEvents, eventId], { shouldValidate: true });
    }
  };

  // Create Webhook Mutation
  const createWebhookMutation = useMutation({
    mutationFn: async (values: CreateWebhookForm) => {
      const payload = {
        name: values.name.trim(),
        url: values.url.trim(),
        events: values.events as any[],
        enabled: true,
      };
      return fetchApi<Schemas["Webhook"]>(`/api/v1/organizations/${orgId}/webhooks`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.webhooks(orgId) });
      setCreateWebhookOpen(false);
      reset();
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to create webhook");
    },
  });

  // Delete Webhook Mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      await fetchApi<{ ok: boolean }>(`/api/v1/organizations/${orgId}/webhooks/${webhookId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.webhooks(orgId) });
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to delete webhook");
    },
  });

  // Test Webhook Ping Mutation
  const testWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const res = await fetchApi<{ success: boolean; statusCode?: number; error?: string }>(
        `/api/v1/organizations/${orgId}/webhooks/${webhookId}/test`,
        { method: "POST" }
      );
      return { id: webhookId, ...res };
    },
    onSuccess: (res) => {
      setTestResult({
        id: res.id,
        success: res.success,
        message: res.success
          ? `Ping delivered successfully (HTTP ${res.statusCode || 200})`
          : `Delivery failed: ${res.error || "Remote endpoint returned error"}`,
      });
    },
    onError: (err: any) => {
      setTestResult({
        id: "error",
        success: false,
        message: err.message || "Test ping failed",
      });
    },
  });

  if (webhooksLoading || integrationsLoading) {
    return <LoadingState message="Loading integrations & webhooks..." />;
  }

  const webhookList = webhooks || [];
  const integrationList = integrations || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations &amp; Webhooks"
        description="Stream alerts, automated load-test reports, and health anomalies into external systems."
        action={
          activeTab === "webhooks" ? (
            <Button
              size="sm"
              onClick={() => {
                setActionError(null);
                setCreateWebhookOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              <span>New Webhook</span>
            </Button>
          ) : null
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("webhooks")}
          className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
            activeTab === "webhooks"
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Outbound Webhooks ({webhookList.length})
        </button>
        <button
          onClick={() => setActiveTab("integrations")}
          className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
            activeTab === "integrations"
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Native Integrations
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {testResult && (
        <div
          className={`rounded-lg border p-3 text-xs flex items-center justify-between ${
            testResult.success
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="size-4 shrink-0 text-rose-400" />
            )}
            <span>{testResult.message}</span>
          </div>
          <button onClick={() => setTestResult(null)} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === "webhooks" && (
        <>
          {webhookList.length === 0 ? (
            <EmptyState
              icon={Webhook}
              title="No webhooks configured"
              description="Register an HTTPS callback endpoint to receive real-time notifications for incidents, saturation alerts, and load-test completions."
              action={{
                label: "Create Webhook",
                onClick: () => setCreateWebhookOpen(true),
              }}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Endpoint URL</TH>
                    <TH>Events</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {webhookList.map((wh) => (
                    <TR key={wh.id}>
                      <TD className="text-xs font-semibold text-foreground">{wh.name}</TD>
                      <TD className="text-xs font-mono text-muted-foreground max-w-xs truncate">
                        {wh.url}
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1 max-w-sm">
                          {wh.events.map((ev) => (
                            <Badge key={ev} variant="secondary" className="text-[10px] font-mono">
                              {ev}
                            </Badge>
                          ))}
                        </div>
                      </TD>
                      <TD>
                        <Badge
                          variant={wh.enabled ? "default" : "secondary"}
                          className="text-[10px] font-mono"
                        >
                          {wh.enabled ? "ACTIVE" : "PAUSED"}
                        </Badge>
                      </TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={testWebhookMutation.isPending}
                            onClick={() => testWebhookMutation.mutate(wh.id)}
                            className="h-7 text-xs text-brand hover:bg-brand/10"
                          >
                            <Send className="size-3 mr-1" /> Test Ping
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteWebhookMutation.mutate(wh.id)}
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
        </>
      )}

      {/* Native Integrations Tab */}
      {activeTab === "integrations" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Slack */}
          <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[#4A154B]/10 text-[#E01E5A] border border-border">
                <Slack className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Slack Incident Alerts</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Post real-time incident warnings and latency alerts directly to incident triage channels.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-[11px] font-mono text-muted-foreground">Status: Available</span>
              <Button size="sm" variant="outline" className="text-xs h-8">
                Connect Channel
              </Button>
            </div>
          </div>

          {/* GitHub */}
          <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-surface-muted text-foreground border border-border">
                <Github className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">GitHub CI / PR Checks</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fail pull requests automatically if breaking point or latency percentiles degrade below target thresholds.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-[11px] font-mono text-muted-foreground">Status: Available</span>
              <Button size="sm" variant="outline" className="text-xs h-8">
                Install App
              </Button>
            </div>
          </div>

          {/* Datadog */}
          <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[#632CA6]/10 text-[#632CA6] border border-border">
                <Activity className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Datadog Telemetry Forwarding</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Export STRIM Labs load-test percentiles and breaking point metrics directly to Datadog dashboards.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-[11px] font-mono text-muted-foreground">Status: Available</span>
              <Button size="sm" variant="outline" className="text-xs h-8">
                Configure Forwarder
              </Button>
            </div>
          </div>

          {/* PagerDuty */}
          <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-border">
                <BellRing className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">PagerDuty Escalation</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Trigger on-call escalation policies immediately when high-severity outage incidents are confirmed.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-[11px] font-mono text-muted-foreground">Status: Available</span>
              <Button size="sm" variant="outline" className="text-xs h-8">
                Link PagerDuty
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Webhook Dialog */}
      <Dialog
        open={createWebhookOpen}
        onOpenChange={setCreateWebhookOpen}
        title="Register Outbound Webhook"
        description="Configure an endpoint URL to receive signed JSON HTTP POST payloads."
      >
        <form
          onSubmit={handleSubmit((values) => createWebhookMutation.mutate(values))}
          className="space-y-4 py-2"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Webhook Name *</label>
            <Input
              {...register("name")}
              placeholder="e.g. Production Incident Dispatcher"
              className="text-xs"
              autoFocus
            />
            {formErrors.name && (
              <p className="text-[11px] text-destructive">{formErrors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Payload Endpoint URL (HTTPS) *</label>
            <Input
              {...register("url")}
              placeholder="https://api.yourdomain.com/webhooks/strim"
              className="text-xs font-mono"
            />
            {formErrors.url && (
              <p className="text-[11px] text-destructive">{formErrors.url.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Event Triggers *</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {WEBHOOK_EVENTS.map((event) => {
                const checked = selectedEvents.includes(event.id);
                return (
                  <div
                    key={event.id}
                    onClick={() => toggleEvent(event.id)}
                    className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-colors text-xs ${
                      checked
                        ? "border-brand bg-brand/5 text-foreground font-semibold"
                        : "border-border text-muted-foreground hover:bg-surface-muted/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                    />
                    <span>{event.label}</span>
                  </div>
                );
              })}
            </div>
            {formErrors.events && (
              <p className="text-[11px] text-destructive">{formErrors.events.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateWebhookOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || createWebhookMutation.isPending}
              className="gap-1.5"
            >
              {createWebhookMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Webhook className="size-3.5" />
                  <span>Register Webhook</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
