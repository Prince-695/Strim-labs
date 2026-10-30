"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Layers,
  Key,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Loader2,
  Save,
  Check,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { CopyButton } from "@/components/data-display/copy-button";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string }>;
}

const updateProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters").max(64),
  description: z.string().max(256).optional(),
});

type FormValues = z.infer<typeof updateProjectSchema>;

export default function ProjectSettingsPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [rotateModalOpen, setRotateModalOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch Project
  const {
    data: project,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.projects.detail(orgId, projectId),
    queryFn: () =>
      fetchApi<{ project: Schemas["Project"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}`
      ).then((res) => res.project),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (project) {
      reset({
        name: project.name,
        description: project.description || "",
      });
    }
  }, [project, reset]);

  // Update Project Mutation
  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetchApi<{ project: Schemas["Project"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}`,
        {
          method: "PATCH",
          body: JSON.stringify(values),
        }
      );
      return res.project;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.projects.detail(orgId, projectId), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all(orgId) });
      reset({
        name: updated.name,
        description: updated.description || "",
      });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to update project");
    },
  });

  // Rotate Key Mutation
  const rotateKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchApi<{ ingestKey: string }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/rotate-key`,
        { method: "POST" }
      );
      return res.ingestKey;
    },
    onSuccess: (newKey) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(orgId, projectId) });
      setRotateModalOpen(false);
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to rotate ingest key");
    },
  });

  // Delete Project Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await fetchApi<{ ok: boolean }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all(orgId) });
      router.push(`/app/organizations/${orgId}/projects`);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to delete project");
    },
  });

  if (isLoading) return <LoadingState message="Loading project settings..." />;
  if (error || !project) {
    return (
      <ErrorState
        title="Failed to load project settings"
        description={(error as any)?.message || "Could not retrieve settings."}
        onRetry={refetch}
      />
    );
  }

  const onSubmit = (values: FormValues) => {
    setActionError(null);
    updateMutation.mutate(values);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Project Settings"
        description="Configure target metadata, telemetry ingestion secrets, and project lifecycle."
      />

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* General Settings */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 rounded-xl border border-border bg-card p-6"
      >
        <div className="border-b border-border pb-3">
          <h3 className="text-sm font-semibold text-foreground">Project Identity</h3>
          <p className="text-xs text-muted-foreground">General identification and description.</p>
        </div>

        {/* Project Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Project Name *</label>
          <div className="relative">
            <Layers className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input {...register("name")} className="pl-9 text-xs" />
          </div>
          {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Description</label>
          <Textarea {...register("description")} className="text-xs min-h-[80px]" />
          {errors.description && <p className="text-[11px] text-destructive">{errors.description.message}</p>}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            size="sm"
            disabled={!isDirty || isSubmitting || updateMutation.isPending}
            className="gap-1.5"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Telemetry Ingest Key Card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Key className="size-4 text-brand" />
            <span>Telemetry Ingestion Key</span>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Provide this secret in your STRIM Labs SDK initialization or OpenTelemetry collector exporter headers.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted p-2.5">
          <code className="flex-1 font-mono text-xs text-foreground select-all">
            {project.ingestKey || "No key configured"}
          </code>
          {project.ingestKey && <CopyButton text={project.ingestKey} />}
        </div>

        <div className="flex justify-end pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRotateModalOpen(true)}
            className="gap-1.5 text-xs text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
          >
            <RefreshCw className="size-3.5" />
            <span>Rotate Ingest Key</span>
          </Button>
        </div>
      </div>

      {/* Danger Zone Card */}
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="size-4" />
            <span>Danger Zone</span>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Permanently delete this project and all its services, endpoints, metrics, traces, and load test runs.
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              setConfirmName("");
              setDeleteModalOpen(true);
            }}
            className="gap-1.5"
          >
            <Trash2 className="size-3.5" />
            <span>Delete Project</span>
          </Button>
        </div>
      </div>

      {/* Rotate Key Confirmation Dialog */}
      <Dialog
        open={rotateModalOpen}
        onOpenChange={setRotateModalOpen}
        title="Rotate Telemetry Ingest Key"
        description="Rotating this key will immediately invalidate the current ingest key. Any SDKs or collector pipelines sending telemetry with the old key will be rejected."
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Are you sure you want to proceed? You must update your services with the new key immediately after rotation.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRotateModalOpen(false)}
              disabled={rotateKeyMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={rotateKeyMutation.isPending}
              onClick={() => rotateKeyMutation.mutate()}
              className="gap-1.5"
            >
              {rotateKeyMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Rotating...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="size-3.5" />
                  <span>Confirm Rotation</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Project"
        description={`This action will permanently delete "${project.name}" and all associated data.`}
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Please type <span className="font-mono font-bold text-foreground">{project.name}</span> to confirm:
          </p>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={project.name}
            className="text-xs"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={confirmName !== project.name || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              className="gap-1.5"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  <span>Confirm Delete</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
