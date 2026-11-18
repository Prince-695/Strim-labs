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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import {
  webhookApi,
  type WebhookItem,
  type CreateWebhookPayload,
} from "@/lib/webhook-api"
import { projectApi } from "@/lib/project-api"
import { useUIStore } from "@/lib/stores/ui-store"
import { TelemetryMiddlewareModal } from "@/components/integrations/telemetry-middleware-modal"

const AVAILABLE_EVENTS = [
  {
    id: "test.started",
    label: "Test Started",
    desc: "Triggered when a new load test execution begins",
  },
  {
    id: "test.completed",
    label: "Test Completed",
    desc: "Triggered when a load test finishes successfully",
  },
  {
    id: "test.failed",
    label: "Test Failed",
    desc: "Triggered if a load test crashes or encounters execution errors",
  },
  {
    id: "threshold.breached",
    label: "SLO Breached",
    desc: "Triggered when P95 latency or error rate exceeds threshold",
  },
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
  const activeProjectId =
    currentProjectId || (projects.length > 0 ? projects[0].id : "")
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
      queryClient.invalidateQueries({
        queryKey: ["webhooks_list", currentOrgId, activeProjectId],
      })
      setIsAddModalOpen(false)
      setWebhookUrl("")
      setWebhookSecret("")
      setFormError(null)
    },
    onError: (err: unknown) => {
      setFormError(
        err instanceof Error ? err.message : "Failed to create webhook."
      )
    },
  })

  // 4. Delete Webhook Mutation
  const deleteMutation = useMutation({
    mutationFn: (webhookId: string) =>
      webhookApi.delete(currentOrgId!, activeProjectId, webhookId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["webhooks_list", currentOrgId, activeProjectId],
      })
    },
  })

  const webhooks = webhooksRes?.data || []

  const handleToggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((e) => e !== eventId)
        : [...prev, eventId]
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
              className="gap-1.5 border-border-subtle font-mono text-xs text-sand hover:bg-surface-raised"
            >
              <Code2 className="size-3.5 text-brand" />
              <span>Telemetry Snippets</span>
            </Button>
            <Link
              href="/dashboard/settings/api-keys"
              className={buttonVariants({
                variant: "outline",
                className:
                  "gap-1.5 border-border-subtle font-mono text-xs hover:bg-surface-raised",
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
              className="gap-1.5 bg-brand font-mono text-xs text-white hover:bg-brand-hover"
            >
              <Plus className="size-3.5" />
              <span>Add Webhook</span>
            </Button>
          </div>
        }
      />

      {/* Target Project Selector */}
      <Card className="relative overflow-hidden border-border bg-surface">
        <CornerCrosshairs />
        <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-foreground-subtle uppercase">
              Target Project:
            </span>
            {projects.length > 0 ? (
              <select
                value={activeProjectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="rounded-md border border-border-subtle bg-surface-raised px-3 py-1.5 font-mono text-xs text-foreground focus:border-brand focus:outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.environment})
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-mono text-xs text-foreground-muted">
                No projects found
              </span>
            )}

            {activeProject && (
              <span className="font-mono text-xs text-foreground-muted">
                Base URL:{" "}
                <strong className="text-foreground">
                  {activeProject.base_url}
                </strong>
              </span>
            )}
          </div>

          <div className="font-mono text-xs text-foreground-subtle">
            {webhooks.length} configured{" "}
            {webhooks.length === 1 ? "webhook" : "webhooks"}
          </div>
        </CardContent>
      </Card>

      {/* Feature 4: Add Live Traffic Telemetry Card */}
      <Card className="relative overflow-hidden border-border bg-surface p-5 font-mono text-xs shadow-xs">
        <CornerCrosshairs />
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="max-w-2xl space-y-1.5">
            <div className="flex items-center gap-2">
              <Code2 className="size-4 text-brand" />
              <h3 className="font-heading text-sm font-bold text-foreground">
                Add Live Traffic Telemetry
              </h3>
              <span className="rounded border border-brand/30 bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand uppercase">
                SDK & cURL Ingestion
              </span>
            </div>
            <p className="leading-relaxed text-foreground-muted">
              Inject live production traffic, status code distributions, and p95
              tail latencies directly into Strim Labs using our lightweight
              Node.js, Python, or cURL middleware snippets.
            </p>
          </div>

          <Button
            onClick={() => setIsTelemetryModalOpen(true)}
            className="shrink-0 gap-1.5 bg-brand font-mono text-xs font-medium text-white shadow-md hover:bg-brand-hover"
          >
            <Code2 className="size-3.5" />
            <span>Add Live Traffic Telemetry</span>
          </Button>
        </div>
      </Card>

      {/* Main Grid: Webhooks List + Ecosystem Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Webhooks Column */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="relative overflow-hidden border-border bg-surface shadow-xs">
            <CornerCrosshairs />
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
                    <Webhook className="size-4 text-brand" />
                    <span>Outbound Webhooks</span>
                  </CardTitle>
                  <CardDescription className="font-mono text-xs text-foreground-muted">
                    Receive real-time HTTP POST notifications when load tests
                    finish or breach latency thresholds.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 font-mono text-xs">
              {isLoading ? (
                <div className="space-y-4 p-6">
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
                        className="gap-1.5 bg-brand font-mono text-xs text-white hover:bg-brand-hover"
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
                      className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-surface-raised/20 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-success" />
                          <span className="max-w-md truncate font-semibold text-foreground">
                            {hook.url}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {hook.events.map((ev) => (
                            <span
                              key={ev}
                              className="rounded border border-border-subtle bg-surface-raised px-1.5 py-0.5 text-[10px] text-foreground-subtle"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(hook.id)}
                          disabled={deleteMutation.isPending}
                          className="h-8 text-foreground-subtle hover:bg-danger/10 hover:text-danger"
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
            <CardHeader className="border-b border-border-subtle pb-3">
              <CardTitle className="text-xs font-semibold tracking-wider text-sand uppercase">
                Ecosystem Connectors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 font-mono text-xs">
              {/* Slack */}
              <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-raised/50 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Bell className="size-4 text-purple-400" />
                    <span>Slack Alerts</span>
                  </div>
                  <span className="rounded border border-border-subtle bg-surface px-1.5 py-0.5 text-[10px] text-sand uppercase">
                    Webhook
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-foreground-muted">
                  Paste an Incoming Webhook URL into the webhook manager to
                  receive channel pings on SLO breaches.
                </p>
              </div>

              {/* API Keys */}
              <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-raised/50 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Key className="size-4 text-brand" />
                    <span>CI/CD Pipeline Keys</span>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-foreground-muted">
                  Trigger automated load test runs directly from GitHub Actions
                  or GitLab CI using API tokens.
                </p>
                <Link
                  href="/dashboard/settings/api-keys"
                  className="inline-flex items-center gap-1 pt-1 text-[11px] text-brand hover:underline"
                >
                  <span>Manage tokens</span>
                  <ExternalLink className="size-3" />
                </Link>
              </div>

              {/* Telemetry Middleware Connector */}
              <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-raised/50 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Code2 className="size-4 text-brand" />
                    <span>Telemetry SDK</span>
                  </div>
                  <span className="rounded border border-brand/20 bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand uppercase">
                    Node / Python
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-foreground-muted">
                  Embed middleware into your Express or FastAPI backend to
                  capture live production traffic.
                </p>
                <button
                  type="button"
                  onClick={() => setIsTelemetryModalOpen(true)}
                  className="inline-flex items-center gap-1 pt-1 text-[11px] font-medium text-brand hover:underline"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg border-border bg-surface shadow-2xl">
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-base font-semibold text-foreground">
                  Register New Webhook
                </CardTitle>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded p-1 text-foreground-muted hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <CardDescription className="font-mono text-xs text-foreground-muted">
                Strim Labs will dispatch JSON payloads to this HTTP POST
                endpoint.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleCreateWebhook}>
              <CardContent className="space-y-4 pt-6 font-mono text-xs">
                {formError && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-danger">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-foreground-muted">Payload URL</label>
                  <Input
                    placeholder="https://api.yourdomain.com/webhooks/strim"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="border-border-subtle bg-surface-raised font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-foreground-muted">
                    Signing Secret (Optional)
                  </label>
                  <Input
                    type="password"
                    placeholder="whsec_..."
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="border-border-subtle bg-surface-raised font-mono text-xs"
                  />
                  <span className="block text-[10px] text-foreground-subtle">
                    Used to verify HMAC-SHA256 signatures in the
                    X-Strim-Signature header.
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="block text-foreground-muted">
                    Event Subscriptions
                  </label>
                  <div className="space-y-2">
                    {AVAILABLE_EVENTS.map((ev) => {
                      const isChecked = selectedEvents.includes(ev.id)
                      return (
                        <div
                          key={ev.id}
                          onClick={() => handleToggleEvent(ev.id)}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
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
                            <span className="block font-semibold text-foreground">
                              {ev.label}
                            </span>
                            <span className="text-[11px] leading-normal text-foreground-subtle">
                              {ev.desc}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 border-t border-border-subtle pt-3">
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
                    className="gap-1.5 bg-brand font-mono text-xs text-white hover:bg-brand-hover"
                  >
                    {createMutation.isPending && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
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
