"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Target,
  Play,
  ArrowRight,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Activity,
  Server,
  Zap,
  Loader2,
  Sparkles,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string }>;
}

export default function DiagnosticsPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"probes" | "bottlenecks" | "regressions">("probes");
  const [probeModalOpen, setProbeModalOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState("https://httpbin.org/get");
  const [probeType, setProbeType] = useState<"SMOKE" | "LATENCY" | "SATURATION">("LATENCY");
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch Services to resolve primary service
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: queryKeys.services.all(orgId, projectId),
    queryFn: () =>
      fetchApi<{ services: Schemas["Service"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services`
      ).then((res) => res.services),
  });

  const services = servicesData || [];
  const primaryServiceId = services[0]?.id;

  // Fetch Diagnostic Runs
  const { data: diagnosticsData, isLoading: diagnosticsLoading, refetch: refetchDiagnostics } = useQuery({
    queryKey: ["diagnostics", orgId, projectId],
    queryFn: () =>
      fetchApi<Schemas["Diagnostic"][]>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/diagnostics`
      ),
  });

  // Fetch Bottlenecks
  const { data: bottlenecksData } = useQuery({
    queryKey: ["bottlenecks", orgId, projectId, primaryServiceId],
    enabled: Boolean(primaryServiceId),
    queryFn: () =>
      fetchApi<Schemas["Bottleneck"][]>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/diagnostics/services/${primaryServiceId}/bottlenecks`
      ).catch(() => []),
  });

  // Fetch Regressions
  const { data: regressionsData } = useQuery({
    queryKey: ["regressions", orgId, projectId, primaryServiceId],
    enabled: Boolean(primaryServiceId),
    queryFn: () =>
      fetchApi<Schemas["Regression"][]>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/diagnostics/services/${primaryServiceId}/regressions`
      ).catch(() => []),
  });

  // Trigger Diagnostic Mutation
  const runProbeMutation = useMutation({
    mutationFn: async () => {
      return fetchApi<Schemas["Diagnostic"]>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/diagnostics`,
        {
          method: "POST",
          body: JSON.stringify({
            targetUrl,
            type: probeType,
          }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diagnostics", orgId, projectId] });
      setProbeModalOpen(false);
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to execute diagnostic probe");
    },
  });

  if (servicesLoading || diagnosticsLoading) {
    return <LoadingState message="Analyzing performance regression models..." />;
  }

  const diagnostics = diagnosticsData || [];
  const bottlenecks = bottlenecksData || [];
  const regressions = regressionsData || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnostics &amp; Regression Engine"
        description="Automated bottleneck identification, latency regression tracking, and baseline comparison."
        action={
          <Button
            size="sm"
            onClick={() => {
              setActionError(null);
              setProbeModalOpen(true);
            }}
            className="gap-1.5"
          >
            <Play className="size-4" />
            <span>Run Diagnostic Probe</span>
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("probes")}
          className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
            activeTab === "probes"
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Diagnostic Probes ({diagnostics.length})
        </button>
        <button
          onClick={() => setActiveTab("bottlenecks")}
          className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
            activeTab === "bottlenecks"
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Detected Bottlenecks ({bottlenecks.length})
        </button>
        <button
          onClick={() => setActiveTab("regressions")}
          className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
            activeTab === "regressions"
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Performance Regressions ({regressions.length})
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Probes Tab */}
      {activeTab === "probes" && (
        <>
          {diagnostics.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No diagnostic probes executed"
              description="Run a diagnostic probe to measure single-thread latency, TLS overhead, and throughput headroom."
              action={{
                label: "Run Diagnostic",
                onClick: () => setProbeModalOpen(true),
              }}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <THead>
                  <TR>
                    <TH>Type</TH>
                    <TH>Target Endpoint</TH>
                    <TH>Latency</TH>
                    <TH>Status Code</TH>
                    <TH>Result</TH>
                    <TH>Executed At</TH>
                  </TR>
                </THead>
                <TBody>
                  {diagnostics.map((diag) => (
                    <TR key={diag.id}>
                      <TD>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {diag.type}
                        </Badge>
                      </TD>
                      <TD className="text-xs font-mono text-foreground">{diag.targetUrl}</TD>
                      <TD className="text-xs font-mono font-bold text-brand">
                        {typeof diag.result?.latencyMs === "number" ? `${(diag.result.latencyMs as number).toFixed(1)} ms` : "—"}
                      </TD>
                      <TD className="text-xs font-mono text-muted-foreground">
                        {diag.result?.statusCode ? `HTTP ${diag.result.statusCode}` : "—"}
                      </TD>
                      <TD>
                        <Badge
                          tone={diag.status === "COMPLETED" ? "success" : diag.status === "FAILED" ? "danger" : "neutral"}
                          className="font-mono text-[10px]"
                        >
                          {diag.status}
                        </Badge>
                      </TD>
                      <TD className="text-xs font-mono text-muted-foreground">
                        {new Date(diag.createdAt).toLocaleTimeString()}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Bottlenecks Tab */}
      {activeTab === "bottlenecks" && (
        <>
          {bottlenecks.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No architectural bottlenecks detected"
              description="All endpoints are operating within normal latency envelopes without severe thread saturation."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {bottlenecks.map((b, idx) => (
                <div key={b.endpoint || idx} className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-foreground">{b.endpoint || "Global Service"}</span>
                    <Badge
                      variant={b.severity === "CRITICAL" ? "destructive" : "secondary"}
                      className="font-mono text-[10px]"
                    >
                      {b.severity} SEVERITY
                    </Badge>
                  </div>
                  <div className="font-mono text-xs text-amber-400 font-medium">
                    Type: {b.type}
                  </div>
                  <p className="text-xs text-muted-foreground">{b.description}</p>
                  <div className="rounded-lg bg-surface-muted/50 p-3 text-xs text-muted-foreground border border-border/50">
                    <span className="font-semibold text-foreground">Detected: </span>
                    {new Date(b.detectedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Regressions Tab */}
      {activeTab === "regressions" && (
        <>
          {regressions.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No performance regressions observed"
              description="Candidate releases are matching or exceeding historical p95 latency baselines."
            />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <THead>
                  <TR>
                    <TH>Endpoint</TH>
                    <TH>Baseline p95</TH>
                    <TH>Current p95</TH>
                    <TH>Degradation</TH>
                    <TH>Severity</TH>
                    <TH>Detected</TH>
                  </TR>
                </THead>
                <TBody>
                  {regressions.map((reg, idx) => (
                    <TR key={`${reg.endpoint}-${idx}`}>
                      <TD className="text-xs font-mono font-semibold text-foreground">{reg.endpoint}</TD>
                      <TD className="text-xs font-mono text-muted-foreground">{reg.baselineValue} ms</TD>
                      <TD className="text-xs font-mono font-bold text-destructive">{reg.currentValue} ms</TD>
                      <TD className="text-xs font-mono text-destructive">
                        +{reg.deltaPct.toFixed(1)}%
                      </TD>
                      <TD>
                        <Badge
                          variant={reg.severity === "CRITICAL" ? "destructive" : "secondary"}
                          className="font-mono text-[10px]"
                        >
                          {reg.severity}
                        </Badge>
                      </TD>
                      <TD className="text-xs font-mono text-muted-foreground">
                        {new Date(reg.detectedAt).toLocaleDateString()}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Run Diagnostic Probe Modal */}
      <Dialog
        open={probeModalOpen}
        onOpenChange={setProbeModalOpen}
        title="Execute Diagnostic Probe"
        description="Dispatch synchronous HTTP probes to measure latency headroom and TLS handshakes."
      >
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Probe Target URL *</label>
            <Input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://api.yourdomain.com/health"
              className="text-xs font-mono"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Probe Type</label>
            <select
              value={probeType}
              onChange={(e) => setProbeType(e.target.value as any)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground font-mono outline-none"
            >
              <option value="LATENCY">Latency &amp; TLS Profile (Single thread)</option>
              <option value="SMOKE">Smoke Verification (Connectivity check)</option>
              <option value="SATURATION">Saturation Probe (Burst test)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setProbeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={runProbeMutation.isPending}
              onClick={() => runProbeMutation.mutate()}
              className="gap-1.5"
            >
              {runProbeMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              <span>Run Probe</span>
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
