"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BarChart3,
  Plus,
  Trash2,
  ArrowRight,
  Layers,
  Sparkles,
  Loader2,
  AlertCircle,
  Copy,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string }>;
}

const createDashboardSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(64),
  description: z.string().max(256).optional(),
});

type FormValues = z.infer<typeof createDashboardSchema>;

export default function DashboardsListPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: dashboardsData, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.dashboards.all(orgId, projectId),
    queryFn: () =>
      fetchApi<{ dashboards: Schemas["Dashboard"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/dashboards`
      ).then((res) => res.dashboards),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createDashboardSchema),
    defaultValues: { name: "", description: "" },
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetchApi<{ dashboard: Schemas["Dashboard"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/dashboards`,
        {
          method: "POST",
          body: JSON.stringify(values),
        }
      );
      return res.dashboard;
    },
    onSuccess: (newDash) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all(orgId, projectId) });
      setCreateModalOpen(false);
      reset();
      router.push(`/app/organizations/${orgId}/projects/${projectId}/dashboards/${newDash.id}`);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to create dashboard");
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (dashboardId: string) => {
      await fetchApi<{ ok: boolean }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/dashboards/${dashboardId}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all(orgId, projectId) });
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to delete dashboard");
    },
  });

  if (isLoading) return <LoadingState message="Loading telemetry dashboards..." />;

  if (error) {
    return (
      <ErrorState
        title="Failed to load dashboards"
        description={(error as any)?.message || "Could not retrieve dashboards catalog."}
        onRetry={refetch}
      />
    );
  }

  const dashboards = dashboardsData || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Dashboards"
        description="Curate tailored visual dashboards, telemetry charts, and saturation gauges."
        action={
          <Button
            size="sm"
            onClick={() => {
              setActionError(null);
              setCreateModalOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            <span>New Dashboard</span>
          </Button>
        }
      />

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {dashboards.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No custom dashboards created"
          description="Build custom dashboard views with tailored metric panels for your team."
          action={{
            label: "Create First Dashboard",
            onClick: () => setCreateModalOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((dash) => (
            <div
              key={dash.id}
              className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all hover:border-brand/50 hover:shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
                      {dash.name}
                    </h3>
                    {dash.isDefault && (
                      <Badge variant="secondary" className="mt-1 font-mono text-[10px]">
                        DEFAULT VIEW
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(dash.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {dash.description && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {dash.description}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground border-t border-border/60 pt-3">
                  <BarChart3 className="size-3.5 text-brand" />
                  <span>{dash.panelCount ?? 0} visual panels</span>
                </div>
              </div>

              <div className="mt-5 border-t border-border/60 pt-3 flex items-center justify-end">
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() =>
                    router.push(
                      `/app/organizations/${orgId}/projects/${projectId}/dashboards/${dash.id}`
                    )
                  }
                >
                  <span>Open Dashboard</span>
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dashboard Dialog */}
      <Dialog
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Create Custom Dashboard"
        description="Name your dashboard view and configure custom panels."
      >
        <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Dashboard Name *</label>
            <Input
              {...register("name")}
              placeholder="e.g. SRE Core Capacity & Latency"
              className="text-xs"
              autoFocus
            />
            {formErrors.name && (
              <p className="text-[11px] text-destructive">{formErrors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Description (Optional)</label>
            <Textarea
              {...register("description")}
              placeholder="High-level telemetry metrics for checkout and payments gateway..."
              className="text-xs min-h-[70px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || createMutation.isPending}
              className="gap-1.5"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  <span>Create Dashboard</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
