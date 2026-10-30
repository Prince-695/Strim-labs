"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BarChart3,
  Plus,
  ArrowLeft,
  Trash2,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string; dashboardId: string }>;
}

const createPanelSchema = z.object({
  title: z.string().min(2, "Title is required").max(64),
  type: z.enum(["TIMESERIES", "STAT", "TABLE", "BAR_CHART", "GAUGE"]),
  metric: z.string(),
});

type PanelForm = z.infer<typeof createPanelSchema>;

export default function DashboardDetailPage({ params }: PageProps) {
  const { orgId, projectId, dashboardId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [addPanelOpen, setAddPanelOpen] = useState(false);

  // Fetch Dashboard Detail
  const {
    data: dashboard,
    isLoading: dashLoading,
    error: dashError,
  } = useQuery({
    queryKey: queryKeys.dashboards.detail(orgId, projectId, dashboardId),
    queryFn: () =>
      fetchApi<{ dashboard: Schemas["Dashboard"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/dashboards/${dashboardId}`
      ).then((res) => res.dashboard),
  });

  // Fetch Panels
  const {
    data: panelsData,
    isLoading: panelsLoading,
    refetch: refetchPanels,
  } = useQuery({
    queryKey: queryKeys.dashboards.panels(orgId, projectId, dashboardId),
    queryFn: () =>
      fetchApi<{ panels: Schemas["Panel"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/dashboards/${dashboardId}/panels`
      ).then((res) => res.panels),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isSubmitting: isAdding },
  } = useForm<PanelForm>({
    resolver: zodResolver(createPanelSchema),
    defaultValues: {
      title: "",
      type: "TIMESERIES",
      metric: "rps",
    },
  });

  // Add Panel Mutation
  const addPanelMutation = useMutation({
    mutationFn: async (values: PanelForm) => {
      return fetchApi<{ panel: Schemas["Panel"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/dashboards/${dashboardId}/panels`,
        {
          method: "POST",
          body: JSON.stringify({
            title: values.title.trim(),
            type: values.type,
            metric: values.metric,
            position: { x: 0, y: 0, w: 6, h: 4 },
          }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboards.panels(orgId, projectId, dashboardId),
      });
      setAddPanelOpen(false);
      reset();
    },
  });

  // Delete Panel Mutation
  const deletePanelMutation = useMutation({
    mutationFn: async (panelId: string) => {
      await fetchApi<{ ok: boolean }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/dashboards/${dashboardId}/panels/${panelId}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboards.panels(orgId, projectId, dashboardId),
      });
    },
  });

  if (dashLoading || panelsLoading) {
    return <LoadingState message="Loading dashboard panels..." />;
  }

  if (dashError || !dashboard) {
    return (
      <ErrorState
        title="Dashboard not found"
        description="The requested dashboard view does not exist."
        onRetry={() => router.push(`/app/organizations/${orgId}/projects/${projectId}/dashboards`)}
      />
    );
  }

  const panels = panelsData || [];

  // Mock points for timeseries panels
  const samplePoints = Array.from({ length: 10 }, (_, i) => ({
    time: `${i * 5}m`,
    value: Math.round(120 + Math.sin(i) * 35),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            router.push(`/app/organizations/${orgId}/projects/${projectId}/dashboards`)
          }
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>All Dashboards</span>
        </Button>
      </div>

      <PageHeader
        title={dashboard.name}
        description={dashboard.description || "Custom project metrics view"}
        action={
          <Button size="sm" onClick={() => setAddPanelOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            <span>Add Panel</span>
          </Button>
        }
      />

      {panels.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No metric panels in this dashboard"
          description="Add timeseries charts or single-stat gauges to visualize your application telemetry."
          action={{
            label: "Add First Panel",
            onClick: () => setAddPanelOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {panels.map((panel) => (
            <div
              key={panel.id}
              className="rounded-xl border border-border bg-card p-5 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-brand" />
                  <span className="text-xs font-semibold text-foreground">{panel.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {panel.type}
                  </Badge>
                  <button
                    onClick={() => deletePanelMutation.mutate(panel.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {panel.type === "STAT" ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <span className="font-mono text-3xl font-bold text-foreground">142.5</span>
                  <span className="font-mono text-xs text-muted-foreground mt-1">requests / sec</span>
                </div>
              ) : (
                <div className="h-44 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={samplePoints}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="time" stroke="#71717a" fontSize={10} />
                      <YAxis stroke="#71717a" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #27272a",
                          borderRadius: "8px",
                          fontSize: "11px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Panel Dialog */}
      <Dialog
        open={addPanelOpen}
        onOpenChange={setAddPanelOpen}
        title="Add Metric Panel"
        description="Select visualization style and query target."
      >
        <form
          onSubmit={handleSubmit((values) => addPanelMutation.mutate(values))}
          className="space-y-4 py-2"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Panel Title *</label>
            <Input
              {...register("title")}
              placeholder="e.g. Ingestion Throughput"
              className="text-xs"
              autoFocus
            />
            {formErrors.title && (
              <p className="text-[11px] text-destructive">{formErrors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Visualization Type</label>
            <select
              {...register("type")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none font-mono"
            >
              <option value="TIMESERIES">Time-Series Area Chart</option>
              <option value="SINGLE_STAT">Single Stat Counter</option>
              <option value="BAR">Bar Breakdown</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Telemetry Metric Target</label>
            <select
              {...register("metric")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none font-mono"
            >
              <option value="rps">Requests per second (RPS)</option>
              <option value="latency_p95">p95 Latency (ms)</option>
              <option value="errors">Error Rate (%)</option>
              <option value="cpu">CPU Saturation (%)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setAddPanelOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isAdding || addPanelMutation.isPending} className="gap-1.5">
              {addPanelMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              <span>Add Panel</span>
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
