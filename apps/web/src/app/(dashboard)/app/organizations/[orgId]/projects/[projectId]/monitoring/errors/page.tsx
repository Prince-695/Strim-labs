"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertOctagon,
  ArrowLeft,
  Server,
  Activity,
  Layers,
  Clock,
  ShieldAlert,
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
  params: Promise<{ orgId: string; projectId: string }>;
}

export default function ErrorBreakdownPage({ params }: PageProps) {
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

  // Query Errors for service
  const { data: errorsData, isLoading: errorsLoading, error, refetch } = useQuery({
    queryKey: ["service-errors", orgId, projectId, primaryServiceId],
    enabled: Boolean(primaryServiceId),
    queryFn: () =>
      fetchApi<{
        totalErrors: number;
        statusDistribution: Record<string, number>;
        topEndpoints: { path: string; method: string; count: number }[];
      }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/monitoring/services/${primaryServiceId}/errors`
      ),
  });

  // Query Request Logs
  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["service-requests", orgId, projectId, primaryServiceId],
    enabled: Boolean(primaryServiceId),
    queryFn: () =>
      fetchApi<{
        requests: {
          id: string;
          path: string;
          method: string;
          statusCode: number;
          durationMs: number;
          timestamp: string;
        }[];
      }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/monitoring/services/${primaryServiceId}/requests`
      ),
  });

  if (servicesLoading || errorsLoading || requestsLoading) {
    return <LoadingState message="Aggregating runtime errors and telemetry anomalies..." />;
  }

  const errorStats = errorsData || { totalErrors: 0, statusDistribution: {}, topEndpoints: [] };
  const requests = requestsData?.requests || [];

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
        title="Error Analysis &amp; Status Codes"
        description="HTTP 5xx server errors, gateway timeouts, and endpoint failure concentrations."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Total 5xx Errors</div>
          <div className="mt-1 font-mono text-2xl font-bold text-destructive">
            {errorStats.totalErrors}
          </div>
          <div className="text-[11px] text-muted-foreground">Recorded in active window</div>
        </div>

        {Object.entries(errorStats.statusDistribution).map(([code, count]) => (
          <div key={code} className="rounded-xl border border-border bg-card p-5">
            <div className="text-xs font-mono font-medium text-muted-foreground">HTTP {code}</div>
            <div className="mt-1 font-mono text-2xl font-bold text-foreground">
              {count}
            </div>
            <div className="text-[11px] text-muted-foreground">Responses dispatched</div>
          </div>
        ))}
      </div>

      {/* Top Failing Endpoints */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ShieldAlert className="size-4 text-destructive" />
          <span>Top Failing Endpoints</span>
        </h3>

        {errorStats.topEndpoints.length === 0 ? (
          <p className="text-xs text-muted-foreground">No failing routes detected. Error budget is intact.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Method</TH>
                <TH>Route Path</TH>
                <TH>Failure Count</TH>
              </TR>
            </THead>
            <TBody>
              {errorStats.topEndpoints.map((ep, idx) => (
                <TR key={idx}>
                  <TD>
                    <HttpMethodBadge method={ep.method} />
                  </TD>
                  <TD className="text-xs font-mono font-semibold text-foreground">{ep.path}</TD>
                  <TD className="text-xs font-mono text-destructive font-bold">{ep.count} errors</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {/* Recent Request Sample Logs */}
      {requests.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Recent Dispatched Request Samples</h3>
          <Table>
            <THead>
              <TR>
                <TH>Method</TH>
                <TH>Path</TH>
                <TH>Status Code</TH>
                <TH>Duration</TH>
                <TH>Timestamp</TH>
              </TR>
            </THead>
            <TBody>
              {requests.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <HttpMethodBadge method={r.method} />
                  </TD>
                  <TD className="text-xs font-mono text-foreground">{r.path}</TD>
                  <TD>
                    <Badge variant={r.statusCode >= 400 ? "destructive" : "default"} className="font-mono text-[10px]">
                      {r.statusCode}
                    </Badge>
                  </TD>
                  <TD className="text-xs font-mono text-muted-foreground">{r.durationMs.toFixed(1)} ms</TD>
                  <TD className="text-xs font-mono text-muted-foreground">
                    {new Date(r.timestamp).toLocaleTimeString()}
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
