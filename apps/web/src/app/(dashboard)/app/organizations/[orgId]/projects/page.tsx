"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Layers,
  Plus,
  ArrowRight,
  Server,
  Activity,
  Zap,
  Key,
  Shield,
  Clock,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { CopyButton } from "@/components/data-display/copy-button";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default function ProjectsListPage({ params }: PageProps) {
  const { orgId } = use(params);
  const router = useRouter();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.projects.all(orgId),
    queryFn: () =>
      fetchApi<{ projects: Schemas["Project"][]; maxProjects: number }>(
        `/api/v1/organizations/${orgId}/projects`
      ),
  });

  if (isLoading) return <LoadingState message="Loading projects..." />;

  if (error || !data) {
    return (
      <ErrorState
        title="Failed to load projects"
        description={(error as any)?.message || "Could not retrieve project catalog."}
        onRetry={refetch}
      />
    );
  }

  const projects: Schemas["Project"][] = Array.isArray(data)
    ? (data as Schemas["Project"][])
    : (data && typeof data === "object" && Array.isArray((data as any).projects)
        ? (data as any).projects
        : []);
  const maxProjects = (data && typeof data === "object" && "maxProjects" in (data as any) && (data as any).maxProjects) ? (data as any).maxProjects : 5;
  const isCapReached = projects.length >= maxProjects;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Target applications, microservices environments, and distributed load generator configurations."
        action={
          <Button
            size="sm"
            disabled={isCapReached}
            onClick={() => router.push(`/app/organizations/${orgId}/projects/new`)}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            <span>New Project</span>
          </Button>
        }
      />

      {/* Quota Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Layers className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Project Quota</div>
            <div className="text-xs text-muted-foreground">
              Organizations are allocated up to {maxProjects} isolated application projects.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono font-medium text-muted-foreground">
            {projects.length} / {maxProjects} projects active
          </div>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full transition-all duration-300 ${isCapReached ? "bg-amber-500" : "bg-brand"}`}
              style={{ width: `${Math.min(100, (projects.length / maxProjects) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No projects created yet"
          description="Create your first project to connect backend services, ingest OpenTelemetry traces, and run breaking point benchmarks."
          action={{
            label: "Create Project",
            onClick: () => router.push(`/app/organizations/${orgId}/projects/new`),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all hover:border-brand/50 hover:shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
                      {proj.name}
                    </h3>
                    <p className="font-mono text-[11px] text-muted-foreground">{proj.id}</p>
                  </div>
                  <Badge
                    variant={proj.status === "ACTIVE" ? "default" : "secondary"}
                    className="font-mono text-[10px]"
                  >
                    {proj.status}
                  </Badge>
                </div>

                {proj.description && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {proj.description}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Server className="size-3.5 text-brand" />
                    <span>{proj.serviceCount ?? 0} Services</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[11px]">
                    <Clock className="size-3" />
                    <span>{new Date(proj.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Ingest Key Preview */}
                {proj.ingestKey && (
                  <div className="mt-3 flex items-center justify-between rounded-md bg-surface-muted/70 px-2.5 py-1.5 font-mono text-[11px]">
                    <span className="text-muted-foreground truncate max-w-[170px]">
                      {proj.ingestKey.slice(0, 16)}...
                    </span>
                    <CopyButton text={proj.ingestKey} />
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3">
                <Link
                  href={`/app/organizations/${orgId}/projects/${proj.id}/settings`}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Settings
                </Link>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => router.push(`/app/organizations/${orgId}/projects/${proj.id}`)}
                >
                  <span>Open Console</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
