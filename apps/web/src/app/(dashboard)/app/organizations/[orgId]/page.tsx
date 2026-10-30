"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Layers,
  Users,
  Key,
  PieChart,
  Plus,
  ArrowRight,
  Server,
  Activity,
  Zap,
  Building,
  Calendar,
  ExternalLink,
  Shield,
  Settings,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/data-display/metric-card";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default function OrganizationOverviewPage({ params }: PageProps) {
  const { orgId } = use(params);
  const router = useRouter();

  // Query Organization detail
  const {
    data: orgData,
    isLoading: orgLoading,
    error: orgError,
    refetch: refetchOrg,
  } = useQuery({
    queryKey: queryKeys.organizations.detail(orgId),
    queryFn: () =>
      fetchApi<{ organization: Schemas["Organization"] }>(`/api/v1/organizations/${orgId}`).then(
        (res) => res.organization
      ),
  });

  // Query Projects in this Organization
  const {
    data: projectsData,
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: queryKeys.projects.all(orgId),
    queryFn: () =>
      fetchApi<{ projects: Schemas["Project"][]; total: number }>(
        `/api/v1/organizations/${orgId}/projects`
      ).then((res) => res.projects),
  });

  if (orgLoading || projectsLoading) {
    return <LoadingState message="Loading organization context..." />;
  }

  if (orgError || !orgData) {
    return (
      <ErrorState
        title="Failed to load organization"
        description={(orgError as any)?.message || "The requested organization could not be found."}
        onRetry={refetchOrg}
      />
    );
  }

  const projects: Schemas["Project"][] = Array.isArray(projectsData)
    ? (projectsData as Schemas["Project"][])
    : (projectsData && typeof projectsData === "object" && Array.isArray((projectsData as any).projects)
        ? (projectsData as any).projects
        : []);
  const maxProjects = 5;
  const isProjectCapReached = projects.length >= maxProjects;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        title={orgData.name}
        description={orgData.description || `Enterprise workspace • ID: ${orgData.slug}`}
        badge={
          <Badge variant={orgData.plan === "ENTERPRISE" ? "default" : "secondary"} className="font-mono text-xs">
            {orgData.plan} PLAN
          </Badge>
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/app/organizations/${orgId}/settings`)}
              className="gap-1.5"
            >
              <Settings className="size-3.5" />
              <span>Org Settings</span>
            </Button>
            <Button
              size="sm"
              disabled={isProjectCapReached}
              onClick={() => router.push(`/app/organizations/${orgId}/projects/new`)}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              <span>New Project</span>
            </Button>
          </div>
        }
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Projects"
          value={`${projects.length} / ${maxProjects}`}
          helperText={`${maxProjects - projects.length} project slots remaining`}
          icon={Layers}
        />
        <MetricCard
          title="Team Members"
          value={orgData.memberCount ?? 1}
          helperText="Full access members"
          icon={Users}
        />
        <MetricCard
          title="Subscription Tier"
          value={orgData.plan}
          helperText="Active multi-tenant license"
          icon={Shield}
        />
        <MetricCard
          title="Created Date"
          value={new Date(orgData.createdAt).toLocaleDateString()}
          helperText="Tenant provisioning"
          icon={Calendar}
        />
      </div>

      {/* Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Projects</h2>
            <p className="text-xs text-muted-foreground">
              Microservices, continuous observability, and capacity benchmark targets.
            </p>
          </div>
          <Link
            href={`/app/organizations/${orgId}/projects`}
            className="text-xs text-brand hover:underline font-medium"
          >
            View all projects &rarr;
          </Link>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No projects configured"
            description="Projects organize your backend services, API endpoints, metrics, and automated load tests."
            action={{
              label: "Create First Project",
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
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {proj.status}
                    </Badge>
                  </div>

                  {proj.description && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {proj.description}
                    </p>
                  )}

                  {/* Quick links to project domains */}
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                    <Link
                      href={`/app/organizations/${orgId}/projects/${proj.id}/services`}
                      className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Server className="size-3 text-brand" />
                      <span>Services</span>
                    </Link>
                    <Link
                      href={`/app/organizations/${orgId}/projects/${proj.id}/monitoring`}
                      className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Activity className="size-3 text-emerald-500" />
                      <span>Telemetry</span>
                    </Link>
                    <Link
                      href={`/app/organizations/${orgId}/projects/${proj.id}/load-tests`}
                      className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Zap className="size-3 text-amber-500" />
                      <span>Load Tests</span>
                    </Link>
                  </div>
                </div>

                <div className="mt-5 border-t border-border/60 pt-3 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Key: {proj.ingestKey ? `${proj.ingestKey.slice(0, 8)}...` : "Configured"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-xs text-brand hover:text-brand"
                    onClick={() => router.push(`/app/organizations/${orgId}/projects/${proj.id}`)}
                  >
                    <span>Open Project</span>
                    <ArrowRight className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href={`/app/organizations/${orgId}/members`}
          className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-brand/40 hover:bg-surface-muted/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Users className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground group-hover:text-brand">
                Team &amp; Invitations
              </div>
              <div className="text-xs text-muted-foreground">Manage RBAC roles and invite engineers</div>
            </div>
          </div>
        </Link>

        <Link
          href={`/app/organizations/${orgId}/api-keys`}
          className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-brand/40 hover:bg-surface-muted/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Key className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground group-hover:text-brand">
                API Keys
              </div>
              <div className="text-xs text-muted-foreground">Provision CI/CD and telemetry credentials</div>
            </div>
          </div>
        </Link>

        <Link
          href={`/app/organizations/${orgId}/usage`}
          className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-brand/40 hover:bg-surface-muted/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <PieChart className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground group-hover:text-brand">
                Quotas &amp; Usage
              </div>
              <div className="text-xs text-muted-foreground">Review telemetry events and test quotas</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
