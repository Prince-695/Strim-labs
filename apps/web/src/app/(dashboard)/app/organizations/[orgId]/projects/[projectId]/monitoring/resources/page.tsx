"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Cpu,
  Database,
  ArrowLeft,
  Server,
  Layers,
  Clock,
  HardDrive,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string }>;
}

export default function ResourceMetricsPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const router = useRouter();

  // Query Services to resolve primary service
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: queryKeys.services.all(orgId, projectId),
    queryFn: () =>
      fetchApi<{ services: Schemas["Service"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services`
      ).then((res) => res.services),
  });

  const services = servicesData || [];
  const primaryServiceId = services[0]?.id;

  // Query Resource Metrics
  const { data: resources, isLoading: resourcesLoading } = useQuery({
    queryKey: ["resource-metrics", orgId, projectId, primaryServiceId],
    enabled: Boolean(primaryServiceId),
    queryFn: () =>
      fetchApi<{
        cpuPct: number;
        memoryMb: number;
        uptimeSeconds: number;
        instances: number;
      }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/monitoring/services/${primaryServiceId}/resource-metrics`
      ),
    refetchInterval: 10000,
  });

  // Query Dependencies Topology
  const { data: depsData, isLoading: depsLoading } = useQuery({
    queryKey: ["dependencies", orgId, projectId, primaryServiceId],
    enabled: Boolean(primaryServiceId),
    queryFn: () =>
      fetchApi<{
        dependencies: {
          name: string;
          type: "HTTP" | "DATABASE" | "REDIS" | "QUEUE" | "EXTERNAL";
          health: "HEALTHY" | "DEGRADED" | "DOWN";
          avgLatencyMs: number;
        }[];
      }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/monitoring/services/${primaryServiceId}/dependencies`
      ),
  });

  if (servicesLoading || resourcesLoading || depsLoading) {
    return <LoadingState message="Polling host telemetry and infrastructure metrics..." />;
  }

  const res = resources || { cpuPct: 0, memoryMb: 0, uptimeSeconds: 0, instances: 1 };
  const dependencies = depsData?.dependencies || [];

  const uptimeDays = Math.floor(res.uptimeSeconds / 86400);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/app/organizations/${orgId}/projects/${projectId}/monitoring`)}
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>Observability Overview</span>
        </Button>
      </div>

      <PageHeader
        title="Host &amp; Container Resources"
        description="CPU utilization, memory saturation, container instances, and downstream database latency."
      />

      {/* Resource Gauges Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {/* CPU */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">CPU Utilization</span>
            <Cpu className="size-4 text-brand" />
          </div>
          <div className="font-mono text-2xl font-bold text-foreground">
            {res.cpuPct.toFixed(1)}%
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${Math.min(100, res.cpuPct)}%` }}
            />
          </div>
        </div>

        {/* RAM */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Resident Memory</span>
            <HardDrive className="size-4 text-emerald-500" />
          </div>
          <div className="font-mono text-2xl font-bold text-foreground">
            {res.memoryMb} MB
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.min(100, (res.memoryMb / 2048) * 100)}%` }}
            />
          </div>
        </div>

        {/* Instances */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Replicas</span>
            <Server className="size-4 text-purple-500" />
          </div>
          <div className="font-mono text-2xl font-bold text-foreground">
            {res.instances} Nodes
          </div>
          <div className="text-[11px] text-muted-foreground">Autoscaled task containers</div>
        </div>

        {/* Uptime */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Process Uptime</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="font-mono text-2xl font-bold text-foreground">
            {uptimeDays} Days
          </div>
          <div className="text-[11px] text-muted-foreground">Continuous zero-crash runtime</div>
        </div>
      </div>

      {/* Dependencies Topology */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Downstream Dependencies &amp; Latency</h3>
          <p className="text-xs text-muted-foreground">
            Inferred microservice dependencies, cache clusters, and database query latencies.
          </p>
        </div>

        {dependencies.length === 0 ? (
          <p className="text-xs text-muted-foreground">No downstream dependencies detected in telemetry.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Dependency</TH>
                <TH>Type</TH>
                <TH>Health Status</TH>
                <TH className="text-right">Average Response Latency</TH>
              </TR>
            </THead>
            <TBody>
              {dependencies.map((dep, idx) => (
                <TR key={idx}>
                  <TD className="text-xs font-semibold text-foreground">{dep.name}</TD>
                  <TD>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {dep.type}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge
                      variant={dep.health === "HEALTHY" ? "default" : "destructive"}
                      className="font-mono text-[10px]"
                    >
                      {dep.health}
                    </Badge>
                  </TD>
                  <TD className="text-right font-mono text-xs font-bold text-brand">
                    {dep.avgLatencyMs.toFixed(1)} ms
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
