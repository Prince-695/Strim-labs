"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  Clock,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Server,
  Zap,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string }>;
}

export default function DistributedTracesPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const router = useRouter();

  // Fetch Services
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: queryKeys.services.all(orgId, projectId),
    queryFn: () =>
      fetchApi<{ services: Schemas["Service"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services`
      ).then((res) => res.services),
  });

  const services = servicesData || [];
  const primaryServiceId = services[0]?.id;

  // Fetch Traces for primary service
  const { data: tracesData, isLoading: tracesLoading, refetch } = useQuery({
    queryKey: ["traces", orgId, projectId, primaryServiceId],
    enabled: Boolean(primaryServiceId),
    queryFn: () =>
      fetchApi<{ traces: Schemas["Trace"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/monitoring/services/${primaryServiceId}/traces`
      ).then((res) => res.traces),
  });

  if (servicesLoading || tracesLoading) {
    return <LoadingState message="Connecting to OpenTelemetry distributed trace collector..." />;
  }

  const traces = tracesData || [];

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
        title="Distributed Traces"
        description="End-to-end request propagation, span waterfalls, and downstream latency profiling."
      />

      {traces.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No distributed traces captured"
          description="Initialize the STRIM Labs SDK or configure an OpenTelemetry OTLP trace exporter with your project ingest key."
          action={{
            label: "View Ingest Key",
            onClick: () => router.push(`/app/organizations/${orgId}/projects/${projectId}/settings`),
          }}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Trace ID</TH>
                <TH>Root Service</TH>
                <TH>Total Duration</TH>
                <TH>Spans</TH>
                <TH>Status</TH>
                <TH>Timestamp</TH>
              </TR>
            </THead>
            <TBody>
              {traces.map((trace) => (
                <TR key={trace.traceId}>
                  <TD className="text-xs font-mono font-semibold text-brand">
                    {trace.traceId.slice(0, 16)}...
                  </TD>
                  <TD className="text-xs font-mono text-foreground">{trace.service}</TD>
                  <TD className="text-xs font-mono text-foreground">{trace.duration.toFixed(2)} ms</TD>
                  <TD className="text-xs font-mono text-muted-foreground">
                    {trace.spans?.length ?? 0} spans
                  </TD>
                  <TD>
                    <Badge
                      variant={trace.hasErrors ? "destructive" : "default"}
                      className="font-mono text-[10px]"
                    >
                      {trace.hasErrors ? "ERROR" : "SUCCESS"}
                    </Badge>
                  </TD>
                  <TD className="text-xs font-mono text-muted-foreground">
                    {new Date(trace.startedAt).toLocaleTimeString()}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
