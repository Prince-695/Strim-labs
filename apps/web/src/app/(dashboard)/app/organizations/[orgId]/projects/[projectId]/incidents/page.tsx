"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Shield,
  Layers,
  ArrowRight,
  Filter,
  Check,
  Eye,
  AlertTriangle,
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

export default function IncidentsPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "ACKNOWLEDGED" | "RESOLVED">("ALL");

  const { data: incidentsData, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.alerts.incidents(orgId, projectId),
    queryFn: () =>
      fetchApi<{ incidents: Schemas["Incident"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/alerts/incidents`
      ).then((res) => res.incidents),
    refetchInterval: 15000,
  });

  // Acknowledge Mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (incidentId: string) => {
      await fetchApi<{ ok: boolean }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/alerts/incidents/${incidentId}/acknowledge`,
        { method: "POST" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.incidents(orgId, projectId) });
    },
  });

  // Resolve Mutation
  const resolveMutation = useMutation({
    mutationFn: async (incidentId: string) => {
      await fetchApi<{ ok: boolean }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/alerts/incidents/${incidentId}/resolve`,
        { method: "POST" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.incidents(orgId, projectId) });
    },
  });

  if (isLoading) return <LoadingState message="Checking active incidents & anomaly alarms..." />;

  if (error) {
    return (
      <ErrorState
        title="Failed to load incidents"
        description={(error as any)?.message || "Could not retrieve incidents log."}
        onRetry={refetch}
      />
    );
  }

  const incidents = incidentsData || [];
  const filtered = statusFilter === "ALL" ? incidents : incidents.filter((i) => i.status === statusFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active Incidents"
        description="Real-time incident response triage, automated rule triggerings, and MTTR resolution tracking."
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-3">
        {(["ALL", "OPEN", "ACKNOWLEDGED", "RESOLVED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-mono font-medium transition-colors ${
              statusFilter === s
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All systems operational"
          description="No incidents currently triggered for this application project."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Incident Title</TH>
                <TH>Severity</TH>
                <TH>Status</TH>
                <TH>Opened At</TH>
                <TH>Acknowledged</TH>
                <TH>Resolved</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((inc) => (
                <TR key={inc.id}>
                  <TD>
                    <div className="font-semibold text-xs text-foreground">{inc.title}</div>
                    {inc.description && (
                      <p className="text-[11px] text-muted-foreground truncate max-w-xs">
                        {inc.description}
                      </p>
                    )}
                  </TD>
                  <TD>
                    <Badge
                      variant={
                        inc.severity === "CRITICAL"
                          ? "destructive"
                          : inc.severity === "WARNING"
                          ? "secondary"
                          : "outline"
                      }
                      className="font-mono text-[10px]"
                    >
                      {inc.severity}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge
                      variant={
                        inc.status === "OPEN"
                          ? "destructive"
                          : inc.status === "ACKNOWLEDGED"
                          ? "secondary"
                          : "default"
                      }
                      className="font-mono text-[10px]"
                    >
                      {inc.status}
                    </Badge>
                  </TD>
                  <TD className="text-xs font-mono text-muted-foreground">
                    {new Date(inc.openedAt).toLocaleTimeString()}
                  </TD>
                  <TD className="text-xs font-mono text-muted-foreground">
                    {inc.acknowledgedAt ? new Date(inc.acknowledgedAt).toLocaleTimeString() : "—"}
                  </TD>
                  <TD className="text-xs font-mono text-muted-foreground">
                    {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleTimeString() : "—"}
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {inc.status === "OPEN" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeMutation.mutate(inc.id)}
                          disabled={acknowledgeMutation.isPending}
                          className="h-7 text-xs"
                        >
                          <Eye className="size-3 mr-1" /> Ack
                        </Button>
                      )}
                      {inc.status !== "RESOLVED" && (
                        <Button
                          size="sm"
                          onClick={() => resolveMutation.mutate(inc.id)}
                          disabled={resolveMutation.isPending}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check className="size-3 mr-1" /> Resolve
                        </Button>
                      )}
                    </div>
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
