"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Layers,
  ArrowLeft,
  Loader2,
  Sparkles,
  AlertCircle,
  Key,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

const createProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters").max(64),
  description: z.string().max(256).optional(),
});

type FormValues = z.infer<typeof createProjectSchema>;

export default function NewProjectPage({ params }: PageProps) {
  const { orgId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  // Check current project count
  const { data: projectsData } = useQuery({
    queryKey: queryKeys.projects.all(orgId),
    queryFn: () =>
      fetchApi<{ projects: Schemas["Project"][]; maxProjects: number }>(
        `/api/v1/organizations/${orgId}/projects`
      ),
  });

  const projectsList = Array.isArray(projectsData)
    ? projectsData
    : (projectsData && typeof projectsData === "object" && Array.isArray((projectsData as any).projects)
        ? (projectsData as any).projects
        : []);
  const projectsCount = projectsList.length;
  const isCapReached = projectsCount >= 5;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const res = await fetchApi<{ project: Schemas["Project"]; ingestKey: string }>(
        `/api/v1/organizations/${orgId}/projects`,
        {
          method: "POST",
          body: JSON.stringify({
            name: values.name.trim(),
            description: values.description?.trim() || undefined,
          }),
        }
      );

      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all(orgId) });
      router.push(`/app/organizations/${orgId}/projects/${res.project.id}/services/new`);
    } catch (err: any) {
      setServerError(err.message || "Failed to create project");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back</span>
        </Button>
      </div>

      <PageHeader
        title="Create New Project"
        description="Establish an isolated observability target for a service group or microservices architecture."
      />

      {isCapReached ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="size-4 shrink-0" />
            <span>Project Limit Reached (5 / 5)</span>
          </div>
          <p className="mt-1 text-xs text-rose-300/80">
            This organization has utilized all 5 allocated project slots. To create another project,
            archive or delete an unused project in organization settings.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-xl border border-border bg-card p-6">
          {serverError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Project Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Project Name *</label>
            <div className="relative">
              <Layers className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                {...register("name")}
                placeholder="Core Checkout API"
                className="pl-9 text-xs"
                autoFocus
              />
            </div>
            {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Description (Optional)</label>
            <Textarea
              {...register("description")}
              placeholder="Production billing and payments service mesh telemetry..."
              className="text-xs min-h-[80px]"
            />
            {errors.description && <p className="text-[11px] text-destructive">{errors.description.message}</p>}
          </div>

          <div className="rounded-lg border border-border bg-surface-muted/50 p-3.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Key className="size-4 text-brand" />
              <span>Automated Ingest Key Provisioning</span>
            </div>
            <p className="mt-1 text-[11px]">
              A unique <code className="font-mono text-brand">strim_live_...</code> ingest credential will be generated automatically
              to authenticate SDK spans, OpenTelemetry traces, and load-test metrics.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Creating Project...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  <span>Create Project</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
