"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  Plus,
  Play,
  Square,
  Copy,
  ArrowRight,
  Clock,
  Activity,
  AlertOctagon,
  TrendingUp,
  Target,
  Loader2,
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

export default function LoadTestsListPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.loadTests.all(orgId, projectId),
    queryFn: () =>
      fetchApi<{ runs: Schemas["TestRun"][]; total: number }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/load-tests`
      ),
    refetchInterval: (query) => {
      // Poll faster if any tests are running
      const hasRunning = query.state.data?.runs?.some((r) => r.status === "RUNNING" || r.status === "QUEUED");
      return hasRunning ? 3000 : 15000;
    },
  });

  // Start Run Mutation
  const startMutation = useMutation({
    mutationFn: async (testId: string) => {
      return fetchApi<{ testRun: Schemas["TestRun"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/start`,
        { method: "POST" }
      );
    },
    onSuccess: (_, testId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loadTests.all(orgId, projectId) });
      router.push(`/app/organizations/${orgId}/projects/${projectId}/load-tests/${testId}`);
    },
  });

  // Cancel Run Mutation
  const cancelMutation = useMutation({
    mutationFn: async (testId: string) => {
      return fetchApi<{ ok: boolean }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/cancel`,
        { method: "POST" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loadTests.all(orgId, projectId) });
    },
  });

  // Clone Run Mutation
  const cloneMutation = useMutation({
    mutationFn: async (testId: string) => {
      return fetchApi<{ testRun: Schemas["TestRun"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/clone`,
        { method: "POST" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loadTests.all(orgId, projectId) });
    },
  });

  if (isLoading) return <LoadingState message="Loading capacity benchmarks & load test runs..." />;

  if (error || !data) {
    return (
      <ErrorState
        title="Failed to load load tests"
        description={(error as any)?.message || "Could not retrieve test catalog."}
        onRetry={refetch}
      />
    );
  }

  const runs = data.runs || [];
  const filtered = statusFilter === "ALL" ? runs : runs.filter((r) => r.status === statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="default" className="font-mono text-[10px]">COMPLETED</Badge>;
      case "RUNNING":
        return <Badge className="bg-amber-500 font-mono text-[10px] animate-pulse">RUNNING</Badge>;
      case "QUEUED":
        return <Badge variant="secondary" className="font-mono text-[10px]">QUEUED</Badge>;
      case "FAILED":
      case "ABORTED":
        return <Badge variant="destructive" className="font-mono text-[10px]">{status}</Badge>;
      default:
        return <Badge variant="secondary" className="font-mono text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Load Testing &amp; Capacity Engine"
        description="Distributed breaking point hunts, ramp-up benchmarks, and automated saturation knee detection."
        action={
          <Button
            size="sm"
            onClick={() => router.push(`/app/organizations/${orgId}/projects/${projectId}/load-tests/new`)}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            <span>New Load Test</span>
          </Button>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-3">
        {(["ALL", "COMPLETED", "RUNNING", "QUEUED", "ABORTED"] as const).map((s) => (
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
          icon={Zap}
          title="No load test runs found"
          description="Configure and launch a multi-stage load test to identify your microservice breaking point before production incidents occur."
          action={{
            label: "Create First Load Test",
            onClick: () => router.push(`/app/organizations/${orgId}/projects/${projectId}/load-tests/new`),
          }}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Test Run</TH>
                <TH>Profile</TH>
                <TH>Status</TH>
                <TH>Throughput (Avg RPS)</TH>
                <TH>p95 Latency</TH>
                <TH>Error Rate</TH>
                <TH>Duration / VUs</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((run) => (
                <TR key={run.id}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <HttpMethodBadge method={run.method} />
                      <div>
                        <div className="font-semibold text-xs text-foreground">{run.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">
                          {run.targetUrl}
                        </div>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {run.profile}
                    </Badge>
                  </TD>
                  <TD>{getStatusBadge(run.status)}</TD>
                  <TD className="text-xs font-mono font-semibold text-foreground">
                    {run.avgRps ? `${run.avgRps.toFixed(1)} req/s` : "—"}
                  </TD>
                  <TD className="text-xs font-mono text-foreground">
                    {run.p95Ms ? `${run.p95Ms.toFixed(1)} ms` : "—"}
                  </TD>
                  <TD className="text-xs font-mono">
                    {run.errorRate !== undefined && run.errorRate !== null ? (
                      <span className={run.errorRate > 0.01 ? "text-destructive font-bold" : "text-muted-foreground"}>
                        {(run.errorRate * 100).toFixed(2)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-xs font-mono text-muted-foreground">
                    {run.durationSec}s @ {run.concurrency} VUs
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {run.status === "QUEUED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={startMutation.isPending}
                          onClick={() => startMutation.mutate(run.id)}
                          className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <Play className="size-3 mr-1" /> Start
                        </Button>
                      )}
                      {run.status === "RUNNING" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(run.id)}
                          className="h-7 text-xs text-rose-400 hover:bg-rose-500/10"
                        >
                          <Square className="size-3 mr-1" /> Abort
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cloneMutation.mutate(run.id)}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="size-3 mr-1" /> Clone
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() =>
                          router.push(
                            `/app/organizations/${orgId}/projects/${projectId}/load-tests/${run.id}`
                          )
                        }
                      >
                        <span>Console</span>
                        <ArrowRight className="size-3" />
                      </Button>
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
