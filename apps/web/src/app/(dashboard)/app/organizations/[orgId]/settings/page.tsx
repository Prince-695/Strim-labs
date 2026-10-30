"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building, Globe, AlignLeft, Trash2, AlertTriangle, Loader2, Save } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

const updateOrgSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(64),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  description: z.string().max(256).optional(),
});

type FormValues = z.infer<typeof updateOrgSchema>;

export default function OrganizationSettingsPage({ params }: PageProps) {
  const { orgId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgs, setOrgs, switchOrg } = useAuth();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: org,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.organizations.detail(orgId),
    queryFn: () =>
      fetchApi<{ organization: Schemas["Organization"] }>(`/api/v1/organizations/${orgId}`).then(
        (res) => res.organization
      ),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(updateOrgSchema),
    defaultValues: {
      name: "",
      website: "",
      description: "",
    },
  });

  useEffect(() => {
    if (org) {
      reset({
        name: org.name,
        website: org.website || "",
        description: org.description || "",
      });
    }
  }, [org, reset]);

  // Update Org Mutation
  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: { name: string; website?: string; description?: string } = {
        name: values.name.trim(),
      };
      if (values.website?.trim()) payload.website = values.website.trim();
      if (values.description?.trim()) payload.description = values.description.trim();

      const res = await fetchApi<{ organization: Schemas["Organization"] }>(
        `/api/v1/organizations/${orgId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );
      return res.organization;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.organizations.detail(orgId), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all() });
      setOrgs(orgs.map((o) => (o.id === orgId ? updated : o)));
      reset({
        name: updated.name,
        website: updated.website || "",
        description: updated.description || "",
      });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to update organization");
    },
  });

  // Delete Org Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await fetchApi<{ ok: boolean }>(`/api/v1/organizations/${orgId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      const remaining = orgs.filter((o) => o.id !== orgId);
      setOrgs(remaining);
      if (remaining.length > 0 && remaining[0]) {
        switchOrg(remaining[0].id);
        router.push(`/app/organizations/${remaining[0].id}`);
      } else {
        router.push("/app/organizations");
      }
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to delete organization");
    },
  });

  if (isLoading) return <LoadingState message="Loading organization settings..." />;
  if (error || !org) {
    return (
      <ErrorState
        title="Failed to load organization settings"
        description={(error as any)?.message || "Could not retrieve settings for this workspace."}
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
        title="Organization Settings"
        description="Configure workspace identity, regional compliance, and lifecycle administration."
      />

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* General Settings Card */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 rounded-xl border border-border bg-card p-6"
      >
        <div className="border-b border-border pb-3">
          <h3 className="text-sm font-semibold text-foreground">Workspace Profile</h3>
          <p className="text-xs text-muted-foreground">General identification and public URLs.</p>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Organization Name *</label>
          <div className="relative">
            <Building className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input {...register("name")} className="pl-9 text-xs" />
          </div>
          {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
        </div>

        {/* Slug (Read-only) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Workspace Slug (Immutable)</label>
          <Input value={org.slug} disabled className="text-xs font-mono bg-surface-muted/50" />
          <p className="text-[11px] text-muted-foreground">Used as the unique routing key for this organization.</p>
        </div>

        {/* Website */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Website</label>
          <div className="relative">
            <Globe className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input {...register("website")} placeholder="https://example.com" className="pl-9 text-xs" />
          </div>
          {errors.website && <p className="text-[11px] text-destructive">{errors.website.message}</p>}
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

      {/* Danger Zone Card */}
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="size-4" />
            <span>Danger Zone</span>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Permanently delete this organization, including all projects, services, metrics, traces,
            incidents, and load test artifacts. This action cannot be reversed.
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              setConfirmSlug("");
              setDeleteModalOpen(true);
            }}
            className="gap-1.5"
          >
            <Trash2 className="size-3.5" />
            <span>Delete Organization</span>
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Organization"
        description={`This action will permanently delete ${org.name} and cannot be undone.`}
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Please type <span className="font-mono font-bold text-foreground">{org.slug}</span> to confirm:
          </p>
          <Input
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)}
            placeholder={org.slug}
            className="font-mono text-xs"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={confirmSlug !== org.slug || deleteMutation.isPending}
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
