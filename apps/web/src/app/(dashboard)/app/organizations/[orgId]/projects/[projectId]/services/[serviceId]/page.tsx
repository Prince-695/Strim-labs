"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Server,
  Globe,
  Compass,
  Zap,
  ArrowRight,
  Shield,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Plus,
  Loader2,
  Settings,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HttpMethodBadge } from "@/components/data-display/http-method-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string; serviceId: string }>;
}

export default function ServiceOverviewPage({ params }: PageProps) {
  const { orgId, projectId, serviceId } = use(params);
  const router = useRouter();

  // Query Service Details
  const {
    data: service,
    isLoading: serviceLoading,
    error: serviceError,
    refetch: refetchService,
  } = useQuery({
    queryKey: queryKeys.services.detail(orgId, projectId, serviceId),
    queryFn: () =>
      fetchApi<{ service: Schemas["Service"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services/${serviceId}`
      ).then((res) => res.service),
  });

  // Query Endpoints
  const {
    data: endpointsData,
    isLoading: endpointsLoading,
  } = useQuery({
    queryKey: queryKeys.services.endpoints(orgId, projectId, serviceId),
    queryFn: () =>
      fetchApi<{ endpoints: Schemas["Endpoint"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services/${serviceId}/endpoints`
      ).then((res) => res.endpoints),
  });

  // Reachability Probe Mutation
  const verifyMutation = useMutation({
    mutationFn: () =>
      fetchApi<{
        reachable: boolean;
        latencyMs: number | null;
        statusCode: number | null;
        error: string | null;
      }>(`/api/v1/organizations/${orgId}/projects/${projectId}/services/${serviceId}/verify`, {
        method: "POST",
      }),
  });

  if (serviceLoading || endpointsLoading) {
    return <LoadingState message="Loading service topology..." />;
  }

  if (serviceError || !service) {
    return (
      <ErrorState
        title="Failed to load service"
        description={(serviceError as any)?.message || "Service could not be found."}
        onRetry={refetchService}
      />
    );
  }

  const endpoints = endpointsData || [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={service.name}
        description={service.baseUrl}
        badge={
          <Badge
            variant={service.status === "HEALTHY" ? "default" : "destructive"}
            className="font-mono text-xs"
          >
            {service.status}
          </Badge>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={verifyMutation.isPending}
              onClick={() => verifyMutation.mutate()}
              className="gap-1.5"
            >
              {verifyMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              <span>Verify Health</span>
            </Button>
            <Button
              size="sm"
              onClick={() =>
                router.push(
                  `/app/organizations/${orgId}/projects/${projectId}/services/${serviceId}/discovery`
                )
              }
              className="gap-1.5"
            >
              <Compass className="size-4" />
              <span>Discovery Runs</span>
            </Button>
          </div>
        }
      />

      {/* Verification Probe Result Banner */}
      {verifyMutation.data && (
        <div
          className={`rounded-xl border p-4 flex items-center justify-between text-xs font-mono ${
            verifyMutation.data.reachable
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {verifyMutation.data.reachable ? (
              <CheckCircle2 className="size-4 text-emerald-400" />
            ) : (
              <XCircle className="size-4 text-rose-400" />
            )}
            <span>
              {verifyMutation.data.reachable
                ? `Reachable: HTTP ${verifyMutation.data.statusCode} in ${verifyMutation.data.latencyMs}ms`
                : `Target unreachable: ${verifyMutation.data.error || "Connection timed out"}`}
            </span>
          </div>
        </div>
      )}

      {/* Service Meta Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Globe className="size-4 text-brand" />
            <span>Environment</span>
          </div>
          <div className="mt-2 text-lg font-bold text-foreground font-mono">
            {service.environment || "PRODUCTION"}
          </div>
          <div className="text-[11px] text-muted-foreground">Target deployment tier</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Server className="size-4 text-brand" />
            <span>Framework</span>
          </div>
          <div className="mt-2 text-lg font-bold text-foreground truncate">
            {service.framework || service.language || "Custom"}
          </div>
          <div className="text-[11px] text-muted-foreground">Runtime architecture</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Compass className="size-4 text-brand" />
            <span>Discovered Routes</span>
          </div>
          <div className="mt-2 text-lg font-bold text-foreground font-mono">
            {endpoints.length}
          </div>
          <div className="text-[11px] text-muted-foreground">Cataloged endpoints</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Clock className="size-4 text-brand" />
            <span>Registered</span>
          </div>
          <div className="mt-2 text-lg font-bold text-foreground font-mono text-sm">
            {new Date(service.createdAt).toLocaleDateString()}
          </div>
          <div className="text-[11px] text-muted-foreground">Initial provisioning</div>
        </div>
      </div>

      {/* Endpoints Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">API Endpoints</h2>
            <p className="text-xs text-muted-foreground">
              Routes discovered via crawling, OpenAPI spec, or manual registration.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              router.push(
                `/app/organizations/${orgId}/projects/${projectId}/services/${serviceId}/endpoints`
              )
            }
            className="text-xs"
          >
            View All ({endpoints.length}) &rarr;
          </Button>
        </div>

        {endpoints.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="No endpoints discovered yet"
            description="Run an automated discovery crawl or import your OpenAPI specification to extract routes."
            action={{
              label: "Start API Discovery",
              onClick: () =>
                router.push(
                  `/app/organizations/${orgId}/projects/${projectId}/services/${serviceId}/discovery`
                ),
            }}
          />
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>Method</TH>
                  <TH>Endpoint Path</TH>
                  <TH>Summary</TH>
                  <TH>Source</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {endpoints.slice(0, 10).map((ep) => (
                  <TR key={ep.id}>
                    <TD>
                      <HttpMethodBadge method={ep.method} />
                    </TD>
                    <TD className="text-xs font-mono font-medium text-foreground">
                      {ep.path}
                    </TD>
                    <TD className="text-xs text-muted-foreground truncate max-w-xs">
                      {ep.summary || ep.description || "—"}
                    </TD>
                    <TD>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {ep.source}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-brand hover:text-brand"
                        onClick={() =>
                          router.push(
                            `/app/organizations/${orgId}/projects/${projectId}/services/${serviceId}/endpoints/${ep.id}`
                          )
                        }
                      >
                        <span>Details</span>
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
    </div>
  );
}
