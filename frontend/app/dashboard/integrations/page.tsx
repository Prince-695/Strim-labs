"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Blocks,
  Plus,
  Trash2,
  Key,
  Bell,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Shield,
  Webhook,
  Send,
  Code2,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { webhookApi, type WebhookItem, type CreateWebhookPayload } from "@/lib/webhook-api"
import { projectApi } from "@/lib/project-api"
import { useUIStore } from "@/lib/stores/ui-store"
import { TelemetryMiddlewareModal } from "@/components/integrations/telemetry-middleware-modal"

const AVAILABLE_EVENTS = [
  { id: "test.started", label: "Test Started", desc: "Triggered when a new load test execution begins" },
  { id: "test.completed", label: "Test Completed", desc: "Triggered when a load test finishes successfully" },
  { id: "test.failed", label: "Test Failed", desc: "Triggered if a load test crashes or encounters execution errors" },
  { id: "threshold.breached", label: "SLO Breached", desc: "Triggered when P95 latency or error rate exceeds threshold" },
]

export default function IntegrationsPage() {
  const queryClient = useQueryClient()
  const { currentOrgId, currentProjectId, setProjectId } = useUIStore()

  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [isTelemetryModalOpen, setIsTelemetryModalOpen] = React.useState(false)
  const [webhookUrl, setWebhookUrl] = React.useState("")
  const [webhookSecret, setWebhookSecret] = React.useState("")
  const [selectedEvents, setSelectedEvents] = React.useState<string[]>([
    "test.completed",
    "threshold.breached",
  ])
  const [formError, setFormError] = React.useState<string | null>(null)

  // 1. Fetch Projects list
  const { data: projectsRes } = useQuery({
    queryKey: ["projects_list", currentOrgId],
    queryFn: () => projectApi.list(currentOrgId!),
    enabled: Boolean(currentOrgId),
  })

  const projects = projectsRes?.data || []
  const activeProjectId = currentProjectId || (projects.length > 0 ? projects[0].id : "")
  const activeProject = projects.find((p) => p.id === activeProjectId)

  // Auto-select first project
  React.useEffect(() => {
    if (!currentProjectId && projects.length > 0) {
      setProjectId(projects[0].id)
    }
  }, [currentProjectId, projects, setProjectId])

  // 2. Fetch Webhooks
  const { data: webhooksRes, isLoading } = useQuery({
    queryKey: ["webhooks_list", currentOrgId, activeProjectId],
    queryFn: () => webhookApi.list(currentOrgId!, activeProjectId),
    enabled: Boolean(currentOrgId && activeProjectId),
  })

  // 3. Create Webhook Mutation
  const createMutation = useMutation({
    mutationFn: (payload: CreateWebhookPayload) =>
      webhookApi.create(currentOrgId!, activeProjectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks_list", currentOrgId, activeProjectId] })
      setIsAddModalOpen(false)
      setWebhookUrl("")
      setWebhookSecret("")
      setFormError(null)
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Failed to create webhook.")
    },
  })

  // 4. Delete Webhook Mutation
  const deleteMutation = useMutation({
    mutationFn: (webhookId: string) =>
      webhookApi.delete(currentOrgId!, activeProjectId, webhookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks_list", currentOrgId, activeProjectId] })
    },
  })

  const webhooks = webhooksRes?.data || []

  const handleToggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    )
  }

  const handleCreateWebhook = (e: React.FormEvent) => {
    e.preventDefault()
    if (!webhookUrl) {
      setFormError("Webhook URL is required.")
      return
    }
    if (selectedEvents.length === 0) {
      setFormError("Select at least one event subscription.")
      return
    }
    createMutation.mutate({
      url: webhookUrl,
      events: selectedEvents,
      secret: webhookSecret || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations & Webhooks"
        description="Connect alerting endpoints, incident response pipelines, and developer credentials."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTelemetryModalOpen(true)}
              className="gap-1.5 text-xs font-mono border-border-subtle hover:bg-surface-raised text-sand"
            >
              <Code2 className="size-3.5 text-brand" />
              <span>Telemetry Snippets</span>
            </Button>
            <Link
              href="/dashboard/settings/api-keys"
              className={buttonVariants({
                variant: "outline",
                className: "gap-1.5 text-xs font-mono border-border-subtle hover:bg-surface-raised",
              })}
            >
              <Key className="size-3.5" />
              <span>Manage API Keys</span>
            </Link>
            <Button
              onClick={() => {
                setFormError(null)
                setIsAddModalOpen(true)
              }}
              className="gap-1.5 bg-brand text-white hover:bg-brand-hover text-xs font-mono"
            >
              <Plus className="size-3.5" />
              <span>Add Webhook</span>
            </Button>
          </div>
        }
      />

      {/* Target Project Selector */}
      <Card className="border-border bg-surface relative overflow-hidden">
        <CornerCrosshairs />
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-foreground-subtle uppercase">Target Project:</span>
            {projects.length > 0 ? (
              <select
                value={activeProjectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="rounded-md border border-border-subtle bg-surface-raised px-3 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:border-brand"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.environment})
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-mono text-xs text-foreground-muted">No projects found</span>
            )}

            {activeProject && (
              <span className="font-mono text-xs text-foreground-muted">
                Base URL: <strong className="text-foreground">{activeProject.base_url}</strong>
              </span>
            )}
          </div>

          <div className="font-mono text-xs text-foreground-subtle">
            {webhooks.length} configured {webhooks.length === 1 ? "webhook" : "webhooks"}
          </div>
        </CardContent>
      </Card>

      {/* Feature 4: Add Live Traffic Telemetry Card */}
      <Card className="border-border bg-surface p-5 shadow-xs relative overflow-hidden font-mono text-xs">
        <CornerCrosshairs />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <Code2 className="size-4 text-brand" />
              <h3 className="font-heading font-bold text-sm text-foreground">
                Add Live Traffic Telemetry
              </h3>
              <span className="rounded bg-brand/15 border border-brand/30 px-2 py-0.5 text-[10px] text-brand font-bold uppercase">
                SDK & cURL Ingestion
              </span>
            </div>
            <p className="text-foreground-muted leading-relaxed">
              Inject live production traffic, status code distributions, and p95 tail latencies directly into Strim Labs using our lightweight Node.js, Python, or cURL middleware snippets.
            </p>
          </div>

          <Button
            onClick={() => setIsTelemetryModalOpen(true)}
            className="bg-brand text-white hover:bg-brand-hover text-xs font-mono font-medium gap-1.5 shrink-0 shadow-md"
          >
            <Code2 className="size-3.5" />
            <span>Add Live Traffic Telemetry</span>
          </Button>
        </div>
      </Card>

      {/* Main Grid: Webhooks List + Ecosystem Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Webhooks Column */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border bg-surface shadow-xs relative overflow-hidden">
            <CornerCrosshairs />
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold font-heading text-foreground flex items-center gap-2">
                    <Webhook className="size-4 text-brand" />
                    <span>Outbound Webhooks</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-foreground-muted font-mono">
                    Receive real-time HTTP POST notifications when load tests finish or breach latency thresholds.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 font-mono text-xs">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : webhooks.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<Webhook className="size-6 text-foreground-muted" />}
                    title="No Webhooks Configured"
                    description="Configure an HTTP callback URL to automatically dispatch test events to Slack, Discord, or your internal alerts."
                    action={
                      <Button
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5"
                      >
                        <Plus className="size-3.5" />
                        <span>Add Webhook Endpoint</span>
                      </Button>
                    }
                  />
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {webhooks.map((hook: WebhookItem) => (
                    <div
                      key={hook.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-raised/20 transition-colors"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-success" />
                          <span className="font-semibold text-foreground truncate max-w-md">
                            {hook.url}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {hook.events.map((ev) => (
                            <span
                              key={ev}
                              className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-foreground-subtle border border-border-subtle"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(hook.id)}
                          disabled={deleteMutation.isPending}
                          className="h-8 text-foreground-subtle hover:text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ecosystem Integrations */}
        <div className="space-y-4">
          <Card className="border-border bg-surface shadow-xs">
            <CardHeader className="pb-3 border-b border-border-subtle">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-sand">
                Ecosystem Connectors
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 font-mono text-xs">
              {/* Slack */}
              <div className="rounded-lg border border-border-subtle bg-surface-raised/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Bell className="size-4 text-purple-400" />
                    <span>Slack Alerts</span>
                  </div>
                  <span className="text-[10px] uppercase text-sand bg-surface border border-border-subtle px-1.5 py-0.5 rounded">
                    Webhook
                  </span>
                </div>
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  Paste an Incoming Webhook URL into the webhook manager to receive channel pings on SLO breaches.
                </p>
              </div>

              {/* API Keys */}
              <div className="rounded-lg border border-border-subtle bg-surface-raised/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Key className="size-4 text-brand" />
                    <span>CI/CD Pipeline Keys</span>
                  </div>
                </div>
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  Trigger automated load test runs directly from GitHub Actions or GitLab CI using API tokens.
                </p>
                <Link
                  href="/dashboard/settings/api-keys"
                  className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline pt-1"
                >
                  <span>Manage tokens</span>
                  <ExternalLink className="size-3" />
                </Link>
              </div>

              {/* Telemetry Middleware Connector */}
              <div className="rounded-lg border border-border-subtle bg-surface-raised/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Code2 className="size-4 text-brand" />
                    <span>Telemetry SDK</span>
                  </div>
                  <span className="text-[10px] uppercase text-brand bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded">
                    Node / Python
                  </span>
                </div>
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  Embed middleware into your Express or FastAPI backend to capture live production traffic.
                </p>
                <button
                  type="button"
                  onClick={() => setIsTelemetryModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline pt-1 font-medium"
                >
                  <span>View integration snippets</span>
                  <ExternalLink className="size-3" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Feature 4: Code Injection (Middleware) Snippet Modal */}
      <TelemetryMiddlewareModal
        isOpen={isTelemetryModalOpen}
        onClose={() => setIsTelemetryModalOpen(false)}
        projectId={activeProjectId}
      />

      {/* Add Webhook Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-lg border-border bg-surface shadow-2xl">
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold font-heading text-foreground">
                  Register New Webhook
                </CardTitle>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded p-1 text-foreground-muted hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <CardDescription className="text-xs text-foreground-muted font-mono">
                Strim Labs will dispatch JSON payloads to this HTTP POST endpoint.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleCreateWebhook}>
              <CardContent className="pt-6 space-y-4 font-mono text-xs">
                {formError && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-danger">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-foreground-muted">Payload URL</label>
                  <Input
                    placeholder="https://api.yourdomain.com/webhooks/strim"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="bg-surface-raised border-border-subtle text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-foreground-muted">Signing Secret (Optional)</label>
                  <Input
                    type="password"
                    placeholder="whsec_..."
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="bg-surface-raised border-border-subtle text-xs font-mono"
                  />
                  <span className="text-[10px] text-foreground-subtle block">
                    Used to verify HMAC-SHA256 signatures in the X-Strim-Signature header.
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-foreground-muted block">Event Subscriptions</label>
                  <div className="space-y-2">
                    {AVAILABLE_EVENTS.map((ev) => {
                      const isChecked = selectedEvents.includes(ev.id)
                      return (
                        <div
                          key={ev.id}
                          onClick={() => handleToggleEvent(ev.id)}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            isChecked
                              ? "border-brand/40 bg-brand/5"
                              : "border-border-subtle bg-surface-raised/40 hover:border-border"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-0.5 accent-brand"
                          />
                          <div>
                            <span className="font-semibold text-foreground block">{ev.label}</span>
                            <span className="text-[11px] text-foreground-subtle leading-normal">
                              {ev.desc}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border-subtle">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={createMutation.isPending}
                    className="font-mono text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="bg-brand text-white hover:bg-brand-hover font-mono text-xs gap-1.5"
                  >
                    {createMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                    <span>Save Webhook</span>
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
