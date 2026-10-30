"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Layers,
  Activity,
  Server,
  Zap,
  Target,
  AlertOctagon,
  Clock,
  ArrowRight,
  Plus,
  Compass,
  FileCode,
  ShieldCheck,
  TrendingUp,
  Settings,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/data-display/metric-card";
import { PageHeader } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string }>;
}

export default function ProjectOverviewPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const router = useRouter();

  // Query Project details
  const {
    data: projectData,
    isLoading: projectLoading,
    error: projectError,
    refetch: refetchProject,
  } = useQuery({
    queryKey: queryKeys.projects.detail(orgId, projectId),
    queryFn: () =>
      fetchApi<{ project: Schemas["Project"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}`
      ).then((res) => res.project),
  });

  // Query Monitoring Overview telemetry
  const { data: telemetry, isLoading: telemetryLoading } = useQuery({
    queryKey: queryKeys.monitoring.overview(orgId, projectId),
    queryFn: () =>
      fetchApi<{
        servicesCount: number;
        healthyServices: number;
        activeIncidents: number;
        summary: Schemas["MetricsSummary"];
      }>(`/api/v1/organizations/${orgId}/projects/${projectId}/monitoring/overview`),
  });

  // Query Services list
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: queryKeys.services.all(orgId, projectId),
    queryFn: () =>
      fetchApi<{ services: Schemas["Service"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services`
      ).then((res) => res.services),
  });

  if (projectLoading || telemetryLoading || servicesLoading) {
    return <LoadingState message="Loading project telemetry and service mesh..." />;
  }

  if (projectError || !projectData) {
    return (
      <ErrorState
        title="Failed to load project"
        description={(projectError as any)?.message || "Could not retrieve project configuration."}
        onRetry={refetchProject}
      />
    );
  }

  const services = servicesData || [];
  const metrics = telemetry?.summary;

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title={projectData.name}
        description={projectData.description || `Environment: ${projectData.status}`}
        badge={
          <Badge variant={projectData.status === "ACTIVE" ? "default" : "secondary"} className="font-mono text-xs">
            {projectData.status}
          </Badge>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/app/organizations/${orgId}/projects/${projectId}/settings`)}
              className="gap-1.5"
            >
              <Settings className="size-3.5" />
              <span>Settings</span>
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`/app/organizations/${orgId}/projects/${projectId}/load-tests/new`)}
              className="gap-1.5"
            >
              <Zap className="size-4" />
              <span>Launch Load Test</span>
            </Button>
          </div>
        }
      />

      {/* Observability Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Throughput (RPS)"
          value={metrics ? `${metrics.rps.toFixed(1)} req/s` : "0.0 req/s"}
          helperText="Live request ingestion rate"
          icon={Activity}
        />
        <MetricCard
          title="p95 Latency"
          value={metrics ? `${metrics.p95Ms.toFixed(1)} ms` : "—"}
          helperText={metrics ? `p50: ${metrics.p50Ms.toFixed(1)}ms • p99: ${metrics.p99Ms.toFixed(1)}ms` : "No latency data"}
          icon={Clock}
        />
        <MetricCard
          title="Error Rate"
          value={metrics ? `${(metrics.errorRate * 100).toFixed(2)}%` : "0.00%"}
          helperText={metrics ? `${(metrics.successRate * 100).toFixed(2)}% success SLA` : "Healthy"}
          icon={AlertOctagon}
        />
        <MetricCard
          title="Healthy Services"
          value={`${telemetry?.healthyServices ?? 0} / ${telemetry?.servicesCount ?? 0}`}
          helperText={telemetry?.activeIncidents ? `${telemetry.activeIncidents} active incidents` : "All systems normal"}
          icon={ShieldCheck}
        />
      </div>

      {/* Services Mesh Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Registered Services</h2>
            <p className="text-xs text-muted-foreground">
              Microservices and backend APIs monitored by STRIM Labs SDK and OTel.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/app/organizations/${orgId}/projects/${projectId}/services/new`)}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            <span>Register Service</span>
          </Button>
        </div>

        {services.length === 0 ? (
          <EmptyState
            icon={Server}
            title="No services registered in this project"
            description="Register your first microservice to discover endpoints, import OpenAPI 3.1 specifications, and run capacity load tests."
            action={{
              label: "Register First Service",
              onClick: () => router.push(`/app/organizations/${orgId}/projects/${projectId}/services/new`),
            }}
          />
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>Service</TH>
                  <TH>Base URL</TH>
                  <TH>Health Status</TH>
                  <TH>Framework</TH>
                  <TH>Endpoints</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {services.map((svc) => (
                  <TR key={svc.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <Server className="size-3.5 text-brand shrink-0" />
                        <span className="font-semibold text-xs text-foreground">{svc.name}</span>
                      </div>
                    </TD>
                    <TD className="text-xs font-mono text-muted-foreground">
                      {svc.baseUrl}
                    </TD>
                    <TD>
                      <Badge
                        variant={svc.status === "HEALTHY" ? "default" : "destructive"}
                        className="font-mono text-[10px]"
                      >
                        {svc.status}
                      </Badge>
                    </TD>
                    <TD className="text-xs font-mono text-muted-foreground">
                      {svc.framework || svc.language || "Custom"}
                    </TD>
                    <TD className="text-xs font-mono text-foreground">
                      {svc.endpointCount ?? 0} routes
                    </TD>
                    <TD className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-brand hover:text-brand"
                        onClick={() =>
                          router.push(
                            `/app/organizations/${orgId}/projects/${projectId}/services/${svc.id}`
                          )
                        }
                      >
                        <span>Explore</span>
                        <ArrowRight className="size-3 ml-1" />
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </div>

      {/* Domain Quick Launch Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href={`/app/organizations/${orgId}/projects/${projectId}/monitoring`}
          className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-brand/40 hover:bg-surface-muted/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Activity className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground group-hover:text-brand">
                Live Observability
              </div>
              <div className="text-xs text-muted-foreground">Metrics explorer, distributed traces &amp; errors</div>
            </div>
          </div>
        </Link>

        <Link
          href={`/app/organizations/${orgId}/projects/${projectId}/load-tests`}
          className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-brand/40 hover:bg-surface-muted/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Zap className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground group-hover:text-brand">
                Load Testing
              </div>
              <div className="text-xs text-muted-foreground">Breaking point detection &amp; saturation benchmarks</div>
            </div>
          </div>
        </Link>

        <Link
          href={`/app/organizations/${orgId}/projects/${projectId}/diagnostics`}
          className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-brand/40 hover:bg-surface-muted/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <Target className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground group-hover:text-brand">
                Diagnostics
              </div>
              <div className="text-xs text-muted-foreground">Automated regression analysis &amp; bottleneck detection</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
