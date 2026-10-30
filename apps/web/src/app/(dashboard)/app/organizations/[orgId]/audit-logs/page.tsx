"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Filter,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  Terminal,
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
  params: Promise<{ orgId: string }>;
}

export default function OrganizationAuditLogsPage({ params }: PageProps) {
  const { orgId } = use(params);

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [selectedResource, setSelectedResource] = useState<string>("");

  const queryParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (selectedAction) queryParams.set("action", selectedAction);
  if (selectedResource) queryParams.set("resourceType", selectedResource);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...queryKeys.organizations.auditLogs(orgId), page, selectedAction, selectedResource],
    queryFn: () =>
      fetchApi<{ logs: Schemas["AuditLog"][]; total: number }>(
        `/api/v1/organizations/${orgId}/audit-logs?${queryParams.toString()}`
      ),
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("DELETE") || action.includes("REVOKE")) return "destructive";
    if (action.includes("CREATE") || action.includes("INVITE")) return "default";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Tamper-evident record of security events, administrative operations, and membership mutations."
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Filter by action (e.g. CREATE, DELETE)..."
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPage(1);
            }}
            className="w-56 text-xs"
          />
          <Input
            placeholder="Filter by resource type..."
            value={selectedResource}
            onChange={(e) => {
              setSelectedResource(e.target.value);
              setPage(1);
            }}
            className="w-48 text-xs"
          />
          {(selectedAction || selectedResource) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedAction("");
                setSelectedResource("");
                setPage(1);
              }}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear Filters
            </Button>
          )}
        </div>

        <div className="text-xs font-mono text-muted-foreground">
          Showing {logs.length} of {total} events
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading security audit trail..." />
      ) : error ? (
        <ErrorState
          title="Failed to load audit logs"
          description={(error as any)?.message || "Could not retrieve audit records."}
          onRetry={refetch}
        />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No audit log events found"
          description="Security and configuration operations performed in this workspace will be automatically recorded here."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Timestamp</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Resource</TH>
                <TH>IP Address</TH>
                <TH>Metadata</TH>
              </TR>
            </THead>
            <TBody>
              {logs.map((log) => (
                <TR key={log.id}>
                  <TD className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </TD>
                  <TD className="text-xs font-medium text-foreground">
                    {log.userName || (log.userId ? log.userId.slice(0, 10) : "System")}
                  </TD>
                  <TD>
                    <Badge variant={getActionBadgeVariant(log.action)} className="font-mono text-[10px]">
                      {log.action}
                    </Badge>
                  </TD>
                  <TD className="text-xs font-mono text-foreground">
                    <span className="text-muted-foreground">{log.resourceType}: </span>
                    <span>{log.resourceId || "N/A"}</span>
                  </TD>
                  <TD className="text-xs font-mono text-muted-foreground">
                    {log.ipAddress || "—"}
                  </TD>
                  <TD className="text-xs font-mono text-muted-foreground max-w-xs truncate">
                    {log.metadata ? JSON.stringify(log.metadata) : "—"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between border-t border-border p-3">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
