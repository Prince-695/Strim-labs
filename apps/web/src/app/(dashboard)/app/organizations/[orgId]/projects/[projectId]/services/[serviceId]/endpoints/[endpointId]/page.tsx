"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  Zap,
  ArrowLeft,
  Shield,
  Clock,
  Tag,
  AlertTriangle,
  Code,
  FileText,
  Activity,
  Layers,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HttpMethodBadge } from "@/components/data-display/http-method-badge";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";

interface PageProps {
  params: Promise<{
    orgId: string;
    projectId: string;
    serviceId: string;
    endpointId: string;
  }>;
}

export default function EndpointDetailPage({ params }: PageProps) {
  const { orgId, projectId, serviceId, endpointId } = use(params);
  const router = useRouter();

  // Query endpoints for this service
  const { data: endpointsData, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.services.endpoints(orgId, projectId, serviceId),
    queryFn: () =>
      fetchApi<{ endpoints: Schemas["Endpoint"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services/${serviceId}/endpoints`
      ).then((res) => res.endpoints),
  });

  // Query endpoint changes
  const { data: changesData } = useQuery({
    queryKey: [...queryKeys.services.endpoints(orgId, projectId, serviceId), "changes"],
    queryFn: () =>
      fetchApi<{ changes: Schemas["EndpointChange"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services/${serviceId}/endpoint-changes`
      ).then((res) => res.changes),
  });

  if (isLoading) return <LoadingState message="Loading endpoint schema & metadata..." />;

  const endpoint = endpointsData?.find((e) => e.id === endpointId);

  if (error || !endpoint) {
    return (
      <ErrorState
        title="Endpoint not found"
        description="The requested endpoint could not be found or may have been deleted."
        onRetry={refetch}
      />
    );
  }

  const changes = (changesData || []).filter(
    (c) => c.method === endpoint.method && c.path === endpoint.path
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            router.push(
              `/app/organizations/${orgId}/projects/${projectId}/services/${serviceId}/endpoints`
            )
          }
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>All Endpoints</span>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <HttpMethodBadge method={endpoint.method} />
            <h1 className="font-mono text-base font-bold text-foreground">{endpoint.path}</h1>
          </div>
          {endpoint.summary && (
            <p className="text-xs text-muted-foreground">{endpoint.summary}</p>
          )}
        </div>

        <Button
          size="sm"
          onClick={() =>
            router.push(
              `/app/organizations/${orgId}/projects/${projectId}/load-tests/new?serviceId=${serviceId}&endpointId=${endpoint.id}`
            )
          }
          className="gap-1.5"
        >
          <Zap className="size-4" />
          <span>Launch Load Test</span>
        </Button>
      </div>

      {/* Deprecated Alert Banner */}
      {endpoint.deprecated && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-amber-400" />
          <span>This endpoint is marked as DEPRECATED according to OpenAPI specification.</span>
        </div>
      )}

      {/* Metadata Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-[11px] font-medium text-muted-foreground">Safety Classification</span>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={endpoint.isSafe ? "default" : "secondary"} className="font-mono text-xs">
              {endpoint.isSafe ? "SAFE / IDEMPOTENT" : "MUTATION"}
            </Badge>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {endpoint.isSafe
              ? "Safe for high-concurrency continuous read testing."
              : "Requires payload templates and write authorization."}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-[11px] font-medium text-muted-foreground">Discovery Source</span>
          <div className="mt-1 font-mono text-sm font-semibold text-foreground">
            {endpoint.source}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Registered via automated OpenAPI crawler or SDK trace ingestion.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-[11px] font-medium text-muted-foreground">Last Updated</span>
          <div className="mt-1 font-mono text-sm font-semibold text-foreground">
            {new Date(endpoint.updatedAt).toLocaleDateString()}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Created: {new Date(endpoint.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Description & Operation ID */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Route Specification</h3>
          <p className="text-xs text-muted-foreground">
            Operation identity and semantic contract definition.
          </p>
        </div>

        {endpoint.operationId && (
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Operation ID</label>
            <div className="rounded-lg border border-border bg-surface-muted p-2 font-mono text-xs text-foreground">
              {endpoint.operationId}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Documentation &amp; Description</label>
          <div className="rounded-lg border border-border bg-surface-muted/50 p-3 text-xs text-muted-foreground">
            {endpoint.description || "No description provided in specification."}
          </div>
        </div>

        {endpoint.tags && endpoint.tags.length > 0 && (
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Tags</label>
            <div className="flex flex-wrap gap-1">
              {endpoint.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs font-mono">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Changes History */}
      {changes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Specification Changes</h3>
          <div className="space-y-2">
            {changes.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/30 p-2.5 text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {c.changeType}
                  </Badge>
                  <span>{`${c.method} ${c.path} · ${c.changeType}`}</span>
                </div>
                <span className="text-muted-foreground text-[11px]">
                  {new Date(c.detectedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
