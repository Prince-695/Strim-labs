"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Server,
  Plus,
  ArrowRight,
  Compass,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  Clock,
  Sparkles,
  RefreshCw,
  Loader2,
  FileCode,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string }>;
}

export default function ServicesListPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [verifyStatus, setVerifyStatus] = useState<{ [serviceId: string]: { reachable: boolean; latencyMs?: number | null; error?: string | null } }>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.services.all(orgId, projectId),
    queryFn: () =>
      fetchApi<{ services: Schemas["Service"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services`
      ).then((res) => res.services),
  });

  // Verify Reachability Mutation
  const verifyMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const res = await fetchApi<{
        reachable: boolean;
        latencyMs: number | null;
        statusCode: number | null;
        error: string | null;
      }>(`/api/v1/organizations/${orgId}/projects/${projectId}/services/${serviceId}/verify`, {
        method: "POST",
      });
      return { serviceId, ...res };
    },
    onSuccess: (res) => {
      setVerifyStatus((prev) => ({
        ...prev,
        [res.serviceId]: {
          reachable: res.reachable,
          latencyMs: res.latencyMs,
          error: res.error,
        },
      }));
    },
  });

  if (isLoading) return <LoadingState message="Loading registered microservices..." />;

  if (error) {
    return (
      <ErrorState
        title="Failed to load services"
        description={(error as any)?.message || "Could not retrieve service registry."}
        onRetry={refetch}
      />
    );
  }

  const services = data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services &amp; APIs"
        description="Catalog of target backend endpoints, OpenAPI contracts, and microservice topologies."
        action={
          <Button
            size="sm"
            onClick={() => router.push(`/app/organizations/${orgId}/projects/${projectId}/services/new`)}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            <span>Register Service</span>
          </Button>
        }
      />

      {services.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No services registered"
          description="Register your API service base URL to automatically discover routes or import an OpenAPI specification."
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
                <TH>Service Name</TH>
                <TH>Base URL</TH>
                <TH>Health Status</TH>
                <TH>Framework / Language</TH>
                <TH>Discovered Routes</TH>
                <TH>Probe Verification</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {services.map((svc) => {
                const probe = verifyStatus[svc.id];
                const isVerifying = verifyMutation.isPending && verifyMutation.variables === svc.id;

                return (
                  <TR key={svc.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <Server className="size-4 text-brand shrink-0" />
                        <div>
                          <div className="font-semibold text-xs text-foreground">{svc.name}</div>
                          {svc.environment && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {svc.environment}
                            </span>
                          )}
                        </div>
                      </div>
                    </TD>
                    <TD className="text-xs font-mono text-muted-foreground max-w-xs truncate">
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
                      {svc.framework ? `${svc.framework}` : svc.language || "Custom"}
                    </TD>
                    <TD className="text-xs font-mono text-foreground">
                      <Link
                        href={`/app/organizations/${orgId}/projects/${projectId}/services/${svc.id}/endpoints`}
                        className="text-brand hover:underline"
                      >
                        {svc.endpointCount ?? 0} endpoints &rarr;
                      </Link>
                    </TD>
                    <TD>
                      {probe ? (
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          {probe.reachable ? (
                            <>
                              <CheckCircle2 className="size-3.5 text-emerald-500" />
                              <span className="text-emerald-400">{probe.latencyMs}ms</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="size-3.5 text-rose-500" />
                              <span className="text-rose-400 text-[11px] truncate max-w-[120px]">
                                {probe.error || "Unreachable"}
                              </span>
                            </>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isVerifying}
                          onClick={() => verifyMutation.mutate(svc.id)}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {isVerifying ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <>
                              <RefreshCw className="size-3 mr-1" /> Ping Probe
                            </>
                          )}
                        </Button>
                      )}
                    </TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() =>
                            router.push(
                              `/app/organizations/${orgId}/projects/${projectId}/services/${svc.id}/discovery`
                            )
                          }
                        >
                          <Compass className="size-3" />
                          <span>Discovery</span>
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() =>
                            router.push(
                              `/app/organizations/${orgId}/projects/${projectId}/services/${svc.id}`
                            )
                          }
                        >
                          <span>Explore</span>
                          <ArrowRight className="size-3" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
