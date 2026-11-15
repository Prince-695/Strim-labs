"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Globe,
  ShieldAlert,
  Play,
  Trash2,
  Loader2
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { projectApi } from "@/lib/project-api"
import { useUIStore } from "@/lib/stores/ui-store"

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentOrgId, setCurrentProjectId } = useUIStore()

  const projectId = (params?.id as string) || ""
  const [deleteConfirm, setDeleteConfirm] = React.useState("")
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const { data: response, isLoading } = useQuery({
    queryKey: ["project_detail", currentOrgId, projectId],
    queryFn: () => projectApi.get(currentOrgId!, projectId),
    enabled: Boolean(currentOrgId && projectId),
  })

  const project = response?.data

  React.useEffect(() => {
    if (projectId) {
      setCurrentProjectId(projectId)
    }
  }, [projectId, setCurrentProjectId])

  const handleDelete = async () => {
    if (!currentOrgId || !project) return
    if (deleteConfirm !== project.slug) {
      setDeleteError(`Please type "${project.slug}" to confirm deletion.`)
      return
    }

    try {
      setIsDeleting(true)
      setDeleteError(null)
      await projectApi.delete(currentOrgId, projectId)
      queryClient.invalidateQueries({ queryKey: ["projects_list", currentOrgId] })
      router.push("/dashboard/projects")
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDeleteError(err.message)
      } else {
        setDeleteError("Failed to delete project.")
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const isVerified = project?.verification_status === "verified"

  return (
    <div className="space-y-6">
      <PageHeader
        title={project?.name || "Project Details"}
        description={`Target API configuration and observability profile for ${project?.slug || ""}`}
        breadcrumbs={[
          { label: "Projects", href: "/dashboard/projects" },
          { label: project?.name || "Project" },
        ]}
        actions={
          <div className="flex items-center gap-2.5">
            {!isVerified ? (
              <Link
                href={`/dashboard/projects/${projectId}/verification`}
                className={buttonVariants({
                  variant: "outline",
                  className: "gap-1.5 text-xs font-mono text-warning border-warning/40",
                })}
              >
                <ShieldAlert className="size-3.5" />
                <span>Verify Domain</span>
              </Link>
            ) : (
              <Link
                href={`/dashboard/runner?project=${projectId}`}
                className={buttonVariants({
                  className: "gap-1.5 bg-brand text-white hover:bg-brand-hover text-xs font-mono",
                })}
              >
                <Play className="size-3.5 fill-current" />
                <span>Run Load Test</span>
              </Link>
            )}
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      ) : !project ? (
        <Card className="p-8 text-center border-border bg-surface">
          <p className="font-mono text-xs text-foreground-muted">Project not found or accessible.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Main Info Card */}
          <Card className="border-border bg-surface">
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold font-heading text-foreground">{project.name}</h2>
                    <span className="rounded bg-surface-raised px-2.5 py-0.5 font-mono text-xs uppercase text-sand border border-border-subtle">
                      {project.environment}
                    </span>
                    <StatusBadge
                      status={isVerified ? "completed" : "pending"}
                      label={isVerified ? "VERIFIED" : "UNVERIFIED"}
                    />
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs text-foreground-muted">
                    <Globe className="size-3.5 text-foreground-subtle" />
                    <span className="text-foreground">{project.base_url}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/projects/${projectId}/verification`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "text-xs font-mono",
                    })}
                  >
                    Verification Status
                  </Link>
                  <Link
                    href={`/dashboard/projects/${projectId}/endpoints`}
                    className={buttonVariants({
                      size: "sm",
                      className: "bg-surface-raised hover:bg-surface border border-border-subtle text-foreground text-xs font-mono",
                    })}
                  >
                    View Endpoints ({project.endpoint_count || 0})
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rolling Stats Row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
              <span className="font-mono text-[11px] text-foreground-subtle uppercase">1h Requests</span>
              <p className="font-mono text-xl font-bold text-foreground">
                {(project.stats_1h?.requests || 0).toLocaleString()}
              </p>
              <p className="text-[10px] font-mono text-foreground-muted">Observed telemetry volume</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
              <span className="font-mono text-[11px] text-foreground-subtle uppercase">1h P95 Tail Latency</span>
              <p className="font-mono text-xl font-bold text-foreground">
                {project.stats_1h?.p95_ms ? `${project.stats_1h.p95_ms.toFixed(1)}ms` : "—"}
              </p>
              <p className="text-[10px] font-mono text-foreground-muted">95th percentile response</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
              <span className="font-mono text-[11px] text-foreground-subtle uppercase">1h Error Rate</span>
              <p className="font-mono text-xl font-bold text-foreground">
                {project.stats_1h?.error_rate !== undefined
                  ? `${(project.stats_1h.error_rate * 100).toFixed(2)}%`
                  : "0.00%"}
              </p>
              <p className="text-[10px] font-mono text-foreground-muted">4xx & 5xx proportion</p>
            </div>
          </div>

          {/* Danger Zone: Delete Project */}
          <Card className="border-danger/30 bg-surface">
            <CardHeader className="pb-3 border-b border-danger/20">
              <div className="flex items-center gap-2 text-danger">
                <Trash2 className="size-4" />
                <CardTitle className="text-sm font-semibold font-heading">
                  Danger Zone: Delete Project
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-foreground-muted font-mono">
                Deleting this project removes all recorded endpoints, telemetry timeseries, and load test runs. This action cannot be undone.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 space-y-3 font-mono text-xs">
              {deleteError && (
                <p className="text-danger text-[11px]">{deleteError}</p>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  placeholder={`Type "${project.slug}" to confirm`}
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-danger flex-1"
                />
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteConfirm !== project.slug || isDeleting}
                  className="text-xs font-mono"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Permanently Delete Project</span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
