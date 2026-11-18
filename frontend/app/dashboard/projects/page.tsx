"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  FolderGit2,
  Plus,
  Globe,
  ShieldAlert,
  ArrowRight,
  Play,
  Layers
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { projectApi, type Project } from "@/lib/project-api"
import { useUIStore } from "@/lib/stores/ui-store"

function ProjectsDirectoryContent() {
  const searchParams = useSearchParams()
  const { currentOrgId, setCurrentProjectId, setCreateProjectOpen } = useUIStore()

  React.useEffect(() => {
    if (searchParams?.get("new") === "1" || searchParams?.get("new") === "true") {
      setCreateProjectOpen(true)
    }
  }, [searchParams, setCreateProjectOpen])

  const { data: response, isLoading } = useQuery({
    queryKey: ["projects_list", currentOrgId],
    queryFn: () => projectApi.list(currentOrgId!),
    enabled: Boolean(currentOrgId),
  })

  const projects = response?.data || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects & Targets"
        description="Manage API services, target base URLs, environment tags, and domain verification proofs."
        actions={
          <Button
            onClick={() => setCreateProjectOpen(true)}
            className="gap-1.5 bg-brand text-white hover:bg-brand-hover text-xs font-mono"
          >
            <Plus className="size-3.5" />
            <span>Register New Target</span>
          </Button>
        }
      />

      {!currentOrgId ? (
        <EmptyState
          icon={<Layers className="size-6 text-sand" />}
          title="No Organization Selected"
          description="Select or create a workspace organization to manage projects."
          action={
            <Link
              href="/onboarding/organization"
              className={buttonVariants({
                className: "bg-brand text-white hover:bg-brand-hover text-xs font-mono",
              })}
            >
              <Plus className="mr-1.5 size-3.5" />
              <span>Create Organization</span>
            </Link>
          }
        />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderGit2 className="size-6 text-sand" />}
          title="No Target Projects Registered"
          description="Register your first API service target to start collecting telemetry, discovering endpoints, and running capacity benchmarks."
          action={
            <Button
              onClick={() => setCreateProjectOpen(true)}
              className="bg-brand text-white hover:bg-brand-hover text-xs font-mono"
            >
              <Plus className="mr-1.5 size-3.5" />
              <span>Register Target Project</span>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project: Project) => {
            const isVerified = project.verification_status === "verified"

            return (
              <Card
                key={project.id}
                className="border-border bg-surface hover:border-brand/40 transition-all duration-200 flex flex-col justify-between relative overflow-hidden"
              >
                <CornerCrosshairs />
                <CardHeader className="pb-3 border-b border-border-subtle/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-semibold font-heading text-foreground">
                        {project.name}
                      </CardTitle>
                      <p className="font-mono text-[11px] text-foreground-subtle truncate max-w-[200px]">
                        {project.slug}
                      </p>
                    </div>

                    <span className="rounded bg-surface-raised px-2 py-0.5 font-mono text-[10px] uppercase text-sand border border-border-subtle shrink-0">
                      {project.environment}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="py-4 space-y-3 font-mono text-xs flex-1">
                  {/* Target Base URL */}
                  <div className="flex items-center gap-2 text-foreground-muted">
                    <Globe className="size-3.5 text-foreground-subtle shrink-0" />
                    <span className="truncate text-foreground" title={project.base_url}>
                      {project.base_url}
                    </span>
                  </div>

                  {/* Verification Status */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-foreground-subtle uppercase">Target Authority</span>
                    <StatusBadge
                      status={isVerified ? "completed" : "pending"}
                      label={isVerified ? "VERIFIED" : "UNVERIFIED"}
                    />
                  </div>

                  {/* Endpoints Count */}
                  <div className="flex items-center justify-between pt-1 border-t border-border-subtle/40">
                    <span className="text-[11px] text-foreground-subtle uppercase">Registered Endpoints</span>
                    <span className="font-bold text-foreground">{project.endpoint_count || 0}</span>
                  </div>
                </CardContent>

                {/* Card Actions Footer */}
                <div className="border-t border-border-subtle p-3 bg-surface-raised/20 flex items-center justify-between gap-2 font-mono text-xs">
                  {!isVerified ? (
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="inline-flex items-center gap-1.5 text-warning hover:underline text-xs"
                      onClick={() => setCurrentProjectId(project.id)}
                    >
                      <ShieldAlert className="size-3.5" />
                      <span>Verify Domain</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/dashboard/runner?project=${project.id}`}
                      className="inline-flex items-center gap-1.5 text-sand hover:underline text-xs"
                      onClick={() => setCurrentProjectId(project.id)}
                    >
                      <Play className="size-3 fill-current text-brand" />
                      <span>Launch Test</span>
                    </Link>
                  )}

                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="inline-flex items-center gap-1 text-foreground-muted hover:text-foreground text-xs"
                    onClick={() => setCurrentProjectId(project.id)}
                  >
                    <span>View Project</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ProjectsDirectoryPage() {
  return (
    <React.Suspense fallback={<div className="h-48 w-full animate-pulse bg-surface-raised rounded-xl" />}>
      <ProjectsDirectoryContent />
    </React.Suspense>
  )
}
